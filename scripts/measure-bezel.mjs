// Measure an Apple Design Resources bezel PNG and print the numbers overlay.js needs.
//
//   node scripts/measure-bezel.mjs <file.png> [...]
//
// Every device frame in DEVICES is an official Apple bezel (developer.apple.com/design/resources):
// a product render with the screen punched out as transparency. This reports, in frame pixels,
// the screen rect (ox/oy/sw/sh), its painted corner radius (sr) and any cutout island drawn
// inside the screen - a camera or Dynamic Island - so the status bar can be padded clear of it.
import { chromium } from "playwright";
import fs from "fs";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node scripts/measure-bezel.mjs <bezel.png> [...]");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();

for (const file of files) {
  const b64 = fs.readFileSync(file).toString("base64");
  const m = await page.evaluate(measure, `data:image/png;base64,${b64}`);
  const name = file.split("/").pop();
  console.log(`\n${name}`);
  console.log(`  fw: ${m.fw}, fh: ${m.fh}, ox: ${m.ox}, oy: ${m.oy}, sw: ${m.sw}, sh: ${m.sh}, sr: ${m.sr}`);
  for (const s of [1, 2, 3]) {
    if (m.sw % s === 0 && m.sh % s === 0) console.log(`  at ${s}x -> ${m.sw / s} x ${m.sh / s} pt`);
  }
  if (!m.islands.length) console.log("  no cutout inside the screen");
  for (const i of m.islands) {
    console.log(`  cutout: screen x ${i.x0}-${i.x1}, y ${i.y0}-${i.y1}` +
      `  (clear it with sb.padX >= ${Math.max(i.x0 ? m.sw - i.x0 : 0, i.x1 < m.sw - 1 ? i.x1 : 0) + 20})`);
  }
}
await browser.close();

// Runs in the page: alpha < 128 is the punched-out screen, everything else is product art.
async function measure(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const W = img.width, H = img.height;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  const clear = (x, y) => d[(y * W + x) * 4 + 3] < 128;

  // Screen rect: the most common run edge across every row and column through the middle.
  // Mode, not min/max - a camera cutout or a hinge notch only perturbs a minority of lines.
  const cx = W >> 1, cy = H >> 1;
  const tally = (map, v) => map.set(v, (map.get(v) || 0) + 1);
  const mode = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const L = new Map(), R = new Map(), U = new Map(), D = new Map();
  for (let y = 0; y < H; y++) {
    if (!clear(cx, y)) continue;
    let l = cx, r = cx;
    while (l > 0 && clear(l - 1, y)) l--;
    while (r < W - 1 && clear(r + 1, y)) r++;
    tally(L, l); tally(R, r);
  }
  for (let x = 0; x < W; x++) {
    if (!clear(x, cy)) continue;
    let u = cy, dn = cy;
    while (u > 0 && clear(x, u - 1)) u--;
    while (dn < H - 1 && clear(x, dn + 1)) dn++;
    tally(U, u); tally(D, dn);
  }
  const ox = mode(L), oy = mode(U);
  const sw = mode(R) - ox + 1, sh = mode(D) - oy + 1;

  // Opaque islands inside that rect: the painted corners plus any camera / Dynamic Island.
  const seen = new Uint8Array(sw * sh);
  const solid = (x, y) => !clear(ox + x, oy + y);
  const blobs = [];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = y * sw + x;
    if (seen[i] || !solid(x, y)) continue;
    let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
    const stack = [i]; seen[i] = 1;
    while (stack.length) {
      const k = stack.pop(), kx = k % sw, ky = (k / sw) | 0;
      n++;
      if (kx < x0) x0 = kx; if (kx > x1) x1 = kx;
      if (ky < y0) y0 = ky; if (ky > y1) y1 = ky;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = kx + dx, ny = ky + dy;
        if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
        const j = ny * sw + nx;
        if (seen[j] || !solid(nx, ny)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    if (n > 400) blobs.push({ n, x0, x1, y0, y1 });
  }
  // A blob hugging a rect corner is the painted corner; its extent is the radius.
  const atCorner = (b) => (b.x0 === 0 || b.x1 === sw - 1) && (b.y0 === 0 || b.y1 === sh - 1);
  const corners = blobs.filter(atCorner);
  const sr = corners.length
    ? Math.round(corners.reduce((a, b) => a + Math.min(b.x1 - b.x0, b.y1 - b.y0) + 1, 0) / corners.length)
    : 0;
  return { fw: W, fh: H, ox, oy, sw, sh, sr, islands: blobs.filter((b) => !atCorner(b)) };
}
