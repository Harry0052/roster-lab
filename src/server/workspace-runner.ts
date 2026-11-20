import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

export const LOCAL_BROWSER_LABEL = "local browser, not isolated VM";

export function findChrome(): string | null {
  const candidates = [
    process.env.ROSTER_LAB_CHROME,
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function dockerAvailable(): boolean {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function workPage(projectName: string, taskTitle: string, note: string): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<title>${escapeHtml(projectName)}</title>
<body style="font-family: Georgia, serif; margin: 32px; background: #f3efe6; color: #1d1915;">
  <p style="letter-spacing: .08em; text-transform: uppercase; font-size: 12px;">local browser, not isolated VM</p>
  <h1>${escapeHtml(projectName)}</h1>
  <p>${escapeHtml(taskTitle)}</p>
  <pre style="white-space: pre-wrap; background: white; padding: 16px; border: 1px solid #e2d9cb;">${escapeHtml(note)}</pre>
</body>
</html>`;
}

export async function captureInProfile(options: {
  profileDir: string;
  screenshotPath: string;
  html: string;
}): Promise<void> {
  const chrome = findChrome();
  if (!chrome) {
    throw new Error("Google Chrome was not found. Install Chrome or set ROSTER_LAB_CHROME to the browser binary.");
  }
  fs.mkdirSync(options.profileDir, { recursive: true });
  fs.mkdirSync(path.dirname(options.screenshotPath), { recursive: true });
  const context = await chromium.launchPersistentContext(options.profileDir, {
    headless: true,
    executablePath: chrome,
    viewport: { width: 1100, height: 720 },
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.setContent(options.html, { waitUntil: "load", timeout: 15000 });
    await page.screenshot({ path: options.screenshotPath, type: "png" });
  } finally {
    await context.close();
  }
}
