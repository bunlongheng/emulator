// Export resolution test: loads the REAL extension in Chromium, frames a page, downloads a
// PNG for each device and asserts the file is at least the frame art's own size.
//
// The render test (verify-frames.mjs) drives preview/preview.html, where export is a no-op -
// it needs the background worker. This one loads the packed extension so the whole path runs:
// captureVisibleTab -> tiles -> stitch -> redraw the bezel at 1:1 -> save.
//
//   node tests/verify-export.mjs
import { chromium } from "playwright";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8126;
const OUT = path.join(ROOT, "tests", "exports");
fs.mkdirSync(OUT, { recursive: true });

// id -> picker label (how the row reads in the HUD)
const DEVICES = {
  macbookair: 'MacBook Air 13" (Sky Blue)',
  macbookpro16: 'MacBook Pro 16" (Space Black)',
  macbook: "MacBook",
  iphone: "iPhone 18 Pro Max",
  ipadpro: 'iPad Pro 13" (M4)',
  watch: "Apple Watch Ultra 3",
};
// id -> the frame art's own pixel width; the export must not come in under it
const ART = { macbookair: 3400, macbookpro16: 4260, macbook: 3306, iphone: 1470, ipadpro: 2245, watch: 600 };
const XPAD = 26; // overlay.js pads the export by this much on each side

// RIFF fourcc list for a .webp - VP8L means lossless, VP8 means lossy.
function chunks(file) {
  const b = fs.readFileSync(file);
  const out = [];
  for (let i = 12; i + 8 <= b.length; ) {
    const size = b.readUInt32LE(i + 4);
    out.push(b.toString("latin1", i, i + 4).trim());
    i += 8 + size + (size & 1);
  }
  return out;
}

// Deliberately small window: the old cropped-screenshot export scaled with the window, so a
// window this size is exactly where it used to produce an unusable file.
const VIEW = { width: 1100, height: 760 };

const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1300));

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "emulator-export-"));
// MV3 service workers only start in Chromium's new headless, which Playwright reaches
// through the `chromium` channel (the bundled build still uses old headless).
const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  viewport: null,
  args: [
    `--disable-extensions-except=${ROOT}`,
    `--load-extension=${ROOT}`,
    `--window-size=${VIEW.width},${VIEW.height}`,
  ],
});

const results = [];
try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));

  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  await page.goto(`http://localhost:${PORT}/preview/sample.html`, { waitUntil: "load" }).catch(async () => {
    await page.goto(`http://localhost:${PORT}/preview/preview.html`, { waitUntil: "load" });
  });
  await page.waitForTimeout(500);

  // The overlay normally goes in on a toolbar click, which Playwright cannot dispatch - run
  // the listener's body from inside the worker instead. This closure executes in the service
  // worker, not in node, so `chrome` is defined there.
  await sw.evaluate(async () => {
    /* global chrome */
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["overlay.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["overlay.js"] });
  });
  await page.waitForSelector("#emulator-root", { timeout: 10000 });
  await page.waitForTimeout(1200);

  for (const [id, label] of Object.entries(DEVICES)) {
    // Drive the real HUD - the overlay lives in the extension's isolated world, so its API
    // is not reachable from page.evaluate(); the DOM is the only shared surface, and
    // clicking through it is what a user actually does anyway.
    await page.click("#emulator-root .df-pick .df-pick-btn");
    const idx = await page.$$eval(
      "#emulator-root .df-pick .df-po .df-po-name",
      (ns, l) => ns.findIndex((n) => n.textContent.trim() === l), label);
    if (idx < 0) throw new Error(`no picker row labelled "${label}"`);
    await page.locator("#emulator-root .df-pick .df-po").nth(idx).click();
    await page.waitForTimeout(1600); // frame PNG + iframe settle

    const dl = page.waitForEvent("download", { timeout: 90000 });
    await page.click("#emulator-root .df-dl");
    await page.locator("#emulator-root .df-menu .df-mi").first().click(); // PNG
    const download = await dl;
    const file = path.join(OUT, download.suggestedFilename());
    await download.saveAs(file);

    const dim = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight };
    }, "data:image/png;base64," + fs.readFileSync(file).toString("base64"));

    // The WebP has to be the same picture, not a cheaper one. Two separate exports capture the
    // tab twice, so a pixel compare against the PNG picks up capture noise, not encoder loss -
    // the file itself is the honest witness: WebP stores a VP8L chunk when it is lossless and a
    // VP8 one when it is not, so quality slipping back off 1 flips that fourcc.
    const dlW = page.waitForEvent("download", { timeout: 90000 });
    await page.click("#emulator-root .df-dl");
    await page.locator("#emulator-root .df-menu .df-mi").nth(1).click(); // WebP
    const dw = await dlW;
    const webp = path.join(OUT, dw.suggestedFilename());
    await dw.saveAs(webp);
    const lossless = chunks(webp).includes("VP8L");

    const artWidth = ART[id];
    const want = artWidth + XPAD * 2;
    const ok = dim.w >= want && lossless;
    results.push({ id, got: `${dim.w}x${dim.h}`, ok });
    const kb = (f) => Math.round(fs.statSync(f).size / 1024) + "KB";
    console.log(`${ok ? "PASS" : "FAIL"} ${id.padEnd(14)} ${(dim.w + "x" + dim.h).padEnd(12)} need >= ${want}  png ${kb(file).padStart(7)}  webp ${kb(webp).padStart(7)} ${lossless ? "lossless" : "LOSSY"}`);
  }
} finally {
  await ctx.close();
  server.kill();
  fs.rmSync(profile, { recursive: true, force: true });
}

const bad = results.filter((r) => !r.ok);
console.log(bad.length ? `\n❌ ${bad.length} under-resolution` : "\n✅ ALL AT OR ABOVE NATIVE");
process.exit(bad.length ? 1 : 0);
