import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

const DB = path.resolve("tests/e2e/.tmp/e2e.db");

test.beforeAll(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${DB}${suffix}`, { force: true });
  }
});

/**
 * Creates a session through the UI and returns its join code plus the host page.
 * Going through the UI rather than the API keeps the host key in the browser
 * where the console expects to find it.
 */
async function hostSession(page: Page, title: string): Promise<string> {
  await page.goto("/host");
  await page.getByLabel("Session name").fill(title);
  await page.getByRole("button", { name: /create session/i }).click();
  await page.waitForURL(/\/c\/[A-Z0-9]{6}$/);
  const code = page.url().split("/c/")[1];
  expect(code).toHaveLength(6);
  return code;
}

/** A separate browser context is a separate device: its own cookies and storage. */
async function newVoter(browser: Browser, code: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/v/${code}`);
  return page;
}

test("a fixed question runs from setup to a ranked result", async ({ page, browser }) => {
  const code = await hostSession(page, "E2E Fixed");

  await page.getByRole("button", { name: /^add$/i }).click();
  await page.getByLabel("Question").fill("Tabs or spaces?");
  await page.getByLabel("Answers").fill("Tabs\nSpaces");
  await page.getByRole("button", { name: /add question/i }).click();

  await expect(page.getByText("Tabs or spaces?").first()).toBeVisible();
  await page.getByRole("button", { name: /open voting/i }).click();
  await expect(page.getByText(/close voting/i)).toBeVisible();

  // Three separate devices, two for Spaces.
  for (const choice of ["Spaces", "Tabs", "Spaces"]) {
    const voter = await newVoter(browser, code);
    await expect(voter.getByRole("heading", { name: "Tabs or spaces?" })).toBeVisible();
    await voter.getByRole("button", { name: choice, exact: false }).click();
    await voter.getByRole("button", { name: /lock in my vote/i }).click();
    await expect(voter.getByText("Your vote is in")).toBeVisible();
    await voter.context().close();
  }

  // The console is driven by the live channel, so this must land without a reload.
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  const wall = await browser.newPage();
  await wall.goto(`/w/${code}`);
  const rows = wall.getByRole("listitem");
  await expect(rows.first()).toContainText("Spaces");
  await expect(rows.first()).toContainText("2");
  await wall.close();
});

test("a pool question accepts a typed answer and merges spellings", async ({ page, browser }) => {
  const code = await hostSession(page, "E2E Pool");

  await page.getByRole("button", { name: /^add$/i }).click();
  await page.getByRole("button", { name: /open field/i }).click();
  await page.getByLabel("Question").fill("Who is funniest?");
  await page.getByLabel(/starting names/i).fill("Ada");
  await page.getByRole("button", { name: /add question/i }).click();
  await page.getByRole("button", { name: /open voting/i }).click();

  // Two people type the same name with different casing and spacing.
  for (const typed of ["Grace Hopper", "  grace   hopper "]) {
    const voter = await newVoter(browser, code);
    await voter.getByLabel(/search or add an answer/i).fill(typed);
    await voter.getByRole("button", { name: /^Add/ }).click();
    await voter.getByRole("button", { name: /lock in my vote/i }).click();
    await expect(voter.getByText("Your vote is in")).toBeVisible();
    await voter.context().close();
  }

  const wall = await browser.newPage();
  await wall.goto(`/w/${code}`);
  // Merged into one option with two votes, not two options with one each.
  // The wall renders the number and its caption as separate nodes.
  await expect(wall.getByText("votes in")).toBeVisible();
  await expect(wall.getByText("2", { exact: true }).first()).toBeVisible();
  const labels = await wall.locator("svg[role=img] text").allTextContents();
  const graceLabels = labels.filter((t) => /grace/i.test(t));
  expect(graceLabels.length).toBe(1);
  await wall.close();
});

test("one device cannot vote twice on the same question", async ({ page, browser }) => {
  const code = await hostSession(page, "E2E Once");

  await page.getByRole("button", { name: /^add$/i }).click();
  await page.getByLabel("Question").fill("Again?");
  await page.getByLabel("Answers").fill("Yes\nNo");
  await page.getByRole("button", { name: /add question/i }).click();
  await page.getByRole("button", { name: /open voting/i }).click();

  const voter = await newVoter(browser, code);
  await voter.getByRole("button", { name: "Yes", exact: false }).click();
  await voter.getByRole("button", { name: /lock in my vote/i }).click();
  await expect(voter.getByText("Your vote is in")).toBeVisible();

  // A reload must show the receipt, never a fresh ballot.
  await voter.reload();
  await expect(voter.getByText("Your vote is in")).toBeVisible();
  await expect(voter.getByRole("button", { name: /lock in my vote/i })).toHaveCount(0);
  await voter.context().close();
});

test("a voter waiting in the lobby is moved on when the host opens a question", async ({
  page,
  browser,
}) => {
  const code = await hostSession(page, "E2E Lobby");

  await page.getByRole("button", { name: /^add$/i }).click();
  await page.getByLabel("Question").fill("Ready?");
  await page.getByLabel("Answers").fill("Yes\nNo");
  await page.getByRole("button", { name: /add question/i }).click();

  // The voter joins before anything is open and must not see the draft question.
  const voter = await newVoter(browser, code);
  await expect(voter.getByText("You are in")).toBeVisible();
  await expect(voter.getByText("Ready?")).toHaveCount(0);

  await page.getByRole("button", { name: /open voting/i }).click();

  // Pushed over the live channel, with no action from the voter.
  await expect(voter.getByRole("heading", { name: "Ready?" })).toBeVisible();
  await voter.context().close();
});

test("closing a question stops voting and reveals the result", async ({ page, browser }) => {
  const code = await hostSession(page, "E2E Close");

  await page.getByRole("button", { name: /^add$/i }).click();
  await page.getByLabel("Question").fill("Last call?");
  await page.getByLabel("Answers").fill("Yes\nNo");
  await page.getByRole("button", { name: /add question/i }).click();
  await page.getByRole("button", { name: /open voting/i }).click();

  const voter = await newVoter(browser, code);
  await expect(voter.getByRole("heading", { name: "Last call?" })).toBeVisible();

  await page.getByRole("button", { name: /close voting/i }).click();

  await expect(voter.getByText("Voting has closed")).toBeVisible();
  await expect(voter.getByRole("button", { name: /lock in my vote/i })).toHaveCount(0);
  await voter.context().close();
});

test("a wrong code is reported rather than hanging", async ({ page }) => {
  await page.goto("/v/ZZZZZZ");
  await expect(page.getByText("No session with that code.")).toBeVisible();
});
