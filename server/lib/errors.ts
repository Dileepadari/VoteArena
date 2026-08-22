export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "bad_request", message, details);
  }
  static unauthorized(message = "Admin token missing or invalid.") {
    return new ApiError(401, "unauthorized", message);
  }
  static forbidden(message: string) {
    return new ApiError(403, "forbidden", message);
  }
  static notFound(message = "Not found.") {
    return new ApiError(404, "not_found", message);
  }
  static conflict(code: string, message: string, details?: unknown) {
    return new ApiError(409, "conflict", message, { reason: code, ...(details as object) });
  }
  static tooMany(message = "Too many requests. Slow down a moment.") {
    return new ApiError(429, "rate_limited", message);
  }
}
