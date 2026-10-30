# Emulator

A tiny Chrome (Manifest V3) extension that wraps the **current tab** in a realistic device bezel - iPhone, iPad, MacBook, iMac, Studio Display, Galaxy Z Fold, Apple Watch - so you can see any page as if it were running on that device, live, on top of the real page.

Click the toolbar icon once to frame the tab, click again (or press <kbd>Esc</kbd>) to clear it. No new tab, no separate window: a full-screen studio overlay drops over the current page with the site rendered inside the device at its true logical resolution.

![Emulator - iPhone](docs/hero.png)

![Emulator - iPhone in landscape](docs/hero-landscape.png)

## Features

- **Live tab, framed** - the page you are on, running inside a real device body (an `<iframe>` at the device's logical viewport).
- **Photoreal Apple frames** - high-resolution device PNGs with the live site composited into the transparent screen area using exact per-frame insets: **iPhone 17 Pro Max**, **iPad Pro 13" (M4)** (portrait + landscape), **iPad (A16)**, **MacBook**, **iMac 24"**, **Studio Display**.
- **iOS Safari chrome** on the iPhone - black status bar (9:41, cellular, Wi-Fi, battery) and a Safari bottom bar with the framed page's real domain (`Aa`, lock, URL, reload) plus the toolbar row (back, forward, share, bookmark, tabs). The page is inset between the two so nothing overlaps.
- **Rotate** to landscape with a real spin animation - the iPhone synthesizes landscape by rotating the portrait frame 90 degrees and keeps its status bar and Safari chrome; each orientation fills the stage; the iPad ships a dedicated landscape frame.
- **Drawn (CSS) frames** for devices with no photoreal asset: Galaxy Z Fold (open), Apple Watch Ultra (orange band), and a Custom size.
- **Studio backdrop** behind the Mac displays; a flat neutral stage behind phones.
- **Toolbar icon state** - the icon shows the device family normally and swaps to a red X while a tab is framed (click to close).
- **Download** as **PNG (transparent background)** or **WebP (HD, small file)** - exports the framed device via `captureVisibleTab`, so it captures rendered pixels and works even on cross-origin pages, then crops to the device. The PNG is masked with the frame's own alpha so the stage is knocked out.
- **Copy** the transparent PNG straight to the clipboard.
- **Share** - uploads a WebP of the device to bunlongheng.com and copies back a public link (`/frames/<id>`) with Open Graph preview.
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

- **`background.js`** (service worker) toggles the overlay on the active tab when the toolbar icon is clicked, injecting `overlay.css` + `overlay.js` on demand. It answers the overlay's `df-capture` message with a `captureVisibleTab` screenshot for the exports, relays `df-share` uploads to bunlongheng.com from the extension origin, and drives the on/off toolbar icon.
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

Device ids: `iphone`, `ipada16`, `ipadpro`, `macbook`, `imac`, `studiodisplay`, `zfold`, `watch`, `custom`. Export, copy and share are no-ops here - they need the real extension's background worker.

## Test

An automated render test loads every device bezel in real headless Chromium (Playwright) and asserts the frame PNG actually loaded (bezel present), that nothing leaks a stray border, and that the device selects and sizes correctly. It writes a screenshot per device to `tests/screenshots/`.

```bash
npm install     # installs Playwright + its Chromium
npm test        # renders + asserts all 11 device views
npm run lint    # ESLint over the extension source
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: run `npm test` and `npm run lint` before opening a PR, and keep all styling in `overlay.css`.

## License

[MIT](LICENSE) (c) Bunlong Heng

---

<div align="center">

<a href="https://bunlongheng.com"><img src="https://img.shields.io/badge/-bunlongheng.com-3A3A3C?style=for-the-badge&amp;labelColor=2A2A2C&amp;logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y%2BmAAADAFBMVEXx8vLq6v%2F19fX09PT8%2Ff309PT5%2BfnAwMBMaXHx8vL19fX5%2Bfny8vL09PT39%2Ff6%2Bfn6%2Bvr09PTx8fH4%2BPn%2F8vLy8%2FP09PTz8%2FPy8vL%2F%2F%2F%2Fz9PTz9PP19fby8vP19PXz8%2FT19%2Fb08%2FTx8vLy8vL09vby8%2FL29vf19fTv8PDz9vb7%2Bvn%2F%2Ff%2F9%2Ff3w8vH29fb%2F%2FP339%2Ff5%2Bfn59%2Ff19PT09PR7rao3VF3%2F%2Fv8AKDR6sqsBV1vv8fL4%2BPiux8b8%2Bvq90NDy8%2FR%2BlpppnZyZqrACLTxclZJSkI9en5ssZ2luqaUAeWgqbW4BX1gCfG0%2Fa3QaVG0MN0UKNUKUpKsGpYMAKjoRQ1UDf3AQRloJqIgEm32d0cUBg3ElbnQIln8eVWgrmIdP0KzF5d5s2acdfHwppJCP5MMXl4Tz8%2FLv8%2FP39%2FiewL5%2BqahYf4IrTFZkk5KlxsREiIYAHiqDnKFmnJowc3IdVllvpKK7zc3D2tnk5%2BmuycdwpKKuub2yv8Ly%2B%2FkAMT7z%2Bvjq7e09gH93q6kGdWpGgoJZmJSlw8M7c3WwyceTw76w1M8mYmpFfX8lW2AFOEpGiYhxqqRrqaRb2rdIsZ8AVE91jpU7d3t3saqBoKhako4AWVEcUlg3aWwDupAHb2YwmIkPP1ERSVA7WmZ8tq8HT14oZW%2BYuLsMl3wQT10ROksENUc8Z3MJSGVLh4dqpJ%2BXr7U51awUgHM4v6ad1MkPuJZAiowVd3IEhnZH0aoYrI05p5sDtYwkzZ8EPViYxsRel5USbHAIgmwIM0gQamzU4uF2malQi4oWQFQ1zaYrp4UXlYwfiHoyxqFE1q4qeX4yn5JIxKkdrX1b1rAbWGvd5Oh91sRijpomsJEVc3Ukc34dqIcwuJVKwZIXkoQZcXlNv5g%2BqZUZvpNl2rPG9N0WkIoNqouW4sVPwp%2BM0b6h0ssfq4d%2F1r8hpo%2Fh9e4AamUjnI9avaBixqgklYWSwL4xtItUxplYl5qZ58mq78wMgnYXfnlOmJaR1L%2Bj78ny9fS%2FrXQPAAAAFXRSTlP7Brvx%2FsJhAgD87r4U72C4uGH8vhRDodYHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC6UlEQVQokS2Sd3BUVRSHb0KS3QRCiZw5t%2By9j33zXjZkyUs2uekhEAi9dwRCL4JUEQRFAQUs9A4WOopKU0GpFoqCBZUivaqoFKkWLIS5GX7%2FfnPO78yZj%2Fj8UTViK6HggvNgSGuluEZRKbZqlN9H%2FFWiWUzIFQK5fhjOIRTDoqv4ia86S4q3KSByHdSqIhxofBKr5iNxLMm2bQqWVkorJ%2BAkO46nkQJhceSRmCTDvKJIJBLJzMxMLU6POJ4eBPF1KpNEbdt2Cms4LCcnZ%2FX6D3d%2BsKJJ7VSlNLoqgbjUtmkKKxlVmpf3bsFXW3d1b77gueJAQIPQBCilkMKemNi23Ts9T35%2FaMe2rsvmTypylGUFCSIYWJLXrm2nUwOPfNO5w%2B73Okxnjqe0JigQEL3JizoeONr%2F2u99vju4fd1rdZnyspQmnGvAUBprWNqz348%2FhXN%2F6P1%2By4Uvs%2FJkpRQRwpJBRVn7vf16Dfitz5XevQqWt3yalXtKaRIUQmglWfsu5y7%2BMrDs0TMftWo1ZVy64xioOVpcIdt8%2Fvqvf9%2F859KJsrLmrzA%2BOKC0IkFEtJza7JOfr%2FYd0P9G98tdOxe0Hp9qJrOIBgDuOeEtp%2F%2B4d%2FvWX%2F%2F9u%2B%2FtlaUTmOWZg7SQEEyuFe52%2BML9O3cZO%2F5xl06zn2VcadOJUqJTzt7a82XfP7sx9vmGNm1m1MstV4IHCVAAoTLqL1372ddn%2Fz%2B2v%2FWq12c1fSpsaeQWAZAANntxzuI3e3zbo8XGpm%2FMnNqiXrh%2BljaPd6UUabkjps19tdGnX2zKb9b4pTFDCzOMLmYtpW5h%2BpCRTeYtyV%2BT36zx808OL4xYGoFrkqDTbJpSXLdRgwbPZL%2BQnT129OOPFVEEsAMJpHKdeKMJgJSAiALdjJANQKnRJI4R6boAKEwLCiGoBBegQjBftQo1KQWOlplFKSV9qGaF1NpAE7QQESTlMSy6pp%2F4%2FFFVYxMNRBTaiM0tkImxNaL8vgfDR8gvoYRaxgAAAABJRU5ErkJggg%3D%3D" alt="bunlongheng.com"></a>
<a href="https://www.linkedin.com/in/bunlongheng/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://www.instagram.com/ibunlong/"><img src="https://img.shields.io/badge/Instagram-C13584?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram"></a>
<a href="mailto:bheng.code@gmail.com"><img src="https://img.shields.io/badge/Email-2E7D32?style=for-the-badge&logo=gmail&logoColor=white" alt="Email"></a>

<br>

Built by **[Bunlong](https://bunlongheng.com)** &nbsp;&middot;&nbsp; [more apps](https://bunlongheng.com/projects)

</div>
