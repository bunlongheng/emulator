# Emulator

A tiny Chrome (Manifest V3) extension that wraps the **current tab** in a realistic device bezel - iPhone, iPad, MacBook, iMac, Studio Display, Galaxy Z Fold, Apple Watch - so you can see any page as if it were running on that device, live, on top of the real page.

Click the toolbar icon once to frame the tab, click again (or press <kbd>Esc</kbd>) to clear it. No new tab, no separate window: a full-screen studio overlay drops over the current page with the site rendered inside the device at its true logical resolution.

![Emulator - iPhone](docs/hero.png)

![Emulator - iPhone in landscape](docs/hero-landscape.png)

## Features

- **Live tab, framed** - the page you are on, running inside a real device body (an `<iframe>` at the device's logical viewport).
- **Photoreal Apple frames** - high-resolution device PNGs with the live site composited into the transparent screen area using exact per-frame insets: **iPhone 18 Pro Max** (portrait + landscape), **iPhone Duo (front)** and **iPhone Duo (open)** (each portrait + landscape), **iPad Pro 13" (M4)** (portrait + landscape), **iPad (A16)**, **MacBook**, **MacBook Air 13" (Sky Blue)**, **MacBook Air 13" (Gold)**, **MacBook Pro 16" (Space Black)**, **iMac 24"**, **Studio Display**, **Apple Watch Ultra 3**.
- **Frames come from Apple** - every iPhone, Duo, MacBook and Watch frame is an official bezel from [Apple Design Resources](https://developer.apple.com/design/resources/), used as shipped: a product render with the display punched out as transparency, so the camera, Dynamic Island, notch, hinge and buttons are the real artwork. Run `node scripts/measure-bezel.mjs <file.png>` to read a bezel's screen rect, corner radius and cutouts before adding it to `DEVICES`.
- **MacBook finishes** - Apple publishes a bezel per colourway (`Bezel-MacBook-Pro-M5`, `Bezel-MacBook-Air-M5`), and Space Black and Sky Blue are those files as shipped: real anodising, real chamfer highlights, the notch painted into the art inside the screen rect the way the iPhone's Dynamic Island is. Gold is the one finish Apple has never published, so it alone is derived from the silver bezel by `node scripts/recolor-frame.mjs macbook-air-gold` - the aluminium in that render is neutral, so a pixel's colour is its luminance alone, and the script remaps that luminance through the finish's ramp and multiplies its cast back in, gated by luminance so the black display bezel stays black instead of turning navy.
- **Exports at the frame's own resolution, not the window's** - `captureVisibleTab` only ever returns SCREEN pixels, so cropping a screenshot exported the device at whatever fraction `fit()` had shrunk it to: measured at 79% of the frame art on a Retina laptop and 39% on a 1x external monitor. An image-frame device is now REBUILT instead of cropped - the bezel is redrawn from its own PNG at 1:1, and only the page inside the opening is captured, with the rig blown up until one screen pixel covers at least one frame pixel and tiled when that no longer fits the window (the iPhone takes 8 tiles). Each tile is cropped by the opening's measured rect, so nothing depends on where flexbox centred the device. A MacBook Pro 16" comes out 4312 x 2892 from an 1100 x 760 window; the filename states the real pixels. Drawn bezels, Duo poses and rotate-synthesised landscape have no 1:1 source to redraw and still use the cropped screenshot.
- **iOS Safari chrome** on the iPhone - black status bar (9:41, cellular, Wi-Fi, battery) and a Safari bottom bar with the framed page's real domain (`AA`, lock, URL, reload) plus the toolbar row (back, forward, share, bookmark, tabs). The page is inset between the two so nothing overlaps.
- **Glyphs are real SF Symbols**, not redrawn: `scripts/extract-sf-symbols.swift` renders each one with macOS itself and writes it white-on-transparent, so the alpha channel is Apple's artwork. `overlay.css` paints it through a CSS mask with `currentColor`, so a single file serves the light and the dark status bar. Regenerate with `swiftc -O scripts/extract-sf-symbols.swift -o /tmp/sfx && /tmp/sfx frames`.
- **Duo poses** - the iPhone Duo's open bezel cut at the hinge and hinged in 3D, three ways: **butterfly** (held open ~100°, both halves live), **desk clock** (a tent: the hinge is the ridge at the top, the near half leans back carrying the page, the far half is folded down behind it so you see its back) and **laptop** (base flat toward you, screen upright, both halves live). Each half is its own 3D plane holding a copy of the frame art and its own `<iframe>` on the same URL, so the page reads as one continuous screen across the crease; each half carries a few pixels of art past the hinge so the two planes overlap and the bezel connects back into one body. Two live copies of one page have to be driven together or they drift, so while the framed page is same-origin the half that last took input LEADS and the other FOLLOWS: every scroller the leader moves (window or nested) is set to the same offset on its twin, instantly, every frame - a page's own smooth scroll animates in the leader and the follower just tracks it - and the wheel is forwarded only to a page proven to eat it without scrolling (fullpage-style snaps). The pointer goes to the twin as well, so the page's own handlers run in both copies - a stroke on a canvas continues straight across the crease - and every canvas the leader has is drawn onto the twin's each frame while it is in use, so what a page paints itself carries over pixel for pixel. While the copies load neither is cut at the hinge, so a page's lazy-mounted sections land identically in both. A pose can hand the page to just the half that faces you (`solo`), each has its own camera (`yaw`/`pitch`), and the box is sized to the real projected bounds so export crops it whole. The whole Duo family draws at one scale - the closed phone really is half the width of the open one. Apple has not named these poses - the labels are descriptive.
- **Rotate** to landscape with a real spin animation. The iPhone, both Duo states and the iPad each ship a dedicated landscape bezel, so the camera and hinge sit where they really do rather than being a rotated portrait frame.
- **Drawn (CSS) frames** only where no official bezel exists: Galaxy Z Fold (open), which is a Samsung device, and Custom size, which is any arbitrary viewport.
- **Studio backdrop** behind the Mac displays; a flat neutral stage behind phones.
- **Toolbar icon state** - the icon shows the device family normally and swaps to a red X while a tab is framed (click to close).
- **Download** as **PNG (transparent background)** or **WebP (lossless, half a PNG)** - exports the framed device via `captureVisibleTab`, so it captures rendered pixels and works even on cross-origin pages, then crops to the device. The PNG is masked with the frame's own alpha so the stage is knocked out.
- **Copy** the transparent PNG straight to the clipboard.
- **Safari loading line** - the blue page-load bar runs inside the URL pill while the framed page loads.
- **Loading spinner** while the framed page loads; <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>R</kbd> reloads the framed page (not the whole tab) so the overlay stays open.
- **Custom size** - pick "Custom size…" and type any width × height.
- **On-demand injection** (`activeTab` + `scripting`) - nothing runs on any page until you click the icon.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select this folder.
4. Pin **Emulator** to the toolbar.
5. Open any page and click the icon.

## How it works

- **`background.js`** (service worker) toggles the overlay on the active tab when the toolbar icon is clicked, injecting `overlay.css` + `overlay.js` on demand. It answers the overlay's `df-capture` message with a `captureVisibleTab` screenshot for the exports, and drives the on/off toolbar icon.
- **`overlay.js`** builds a full-screen overlay containing the device bezel and an `<iframe>` pointed at the current tab's URL, then scales the device to fit the window. Re-injection (a second click) tears the overlay down - even an orphaned one left after an extension reload.
- **`overlay.css`** owns all the styling (frames, Safari chrome, backdrop, spinner).

## Framing sites that normally block embedding

Most sites send `X-Frame-Options` or a CSP `frame-ancestors` header that stops them being embedded in an `<iframe>` (GitHub sends `DENY`, many apps send `SAMEORIGIN`). Like Responsive Viewer / Responsively / Sizzy, this extension removes those response headers so the real site loads inside the device.

It does this with a **`declarativeNetRequest` session rule** scoped tightly:

- keyed to the **framed page's domain** (`condition.requestDomains`) so it also catches responses served by a **Service Worker** (a tab-scoped rule misses those - the SW re-issues the navigation as its own fetch with no tab id);
- only **while the overlay is open** - the rule is added on open and removed on close (and if the tab is closed or navigates);
- a blocked-page note remains as a fallback for the rare site that busts framing another way (e.g. a Service Worker serving a cached response with the header, which the network layer cannot rewrite).

So normal browsing keeps its clickjacking protection; the headers are only relaxed for the page you are actively framing.

## Develop

Run the overlay against the sample page from a plain static server - no extension reload needed:

```bash
python3 -m http.server 8099   # from the repo root
# open http://localhost:8099/preview/preview.html?d=iphone
# ?d=<device-id> picks the frame, &o=land rotates it, &src=<url> frames any page
```

Device ids: `iphone`, `ipada16`, `ipadpro`, `macbook`, `macbookair`, `macbookairgold`, `macbookpro16`, `imac`, `studiodisplay`, `zfold`, `iphoneduo`, `iphoneduoopen`, `duobutterfly`, `duodesk`, `duolaptop`, `watch`, `custom`. Export and copy are no-ops here - they need the real extension's background worker.

## Test

An automated render test loads every device bezel in real headless Chromium (Playwright) and asserts the frame PNG actually loaded (bezel present), that nothing leaks a stray border, and that the device selects and sizes correctly. It writes a screenshot per device to `tests/screenshots/`.

```bash
npm install     # installs Playwright + its Chromium
npm test        # renders + asserts all 18 device views
npm run lint    # ESLint over the extension source
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: run `npm test` and `npm run lint` before opening a PR, and keep all styling in `overlay.css`.

## License

[MIT](LICENSE) (c) Bunlong Heng
