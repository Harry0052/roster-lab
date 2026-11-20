import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

export const LOCAL_BROWSER_LABEL = "local browser, not isolated VM";
export const CONTAINER_LABEL = "container desktop";
const DESKTOP_IMAGE = "roster-lab-desktop:local";

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

export function workPage(projectName: string, taskTitle: string, note: string, banner: string): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<title>${escapeHtml(projectName)}</title>
<body style="font-family: Georgia, serif; margin: 32px; background: #f3efe6; color: #1d1915;">
  <p style="letter-spacing: .08em; text-transform: uppercase; font-size: 12px;">${escapeHtml(banner)}</p>
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
    await page.setContent(options.html, { waitUntil: "load", timeout: 20000 });
    await page.screenshot({ path: options.screenshotPath, type: "png" });
  } finally {
    await context.close();
  }
}

function imageDirectory(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docker/desktop");
}

export function ensureDesktopImage(): void {
  try {
    execFileSync("docker", ["image", "inspect", DESKTOP_IMAGE], { stdio: "ignore" });
  } catch {
    execFileSync("docker", ["build", "-t", DESKTOP_IMAGE, imageDirectory()], { stdio: "inherit" });
  }
}

export function stopContainer(name: string): void {
  try {
    execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" });
  } catch {
    // The container was already gone.
  }
}

export function containerFile(name: string, filePath: string): string | null {
  try {
    return execFileSync("docker", ["exec", name, "cat", filePath], { encoding: "utf8" });
  } catch {
    return null;
  }
}

export function startProjectContainer(name: string, workDir: string): { novncPort: number; cdpPort: number } {
  ensureDesktopImage();
  stopContainer(name);
  fs.mkdirSync(workDir, { recursive: true });
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--name",
      name,
      "--shm-size=256m",
      "-v",
      `${path.resolve(workDir)}:/work`,
      "-p",
      "127.0.0.1::6080",
      "-p",
      "127.0.0.1::9223",
      DESKTOP_IMAGE,
    ],
    { stdio: "pipe" },
  );
  return {
    novncPort: publishedPort(name, "6080/tcp"),
    cdpPort: publishedPort(name, "9223/tcp"),
  };
}

function publishedPort(name: string, containerPort: string): number {
  const output = execFileSync("docker", ["port", name, containerPort], { encoding: "utf8" }).trim();
  const match = output.match(/:(\d+)\s*$/);
  if (!match?.[1]) throw new Error(`Docker did not publish ${containerPort} for ${name}.`);
  return Number(match[1]);
}

export async function waitForDevtools(cdpPort: number): Promise<void> {
  const deadline = Date.now() + 20000;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : "connection failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Container DevTools did not answer on 127.0.0.1:${cdpPort}. ${last}`);
}

export async function driveContainerBrowser(cdpPort: number, url: string, screenshotPath: string): Promise<string> {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("The container browser has no page context.");
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const text = await page.locator("body").innerText();
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, type: "png" });
    return text;
  } finally {
    await browser.close();
  }
}
