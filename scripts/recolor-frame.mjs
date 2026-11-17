// Derive a coloured MacBook bezel from the silver one.
//
//   node scripts/recolor-frame.mjs <finish> [...]
//
// Only for finishes Apple has never published a bezel for. Everything Apple does publish is
// used as shipped from Apple Design Resources - Sky Blue and Space Black both came back to
// real art once their bezels appeared, and a recolour should give way the same day one does.
// Two passes:
//
//   1. aspect - the silver art opens onto a 16:10 screen (2560 x 1600). A finish whose real
//      panel is a different shape scales the whole PNG vertically to match. Stretching the
//      entire image, not just the opening, keeps the bezel even on all four sides.
//
//   2. finish - the aluminium is neutral (R = G, B a shade higher), so a pixel's colour is
//      its luminance and nothing else. Remap that luminance through the finish's own ramp
//      and multiply back in its cast. `floor`/`ceil` gate the remap by luminance so the
//      black display bezel, which is not aluminium, stays black instead of turning navy.
//
// Run scripts/measure-bezel.mjs on the output afterwards - the vertical scale moves oy and
// sh, and DEVICES needs the measured numbers, not the ones predicted here.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const SRC = "frames/macbook.png";

const FINISHES = {
  // MacBook Air 13" Gold (2018-2020). Apple never published a gold bezel and the line has no
  // gold in it any more, so this is the one finish still derived here. Same 2560 x 1600 panel
  // as the silver art, so nothing is stretched, and it is a cast-only change - gold is pale,
  // so lifting or crushing luminance just makes it look like brass.
  "macbook-air-gold": {
    screen: [2560, 1600], // 1280 x 800 pt
    cast: [1.075, 0.985, 0.855],
    gain: 1,
    lift: 0,
    floor: 0.12,
    ceil: 0.35,
  },
};

const names = process.argv.slice(2);
if (!names.length) {
  console.error(`usage: node scripts/recolor-frame.mjs <${Object.keys(FINISHES).join("|")}> [...]`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const b64 = fs.readFileSync(SRC).toString("base64");

for (const name of names) {
  const finish = FINISHES[name];
  if (!finish) {
    console.error(`unknown finish: ${name}`);
    process.exit(1);
  }
  const out = path.join("frames", `${name}.png`);
  const png = await page.evaluate(recolor, { src: `data:image/png;base64,${b64}`, finish });
  fs.writeFileSync(out, Buffer.from(png.data, "base64"));
  console.log(`${out}  ${png.fw} x ${png.fh}  (vertical scale ${png.scale.toFixed(4)})`);
}
await browser.close();

// Runs in the page: alpha < 128 is the punched-out screen and is never touched.
async function recolor({ src, finish }) {
  const img = new Image();
  img.src = src;
  await img.decode();

  // The silver opening is 2560 x 1600; stretch so it matches this finish's real panel.
  const [tw, th] = finish.screen;
  const vScale = th / tw / (1600 / 2560);
  const fw = img.width;
  const fh = Math.round(img.height * vScale);

  const c = document.createElement("canvas");
  c.width = fw;
  c.height = fh;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, fw, fh);

  const id = ctx.getImageData(0, 0, fw, fh);
  const d = id.data;
  const { cast, gain, lift, floor, ceil } = finish;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    // smoothstep(floor, ceil, L): 0 on the black display bezel, 1 on lit aluminium
    const t = ceil > floor ? Math.min(1, Math.max(0, (L - floor) / (ceil - floor))) : 1;
    const blend = t * t * (3 - 2 * t);
    if (blend === 0) continue;
    const v = 255 * L * (gain + lift * L);
    for (let ch = 0; ch < 3; ch++) {
      const tinted = Math.min(255, Math.max(0, v * cast[ch]));
      d[i + ch] = Math.round(d[i + ch] + (tinted - d[i + ch]) * blend);
    }
  }
  ctx.putImageData(id, 0, 0);

  return {
    fw,
    fh,
    scale: vScale,
    data: c.toDataURL("image/png").split(",")[1],
  };
}
