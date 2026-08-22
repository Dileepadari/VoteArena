import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import type { ApiErrorBody } from "../../shared/types.js";
import { config } from "../config.js";
import { ApiError } from "./errors.js";

export function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      const out = handler(req, res, next) as unknown;
      if (out instanceof Promise) out.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw ApiError.badRequest("The request body is not valid.", flattenIssues(result.error));
  }
  return result.data;
}

function flattenIssues(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    out[issue.path.join(".") || "_"] = issue.message;
  }
  return out;
}

export function adminToken(req: Request): string | undefined {
  const header = req.get("x-admin-token");
  if (header) return header;
  const auth = req.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return undefined;
}

export function notFoundHandler(_req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: { code: "not_found", message: "No such endpoint." },
  };
  res.status(404).json(body);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }

  if (!config.isTest) {
    console.error("[votearena] unhandled error", err);
  }

  const body: ApiErrorBody = {
    error: {
      code: "internal_error",
      message: "Something went wrong on our side.",
      details: config.isProduction ? undefined : String(err),
    },
  };
  res.status(500).json(body);
}
