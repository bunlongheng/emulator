// Emulator overlay controller. Injected on toolbar-icon click.
// Re-injection toggles it off, so one click frames, next click clears.
(() => {
  "use strict";

  // Re-injection means "close the frame". Always tear down any existing overlay - even an
  // ORPHAN left after an extension reload, where window.__emulator may be gone but the DOM
  // node remains. Without this, a reload leaves a frame that the X/icon can no longer close.
  const _existing = document.getElementById("emulator-root");
  if (_existing) {
    try {
      if (window.__emulator && typeof window.__emulator.close === "function") {
        window.__emulator.close();
      } else {
        _existing.remove();
      }
    } catch (_) {
      _existing.remove();
    }
    try { delete window.__emulator; } catch (_) {}
    return;
  }

  // Where the photoreal frame PNGs live. In the real extension that's an extension URL;
  // the preview harness overrides it with __DF_FRAMES.
  const FRAMES_BASE =
    window.__DF_FRAMES ||
    (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
      ? chrome.runtime.getURL("frames/")
      : "frames/");

  // Two kinds of device:
  //  type:"image"  -> a real high-res PNG frame (fw x fh) with a transparent screen hole.
  //                   The live site renders into the screen rect (ox,oy,sw,sh) and the PNG
  //                   sits on top. `wl` is the logical viewport width the site sees.
  //  type:phone/fold/watch/frame -> a vector (CSS) bezel, for devices we have no PNG for.
  // The two Apple "open" bezels. Both the flat iPhone Duo (open) and every folded pose render
  // from these, so the hinge geometry only ever has to be right in one place.
  const DUO_L = { file: "iphone-duo-open-landscape.png", fw: 3093, fh: 2247, ox: 120, oy: 120, sw: 2853, sh: 2007, sr: 174,
                  sb: { top: 34, h: 96, padX: 110, font: 42, glyph: 36 } };
  const DUO_P = { file: "iphone-duo-open-portrait.png", fw: 2247, fh: 3093, ox: 120, oy: 120, sw: 2007, sh: 2853, sr: 174,
                  sb: { top: 40, h: 108, padX: 96, font: 46, glyph: 40 } };

  const DEVICES = [
    // --- Apple, real photoreal frames ---
    // iPhone Duo - Apple's book-style foldable, Star White. These are Apple's own Design
    // Resources bezels (developer.apple.com/design/resources), so the art is the real device
    // and the screen is a genuine transparent cutout. All four are exported at 3x.
    // Folded and open are the SAME physical height (2137 vs 2138 frame px) - unfolding doubles
    // the width - so "open" defaults to the landscape bezel and rotates to Apple's portrait one.
    { id: "iphoneduo", label: "iPhone Duo (front)", mode: "Front", fam: "duo", cat: "Apple - real frames", type: "image", rot: true,
      frame: { file: "iphone-duo-closed-portrait.png", fw: 1574, fh: 2194, ox: 88, oy: 80, sw: 1398, sh: 2034, sr: 190,
               // padX clears Apple's camera cutout, a 108px dot at screen x 1201-1308
               sb: { top: 40, h: 108, padX: 220, font: 46, glyph: 40 } }, wl: 466,
      frameL: { file: "iphone-duo-closed-landscape.png", fw: 2194, fh: 1574, ox: 80, oy: 88, sw: 2034, sh: 1398, sr: 190,
                // rotated, the same cutout lands top-left at screen x 89-197
                sb: { top: 34, h: 96, padX: 220, font: 42, glyph: 36 } }, wlL: 678 },
    { id: "iphoneduoopen", label: "iPhone Duo (open)", mode: "Open", fam: "duo", cat: "Apple - real frames", type: "image", rot: true,
      frame: DUO_L, wl: 951, frameL: DUO_P, wlL: 669 },
    // --- Duo poses: the same open bezel, cut at the hinge and folded in 3D ---
    // `axis` is the hinge (y = vertical hinge, split left|right; x = horizontal, split top|bottom),
    // `a`/`b` are each half's CSS rotation about it, `sbHalf` is the half that wears the status bar.
    { id: "duobutterfly", label: "iPhone Duo (butterfly)", mode: "Butterfly", fam: "duo", cat: "Apple - real frames", type: "pose",
      frame: DUO_L, wl: 951, axis: "y", a: 40, b: -40, persp: 4600, sbHalf: 2 },
    // desk clock is a TENT: the hinge is the ridge at the top, the near half leans back toward
    // it carrying the page, the far half is folded down behind it so you see its back - a dark
    // panel that peeks out on the right because the camera sits a little to the left and above
    { id: "duodesk", label: "iPhone Duo (desk clock)", mode: "Desk clock", fam: "duo", cat: "Apple - real frames", type: "pose",
      frame: DUO_P, wl: 669, axis: "x", a: 138, b: 16, persp: 5200, sbHalf: 2, solo: 2,
      yaw: -24, pitch: 7 },
    { id: "duolaptop", label: "iPhone Duo (laptop)", mode: "Laptop", fam: "duo", cat: "Apple - real frames", type: "pose",
      frame: DUO_P, wl: 669, axis: "x", a: 8, b: 72, persp: 5200, sbHalf: 1 },
    { id: "iphone", label: "iPhone 18 Pro Max", cat: "Apple - real frames", type: "image", rot: true,
      // Apple's own Silver bezel. Its opening is the full 440 x 956 pt display (the frame this
      // replaced was 50 pt short), and the Dynamic Island is painted into the art - it sits in
      // the gap between the clock and the status glyphs, so no extra padding is needed.
      frame: { file: "iphone-18-pro-max-portrait.png", fw: 1470, fh: 3000, ox: 75, oy: 66, sw: 1320, sh: 2868, sr: 206,
               sb: { top: 40, h: 108, padX: 108, font: 46, glyph: 40 },
               sf: { h: 300, u: 42 } }, wl: 440,
      frameL: { file: "iphone-18-pro-max-landscape.png", fw: 3000, fh: 1470, ox: 66, oy: 76, sw: 2868, sh: 1320, sr: 206,
                sb: { top: 30, h: 90, padX: 190, font: 40, glyph: 34 },
                sf: { h: 190, u: 36 } }, wlL: 956 },
    { id: "ipadpro", label: 'iPad Pro 13" (M4)', cat: "Apple - real frames", type: "image", rot: true,
      frame: { file: "ipad-portrait.png", fw: 2245, fh: 2930, ox: 96, oy: 102, sw: 2048, sh: 2732, sr: 44,
               sb: { top: 20, h: 64, padX: 60, font: 30, glyph: 27 } }, wl: 1024,
      frameL: { file: "ipad-landscape.png", fw: 2930, fh: 2245, ox: 102, oy: 101, sw: 2732, sh: 2048, sr: 44,
                sb: { top: 18, h: 60, padX: 60, font: 28, glyph: 25 } }, wlL: 1366 },
    { id: "ipada16", label: "iPad (A16)", cat: "Apple - real frames", type: "image", rot: true,
      frame: { file: "ipad-a16.png", fw: 707, fh: 1009, ox: 34, oy: 35, sw: 656, sh: 938, sr: 28 }, wl: 820 },
    { id: "macbook", label: "MacBook", cat: "Apple - real frames", type: "image", desk: true,
      frame: { file: "macbook.png", fw: 3306, fh: 1897, ox: 373, oy: 123, sw: 2560, sh: 1600, sr: 6 }, wl: 1280 },
    // Sky Blue and Space Black are Apple's own bezels, as shipped - the notch is painted into
    // the art inside the screen rect, exactly like the iPhone's Dynamic Island, so the page
    // renders behind it. Both open onto the full display: macOS has no status bar of ours to
    // reserve, so there is no `sb` here.
    { id: "macbookair", label: 'MacBook Air 13" (Sky Blue)', cat: "Apple - real frames", type: "image", desk: true,
      frame: { file: "macbook-air-sky-blue.png", fw: 3400, fh: 2240, ox: 420, oy: 288, sw: 2560, sh: 1664, sr: 6 }, wl: 1280 },
    // Apple has never published a gold bezel, so this one stays derived from the silver art by
    // scripts/recolor-frame.mjs - the last finish that still needs it.
    { id: "macbookairgold", label: 'MacBook Air 13" (Gold)', cat: "Apple - real frames", type: "image", desk: true,
      frame: { file: "macbook-air-gold.png", fw: 3306, fh: 1897, ox: 373, oy: 123, sw: 2560, sh: 1600, sr: 6 }, wl: 1280 },
    { id: "macbookpro16", label: 'MacBook Pro 16" (Space Black)', cat: "Apple - real frames", type: "image", desk: true,
      frame: { file: "macbook-pro-16-space-black.png", fw: 4260, fh: 2840, ox: 402, oy: 303, sw: 3456, sh: 2234, sr: 6 }, wl: 1728 },
    { id: "imac", label: 'iMac 24"', cat: "Apple - real frames", type: "image", desk: true,
      frame: { file: "imac.png", fw: 4880, fh: 5720, ox: 200, oy: 1600, sw: 4480, sh: 2520, sr: 6 }, wl: 1280 },
    { id: "studiodisplay", label: "Studio Display", cat: "Apple - real frames", type: "image", desk: true,
      frame: { file: "apple-display.png", fw: 5520, fh: 4316, ox: 200, oy: 200, sw: 5120, sh: 2880, sr: 6 }, wl: 1440 },
    { id: "watch", label: "Apple Watch Ultra 3", cat: "Apple - real frames", type: "image",
      frame: { file: "apple-watch-ultra-3.png", fw: 600, fh: 960, ox: 89, oy: 223, sw: 422, sh: 514, sr: 129 }, wl: 211 },
    // --- Drawn bezels for devices we have no PNG for ---
    { id: "zfold",  label: "Galaxy Z Fold (open)",cat: "Drawn", type: "fold",  w: 884, h: 800, cam: "punch", p: [10, 10, 10, 10], out: 20, scr: 8, rot: true, sb: { top: 9, h: 32, padX: 34, font: 17, glyph: 15 } },
    // --- Custom ---
    { id: "custom", label: "Custom size…", cat: "Custom", type: "frame", w: 1280, h: 800, cam: "none", p: [10, 10, 10, 10], out: 14, scr: 6, rot: true },
  ];

  const ICONS = {
    rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>',
    reload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    caret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5l6 6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.6l4.6 4.6L19 7"/></svg>',
  };

  // Device silhouettes for the picker rows - same 24px stroke vocabulary as ICONS, so the
  // menu reads as one system with the toolbar. Names alone are not enough: two iPads and two
  // Duos look identical in a text list, and the outline tells them apart at a glance.
  const GLYPHS = {
    iphone: '<rect x="7.5" y="2.5" width="9" height="19" rx="2.6"/><path d="M10.4 4.9h3.2"/>',
    ipadpro: '<rect x="3.5" y="2.5" width="17" height="19" rx="2"/>',
    ipada16: '<rect x="5.5" y="4" width="13" height="16" rx="2"/>',
    macbook: '<rect x="4.5" y="4" width="15" height="11" rx="1.4"/><path d="M2 18.6h20"/>',
    macbookair: '<rect x="5.6" y="4.8" width="12.8" height="9.6" rx="1.3"/><path d="M3 18.2h18"/>',
    // widest lid of the three, plus the Pro's notch - the only thing that tells it from the Air
    // at 24px once both are stroked the same
    macbookpro16: '<rect x="3.2" y="3.4" width="17.6" height="12.2" rx="1.4"/>' +
      '<path d="M10.4 3.4h3.2v1.3h-3.2z" fill="currentColor" stroke="none"/><path d="M1 19.2h22"/>',
    macbookairgold: '<rect x="5.6" y="4.8" width="12.8" height="9.6" rx="1.3"/><path d="M3 18.2h18"/>',
    imac: '<rect x="2.5" y="3" width="19" height="13" rx="1.6"/><path d="M2.5 12.4h19"/><path d="M12 16v3.2M8.6 19.6h6.8"/>',
    studiodisplay: '<rect x="2.5" y="3.6" width="19" height="11.4" rx="1.4"/><path d="M12 15v4.4M8.6 19.6h6.8"/>',
    iphoneduo: '<rect x="7.5" y="2.5" width="9" height="19" rx="2.6"/><path d="M9.9 2.5v19"/>',
    iphoneduoopen: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.4"/><path d="M12 4.5v15" stroke-dasharray="2 2.2"/>',
    watch: '<rect x="7.5" y="6.5" width="9" height="11" rx="3"/><path d="M9.4 6.5l.4-3.5h4.4l.4 3.5M9.4 17.5l.4 3.5h4.4l.4-3.5"/><path d="M16.9 10.6h1.3"/>',
    zfold: '<rect x="2.5" y="4.5" width="19" height="15" rx="1.4"/><path d="M12 4.5v15"/><circle cx="17.2" cy="8" r=".9"/>',
    duobutterfly: '<path d="M3 5.2l9 3 9-3v13.6l-9-3-9 3z"/><path d="M12 8.2v10.6"/>',
    duodesk: '<path d="M2.5 18.5L5.2 6.5h12.6l2.7 12z"/><path d="M17.8 6.5l3.7 12h-1"/>',
    duolaptop: '<rect x="5.2" y="3.8" width="13.6" height="9.6" rx="1.4"/><path d="M4.2 13.4h15.6l2.2 5.4H2z"/>',
    custom: '<rect x="3" y="5" width="18" height="14" rx="2" stroke-dasharray="3 2.6"/>',
  };
  const devGlyph = (id) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    (GLYPHS[id] || GLYPHS.custom) +
    "</svg>";


  // iOS status-bar glyphs (cellular, wifi, battery) - inherit color via currentColor.
  // Status-bar and Safari glyphs are the REAL SF Symbols, exported from macOS by
  // scripts/extract-sf-symbols.swift. Each PNG is white-on-transparent: the alpha channel is
  // Apple's artwork and CSS paints it through a mask with currentColor, so one file serves
  // both the light and the dark bar. Redrawing these by hand never quite matches, and a
  // slightly-wrong wifi arc or share box is what makes a mockup read as a knock-off.
  const glyph = (file, w, h, cls) =>
    `<i class="${cls}" style="--m:url(${FRAMES_BASE}${file});--ar:${w}/${h}"></i>`;

  const SB_ICONS =
    glyph("sf-cellularbars.png", 256, 169, "df-g df-sb-g") +
    glyph("sf-wifi.png", 256, 185, "df-g df-sb-g") +
    '<span class="df-sb-batt">' +
      glyph("sf-battery.png", 256, 121, "df-g df-sb-g df-sb-battg") +
      '<span class="df-sb-pct">100</span>' +
    "</span>";

  // Safari bottom-chrome glyphs.
  const SF_ICONS = {
    lock: glyph("sf-lock.png", 220, 256, "df-g"),
    reload: glyph("sf-reload.png", 217, 256, "df-g"),
    back: glyph("sf-back.png", 185, 256, "df-g"),
    forward: glyph("sf-forward.png", 185, 256, "df-g"),
    share: glyph("sf-share.png", 218, 256, "df-g"),
    book: glyph("sf-book.png", 256, 201, "df-g"),
    tabs: glyph("sf-tabs.png", 256, 231, "df-g"),
  };

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  // sbLight = light glyphs on a dark band. Set automatically from the framed page, the way iOS
  // styles the status bar from what sits under it; pageBg is that page colour and paints the
  // band, so the bar reads as the app's own.
  const state = { deviceId: "iphoneduoopen", landscape: false, customW: 1280, customH: 800, sbLight: true, pageBg: "" };

  // ---- toolbar ----
  const root = el("div", "");
  root.id = "emulator-root";

  const bar = el("div", "df-bar");
  const brand = el("div", "df-brand", '<span class="df-dot"></span>EMULATOR');

  // A native <select> cannot put an icon on a row, so a picker is a real listbox:
  // silhouette + name. Two of them - the device, and (for a family like the Duo) its view mode.
  const pickers = [];
  const closePops = () => pickers.forEach((p) => p.list.classList.remove("df-show"));
  const popOpen = () => pickers.some((p) => p.list.classList.contains("df-show"));
  function makePick() {
    const box = el("div", "df-pick");
    const btn = el("button", "df-pick-btn");
    const icon = el("span", "df-pick-icon");
    const label = el("span", "df-pick-label");
    btn.append(icon, label, el("span", "df-pick-caret", ICONS.caret));
    const list = el("div", "df-pop");
    box.append(btn, list);
    const p = { box, btn, icon, label, list };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.remove("df-show");
      const open = list.classList.contains("df-show"); // one list open at a time
      closePops();
      list.classList.toggle("df-show", !open);
    });
    list.addEventListener("click", (e) => e.stopPropagation());
    pickers.push(p);
    return p;
  }
  const row = (id) =>
    el("button", "df-po",
      `<span class="df-po-icon">${devGlyph(id)}</span><span class="df-po-name"></span>` +
      `<span class="df-po-check">${ICONS.check}</span>`);

  // A device family collapses to ONE row in the device list; its members live in the mode
  // dropdown next to it, so the Duo reads as one device you can hold five ways.
  const FAMS = { duo: { label: "iPhone Duo", def: "iphoneduoopen", glyph: "iphoneduoopen" } };
  const famHead = (fam) => DEVICES.find((x) => x.fam === fam);
  // Every Apple bezel in a family is exported at the same 3x, so frame px are physically
  // comparable: the closed Duo really is half the width of the open one. fit() draws a family
  // at ONE scale - the one that fits its largest art - so the members keep those proportions
  // instead of each filling the stage on its own.
  Object.keys(FAMS).forEach((k) => {
    FAMS[k].ref = Math.max(...DEVICES.filter((x) => x.fam === k && x.frame)
      .map((x) => Math.max(x.frame.fw, x.frame.fh, x.frameL ? x.frameL.fw : 0, x.frameL ? x.frameL.fh : 0)));
  });

  const pick = makePick();
  const rows = {};
  // bucket by category first - zfold sits mid-array, so a running "did the cat change" check
  // would print the Apple header twice
  const cats = {};
  DEVICES.forEach((d) => {
    if (d.fam && famHead(d.fam) !== d) return; // the rest of the family is in the mode list
    const fam = d.fam ? FAMS[d.fam] : null;
    if (!cats[d.cat]) { cats[d.cat] = el("div", "df-grp"); pick.list.append(el("div", "df-og", d.cat), cats[d.cat]); }
    const r = row(fam ? fam.glyph : d.id);
    r.dataset.id = d.id;
    r.querySelector(".df-po-name").textContent = fam ? fam.label : d.label;
    r.addEventListener("click", () => {
      closePops();
      const id = fam ? fam.def : d.id;
      if (id === state.deviceId) return;
      state.deviceId = id;
      render(true);
    });
    rows[d.id] = r;
    cats[d.cat].append(r);
  });

  // view modes for the selected family (hidden for every single-mode device)
  const modePick = makePick();
  const modeRows = {};
  const modeGrp = el("div", "df-grp");
  modePick.list.append(modeGrp);
  DEVICES.filter((d) => d.fam).forEach((d) => {
    const r = row(d.id);
    r.dataset.id = d.id;
    r.querySelector(".df-po-name").textContent = d.mode;
    r.addEventListener("click", () => {
      closePops();
      if (d.id === state.deviceId) return;
      state.deviceId = d.id;
      render(true);
    });
    modeRows[d.id] = r;
    modeGrp.append(r);
  });

  const custom = el("div", "df-custom");
  const inW = document.createElement("input");
  const inH = document.createElement("input");
  inW.type = inH.type = "number";
  inW.value = state.customW;
  inH.value = state.customH;
  inW.min = inH.min = "80";
  custom.append(inW, el("span", "", "×"), inH);

  const rotateBtn = el("button", "df-btn", ICONS.rotate);
  rotateBtn.title = "Rotate portrait / landscape";
  const dlBtn = el("button", "df-btn df-dl", ICONS.download);
  dlBtn.title = "Download or copy - PNG / WebP, transparent background";
  const copyBtn = el("button", "df-btn", ICONS.copy);
  copyBtn.title = "Copy image (transparent PNG)";
  const closeBtn = el("button", "df-btn df-close", ICONS.close);
  closeBtn.title = "Close (Esc)";

  // no reload button: Cmd/Ctrl+R reloads the framed page (and the iPhone's Safari bar has its own)
  bar.append(brand, el("div", "df-sep"), pick.box, modePick.box, custom, el("div", "df-sep"), rotateBtn, copyBtn, dlBtn, el("div", "df-sep"), closeBtn);

  // download menu (PNG / WebP) + toast, both docked under the HUD
  const menu = el("div", "df-menu");
  const miPng = el("button", "df-mi", "<b>PNG</b><span>transparent background</span>");
  const miWebp = el("button", "df-mi", "<b>WebP</b><span>lossless, half the size</span>");
  // Chrome's clipboard takes image/png and nothing else - writing image/webp throws
  // "Type image/webp not supported" - so the copy is always a PNG, and says so.
  const miCopy = el("button", "df-mi", "<b>Copy</b><span>transparent PNG to clipboard</span>");
  menu.append(miPng, miWebp, miCopy);
  const toastEl = el("div", "df-toast");

  // ---- stage + rig ----
  const stage = el("div", "df-stage");
  // Studio backdrop (pure CSS) - only shown for Mac display frames (see .df-desk).
  const backdrop = el("div", "df-backdrop");
  const scaler = el("div", "df-scaler");
  const rig = el("div", "df-rig");

  const bandTop = el("div", "df-band df-band-top");
  const device = el("div", "df-device");
  const lapBase = el("div", "df-lap-base");
  const standNeck = el("div", "df-stand-neck");
  const standFoot = el("div", "df-stand-foot");
  const bandBot = el("div", "df-band df-band-bot");

  const screen = el("div", "df-screen");
  const cam = el("div", "df-cam");
  const home = el("div", "df-home");
  const crown = el("div", "df-crown");
  const crease = el("div", "df-crease");
  const frameImg = document.createElement("img"); // photoreal PNG frame (image devices)
  frameImg.className = "df-frameimg";
  const sbScrim = el("div", "df-sb-scrim"); // legibility scrim behind the status bar
  const statusbar = el("div", "df-statusbar"); // iOS-style status bar for image phones/tablets
  const sbTime = el("span", "df-sb-time", "9:41");
  const sbInd = el("span", "df-sb-ind", SB_ICONS);
  statusbar.append(sbTime, sbInd);

  // ---- Safari bottom chrome (URL pill + toolbar), for image phones with a `sf` config ----
  const safariBar = el("div", "df-safari");
  const sfPill = el("div", "df-sf-pill");
  const sfAa = el("span", "df-sf-aa", glyph("sf-textformat.png", 256, 161, "df-g"));
  const sfLock = el("span", "df-sf-lock", SF_ICONS.lock);
  const sfHost = el("span", "df-sf-host", "");
  const sfMid = el("span", "df-sf-mid");
  sfMid.append(sfLock, sfHost);
  const sfReload = el("span", "df-sf-reload", SF_ICONS.reload);
  const sfProg = el("div", "df-sf-prog"); // Safari's blue page-load line under the URL
  sfPill.append(sfAa, sfMid, sfReload, sfProg);
  const sfTools = el("div", "df-sf-tools");
  ["back", "forward", "share", "book", "tabs"].forEach((k) =>
    sfTools.append(el("span", "df-sf-tool", SF_ICONS[k]))
  );
  const sfHome = el("div", "df-sf-home");
  safariBar.append(sfPill, sfTools, sfHome);
  const blocked = el(
    "div",
    "df-blocked",
    "<strong>This page may block embedding</strong><span>Some sites refuse to load inside a frame (X-Frame-Options / CSP). Try one of your own pages or a site that allows it.</span>"
  );
  const iframe = document.createElement("iframe");
  iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
  iframe.allow = "geolocation; microphone; camera; fullscreen; clipboard-read; clipboard-write";

  // ---- iPhone Duo poses: the open bezel cut at the hinge and hinged in 3D ----
  // A real fold needs two planes, and one iframe cannot sit on two planes - so each half gets
  // its own copy of the frame art and its own iframe on the same URL. Both render the page at
  // the same logical width, so the halves line up and read as one continuous screen; scrolling
  // is mirrored between them whenever the framed page is same-origin.
  const poseBox = el("div", "df-pose");
  const poseCam = el("div", "df-pose-cam"); // yaw/pitch for the whole rig - where you stand
  poseBox.append(poseCam);
  const makeHalf = () => {
    const wrap = el("div", "df-pose-half");
    const pane = el("div", "df-pose-pane");
    const scr = el("div", "df-screen");
    const ifr = document.createElement("iframe");
    ifr.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    const img = document.createElement("img");
    img.className = "df-frameimg";
    const gloss = el("div", "df-pose-shade"); // over the screen, clipped to its rounded rect
    const shade = el("div", "df-pose-shade"); // over the bezel, masked to the frame art's alpha
    scr.append(ifr, gloss);
    pane.append(scr, img, shade);
    wrap.append(pane);
    poseCam.append(wrap);
    return { wrap, pane, scr, ifr, img, gloss, shade };
  };
  const halfA = makeHalf();
  const halfB = makeHalf();

  screen.append(iframe, cam, home, crease, blocked);
  device.append(screen, sbScrim, statusbar, safariBar, crown, frameImg);
  bandTop.style.order = "0"; device.style.order = "1"; lapBase.style.order = "2";
  standNeck.style.order = "3"; standFoot.style.order = "4"; bandBot.style.order = "5";
  rig.append(bandTop, device, lapBase, standNeck, standFoot, bandBot, poseBox);
  const spinner = el("div", "df-spinner"); // shown behind/over the device while the page loads
  scaler.append(rig);
  stage.append(backdrop, scaler, spinner);

  root.append(bar, menu, stage, toastEl);
  document.documentElement.appendChild(root);

  // ---- rendering ----
  const current = () => {
    const d = DEVICES.find((x) => x.id === state.deviceId) || DEVICES[0];
    if (d.id === "custom") return { ...d, w: state.customW, h: state.customH };
    return d;
  };

  // The logical viewport (what the site "sees") for either device kind.
  function logicalDims(d) {
    if (d.frame) {
      // synthesized landscape (rotated portrait frame) -> swap the portrait logical dims
      if (d.rot && state.landscape && !d.frameL) {
        const fr = d.frame;
        return { w: Math.round((fr.sh * d.wl) / fr.sw), h: d.wl };
      }
      const land = d.rot && state.landscape && d.frameL;
      const fr = land ? d.frameL : d.frame;
      const wl = land ? d.wlL : d.wl;
      return { w: wl, h: Math.round((fr.sh * wl) / fr.sw) };
    }
    const land = d.rot && state.landscape;
    return land ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
  }

  let loadTimer = null;

  // Position the status bar + scrim over a screen rect, in whatever coordinate space the
  // caller uses (frame-native px for image devices, logical px for drawn devices).
  function placeStatusBar(ox, oy, sw, sb) {
    if (!sb) {
      statusbar.style.setProperty("display", "none", "important");
      sbScrim.style.setProperty("display", "none", "important");
      return;
    }
    const light = state.sbLight;
    statusbar.style.cssText =
      `display:flex !important;position:absolute !important;box-sizing:border-box !important;` +
      `left:${ox + sb.padX}px !important;top:${oy + sb.top}px !important;` +
      `width:${sw - sb.padX * 2}px !important;height:${sb.h}px !important;` +
      `align-items:center !important;justify-content:space-between !important;` +
      `z-index:5 !important;color:${light ? "#fff" : "#000"} !important;`;
    sbTime.style.setProperty("font-size", sb.font + "px", "important");
    sbInd.style.setProperty("font-size", sb.glyph + "px", "important");
    // battery % number sits inside the battery fill, so it needs the opposite color
    statusbar.style.setProperty("--sb-num", light ? "#000" : "#fff");
    const scrimH = Math.round((sb.top + sb.h) * 1.7);
    const grad = light
      ? "linear-gradient(180deg, rgba(0,0,0,0.42), rgba(0,0,0,0))"
      : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))";
    sbScrim.style.cssText =
      `display:block !important;position:absolute !important;` +
      `left:${ox}px !important;top:${oy}px !important;` +
      `width:${sw}px !important;height:${scrimH}px !important;` +
      `z-index:4 !important;pointer-events:none !important;background:${grad} !important;`;
  }

  // Safari bottom chrome, docked at the screen bottom in frame-native px. Theme follows the
  // status-bar toggle (dark by default) so it reads like the iOS Safari simulator.
  function placeSafariBar(ox, oy, sw, sh, sf, host, secure, r) {
    if (!sf) {
      safariBar.style.setProperty("display", "none", "important");
      return;
    }
    const dark = state.sbLight;
    const top = oy + sh - sf.h;
    const rad = r || 0;
    safariBar.style.cssText =
      `display:flex !important;position:absolute !important;box-sizing:border-box !important;` +
      `left:${ox}px !important;top:${top}px !important;width:${sw}px !important;height:${sf.h}px !important;` +
      `border-radius:0 0 ${rad}px ${rad}px !important;overflow:hidden !important;` +
      `font-size:${sf.u}px !important;z-index:5 !important;`;
    safariBar.style.setProperty("--sf-bg", dark ? "#000000" : "#f6f6f8");
    safariBar.style.setProperty("--sf-pill", dark ? "#2c2c2e" : "#ffffff");
    safariBar.style.setProperty("--sf-text", dark ? "#f5f5f7" : "#1c1c1e");
    safariBar.style.setProperty("--sf-icon", dark ? "#cfcfd4" : "#48484a");
    safariBar.style.setProperty("--sf-dim", dark ? "#8e8e93" : "#8a8a8e");
    safariBar.style.setProperty("--sf-home", dark ? "#ffffff" : "#1c1c1e");
    sfHost.textContent = host || "";
    sfLock.style.setProperty("display", secure ? "inline-flex" : "none", "important");
  }

  function renderImage(d) {
    // Landscape requested but no dedicated landscape frame -> synthesize by rotating the portrait PNG.
    if (d.rot && state.landscape && !d.frameL) return renderImageRotated(d);

    const land = d.rot && state.landscape && d.frameL;
    const fr = land ? d.frameL : d.frame;
    const wl = land ? d.wlL : d.wl;
    const k = fr.sw / wl; // scale the logical iframe up to fill the screen rect
    const sb = fr.sb;
    const zone = sb ? Math.round(sb.top + sb.h) : 0; // status-bar band reserved at top (frame px)
    const sfH = fr.sf ? Math.round(fr.sf.h) : 0; // Safari chrome reserved at bottom (frame px)
    const hl = Math.round((fr.sh - zone - sfH) / k); // logical page height between the two

    rig.setAttribute("data-type", "image");
    // hide every drawn accessory
    [crease, lapBase, standNeck, standFoot, bandTop, bandBot, crown, home, cam].forEach((n) =>
      n.style.setProperty("display", "none", "important")
    );
    // device = the frame canvas, no CSS bezel
    device.style.cssText = `position:relative !important;width:${fr.fw}px !important;height:${fr.fh}px !important;background:none !important;border-radius:0 !important;box-shadow:none !important;padding:0 !important;`;
    // screen = the exact screen rect, clipped to rounded corners so nothing pokes past the bezel.
    // Its background fills the status-bar band (like a native app bar); the iframe sits below it.
    const bandColor = sb ? pageBg() : "transparent";
    // round the BOTTOM corners only (where content used to poke out); the top fills square
    // up under the bezel so there's no black gap / ugly curve behind the status bar.
    const r = fr.sr || 0;
    // Make the iframe a scrollbar-width wider than the screen so the desktop scrollbar lands
    // just past the clipped edge and stays hidden - real devices use space-less overlay bars.
    // Not for Mac displays: a real MacBook hands the page exactly `wl` CSS px, and a page that
    // never scrolls (so no scrollbar to hide) would lose its last 15px past the bezel.
    const SBW = d.desk ? 0 : scrollbarWidth();
    // ot = top of the PNG's real screen opening when it sits above oy (iPhone: oy is 150px below
    // the bezel so the status bar clears the island). The screen must cover that cap too, or the
    // island floats on the stage charcoal instead of on the screen. Cap > 0 rounds the top corners.
    const cap = fr.ot != null ? fr.oy - fr.ot : 0;
    // Round all four corners. An Apple Design Resources bezel punches the display out as a
    // SQUARE hole and paints the rounded corners as art, so a square-cornered screen bleeds
    // its backing colour out past the device body at the top. Clip to the real corner radius.
    const radius = `${r}px`;
    screen.style.cssText = `position:absolute !important;left:${fr.ox}px !important;top:${fr.oy - cap}px !important;width:${fr.sw}px !important;height:${fr.sh + cap}px !important;background:${bandColor} !important;border-radius:${radius} !important;overflow:hidden !important;`;
    iframe.style.cssText = `position:absolute !important;left:0 !important;top:${zone + cap}px !important;width:${wl + SBW}px !important;height:${hl}px !important;border:0 !important;background:${pageBg()} !important;transform-origin:0 0 !important;transform:scale(${k}) !important;`;
    frameImg.style.cssText = ""; // clear any landscape-rotation transform
    frameImg.style.setProperty("display", "block", "important");
    const url = FRAMES_BASE + fr.file;
    if (frameImg.getAttribute("src") !== url) frameImg.src = url;

    if (statusbar.parentNode !== device) device.appendChild(statusbar);
    placeStatusBar(fr.ox, fr.oy, fr.sw, fr.sb);
    // the screen background is the status-bar band now, so the legibility scrim is redundant
    sbScrim.style.setProperty("display", "none", "important");

    // Safari bottom chrome with the framed page's real domain
    const { host, secure } = framedHost();
    placeSafariBar(fr.ox, fr.oy, fr.sw, fr.sh, fr.sf, host, secure, fr.sr);
  }

  // Width a classic (space-taking) scrollbar steals from the framed page. macOS overlay bars
  // measure 0; widening the iframe by a fixed 17px there just laid the page out off-center.
  let sbwCache = null;
  function scrollbarWidth() {
    if (sbwCache != null) return sbwCache;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;";
    document.body.appendChild(probe);
    sbwCache = probe.offsetWidth - probe.clientWidth;
    probe.remove();
    return sbwCache;
  }

  // Screen fill behind the framed page. Where the page paints nothing (short body, no html
  // background) this shows through, so it follows the status-bar theme: dark by default.
  const pageBg = () => state.pageBg || (state.sbLight ? "#0b0b0c" : "#ffffff");

  // iOS picks the status bar style from what is under it. Sample the framed page's own
  // background at the top of its viewport - same-origin only; a cross-origin page falls back
  // to the system scheme - then paint the band in that colour with contrasting glyphs. Sampled
  // at load and once more after the page has had a moment to hydrate.
  function sampleBg(f) {
    try {
      const w = f.contentWindow;
      const d = w.document;
      let el = d.elementFromPoint(w.innerWidth / 2, 1) || d.body;
      for (; el; el = el.parentElement) {
        const m = w.getComputedStyle(el).backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        if (m && (m[4] === undefined || +m[4] > 0.5)) return [+m[1], +m[2], +m[3]];
      }
      return [255, 255, 255]; // nothing painted - the canvas is white
    } catch (_) {
      return null;
    }
  }
  function autoTheme(f) {
    const rgb = sampleBg(f);
    const dark = rgb
      ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const bg = rgb ? `rgb(${rgb.join(",")})` : "";
    if (state.sbLight === dark && state.pageBg === bg) return;
    state.sbLight = dark;
    state.pageBg = bg;
    render(false);
  }

  // The framed page's URL as Safari shows it (host:port + path + query, minus protocol/www);
  // the pill ellipsis-truncates it when it runs past the available width.
  function framedHost() {
    try {
      const u = new URL(window.__DF_SRC || location.href, location.href);
      const host = (u.host.replace(/^www\./, "") + u.pathname + u.search).replace(/\/$/, "") || u.host;
      return { host, secure: u.protocol === "https:" };
    } catch (_) {
      return { host: "", secure: true };
    }
  }

  // Landscape for an image device that has no dedicated landscape PNG: rotate the portrait
  // frame 90deg CW and lay the page out landscape in the rotated screen rect, with the same
  // status bar on top and Safari chrome at the bottom as portrait.
  function renderImageRotated(d) {
    const fr = d.frame;
    const kP = fr.sw / d.wl; // portrait scale
    const wl = Math.round(fr.sh / kP); // landscape logical width  (= portrait logical height)
    const k = fr.sh / wl; // scale to fill the (rotated) screen width
    const sb = fr.sb;
    const zone = sb ? Math.round(sb.top + sb.h) : 0; // status-bar band reserved at top (frame px)
    const sfH = fr.sf ? Math.round(fr.sf.h) : 0; // Safari chrome reserved at bottom (frame px)
    const hl = Math.round((fr.sw - zone - sfH) / k); // logical page height between the two
    const SBW = scrollbarWidth();

    rig.setAttribute("data-type", "image");
    [crease, lapBase, standNeck, standFoot, bandTop, bandBot, crown, home, cam].forEach((n) =>
      n.style.setProperty("display", "none", "important")
    );

    // device box is the rotated frame: fh wide x fw tall
    device.style.cssText = `position:relative !important;width:${fr.fh}px !important;height:${fr.fw}px !important;background:none !important;border-radius:0 !important;box-shadow:none !important;padding:0 !important;`;

    // screen rect mapped through a 90deg CW rotation of the portrait frame. The cap above oy
    // (island zone) lands on the RIGHT: the screen covers it too, so the band color runs as one
    // straight strip holding the island and the corners round only at the bezel.
    const cap = fr.ot != null ? fr.oy - fr.ot : 0;
    const sLeft = fr.fh - fr.oy - fr.sh;
    const sTop = fr.ox;
    const sW = fr.sh + cap;
    const sH = fr.sw;
    const r = fr.sr || 0;
    const bandColor = sb ? pageBg() : "#000";
    screen.style.cssText = `position:absolute !important;left:${sLeft}px !important;top:${sTop}px !important;width:${sW}px !important;height:${sH}px !important;background:${bandColor} !important;border-radius:${r}px !important;overflow:hidden !important;`;
    iframe.style.cssText = `position:absolute !important;left:0 !important;top:${zone}px !important;width:${wl + SBW}px !important;height:${hl}px !important;border:0 !important;background:${pageBg()} !important;transform-origin:0 0 !important;transform:scale(${k}) !important;`;

    // the portrait PNG rotated 90deg CW, translated back into the device box
    frameImg.style.cssText = `position:absolute !important;left:0 !important;top:0 !important;width:${fr.fw}px !important;height:${fr.fh}px !important;transform-origin:0 0 !important;transform:translate(${fr.fh}px,0) rotate(90deg) !important;pointer-events:none !important;z-index:6 !important;display:block !important;`;
    const url = FRAMES_BASE + fr.file;
    if (frameImg.getAttribute("src") !== url) frameImg.src = url;

    if (statusbar.parentNode !== device) device.appendChild(statusbar);
    placeStatusBar(sLeft, sTop, sW, sb);
    sbScrim.style.setProperty("display", "none", "important");
    const { host, secure } = framedHost();
    placeSafariBar(sLeft, sTop, sW, sH, fr.sf, host, secure, r);
  }

  function renderDrawn(d) {
    frameImg.style.setProperty("display", "none", "important");
    safariBar.style.setProperty("display", "none", "important");
    device.style.cssText = "";
    screen.style.cssText = "";
    iframe.style.cssText = "";

    const land = d.rot && state.landscape;
    const w = land ? d.h : d.w;
    const h = land ? d.w : d.h;
    const [pt, pr, pb, pl] = d.p;

    // The screen gets EXPLICIT dimensions and the iframe is absolutely positioned inside it.
    // (A margin-top inset silently fails here - it collapses / loses to sticky page navs.)
    // zone = status-bar band the page sits below; SBW widens the iframe so the desktop
    // scrollbar lands just past the clipped edge and stays hidden (like a real device).
    const zone = d.sb && !land ? d.sb.top + d.sb.h : 0;
    const SBW = scrollbarWidth();
    screen.style.position = "relative";
    screen.style.width = w + "px";
    screen.style.height = h + "px";
    iframe.style.position = "absolute";
    iframe.style.left = "0";
    iframe.style.top = zone + "px";
    iframe.style.width = w + SBW + "px";
    iframe.style.height = h - zone + "px";
    iframe.style.border = "0";
    iframe.style.setProperty("background", pageBg(), "important"); // the stylesheet's #fff is !important
    device.style.padding = land ? `${pl}px ${pt}px ${pl}px ${pt}px` : `${pt}px ${pr}px ${pb}px ${pl}px`;
    device.style.borderRadius = d.out + "px";
    device.setAttribute("data-side", d.side ? "1" : "0");
    screen.style.borderRadius = d.scr + "px";
    rig.setAttribute("data-type", d.type);

    cam.setAttribute("data-cam", d.cam);
    cam.style.cssText = land && d.cam !== "none" && d.cam !== "lapnotch"
      ? "top:50% !important;left:10px !important;transform:translateY(-50%) rotate(90deg) !important;"
      : "";

    if (d.home) {
      home.style.cssText = land
        ? "display:block !important;top:50% !important;right:8px !important;left:auto !important;bottom:auto !important;transform:translateY(-50%) !important;"
        : "display:block !important;";
    } else {
      home.style.display = "none";
    }

    const ow = w + (land ? pt + pb : pl + pr);
    const showEl = (node, on) => node.style.setProperty("display", on ? "block" : "none", "important");
    showEl(crease, d.type === "fold");
    showEl(lapBase, d.type === "laptop");
    if (d.type === "laptop") lapBase.style.width = Math.round(ow * 1.16) + "px";
    showEl(standNeck, d.type === "display");
    showEl(standFoot, d.type === "display");
    const isWatch = d.type === "watch";
    showEl(bandTop, isWatch);
    showEl(bandBot, isWatch);
    showEl(crown, isWatch);

    // Status bar lives INSIDE the screen for drawn phones so it's always at the screen's top,
    // above the inset page - positioning it in device coords misaligns on thick-forehead phones
    // (iPhone 5/SE). Parent it to the screen and use screen-relative origin (0,0).
    if (statusbar.parentNode !== screen) screen.appendChild(statusbar);
    placeStatusBar(0, 0, w, !land ? d.sb : null);
    sbScrim.style.setProperty("display", "none", "important");
  }

  // Fold the open bezel into one of the Duo poses. Each half is a 3D plane pinned at the hinge:
  // a full copy of the flat render, clipped to its side of the art, rotated about the hinge line.
  // The box is sized to the PROJECTED bounds (perspective magnifies whatever leans forward) so
  // fit() scales a pose like any other device and capture() crops it whole.
  const deg2rad = (t) => (t * Math.PI) / 180;
  // Two planes that meet exactly on the hinge leave a hairline (and a notch in the bezel) as
  // soon as they rotate apart. Each half carries BLEED px of art PAST the hinge so they overlap
  // and connect back into one body - at 3x art that is ~3 logical px of shared page, invisible.
  const BLEED = 10;
  // While the two copies load, neither is cut at the hinge and the rig is invisible: the page's
  // own IntersectionObserver treats a hinge clip as "off screen", so a copy that only shows its
  // half of the rows would lazy-mount different sections than its twin and the two would end
  // up different heights. Unclipped, both see the same full viewport and mount the same things;
  // the clip goes on once both have landed. After that, scrolling keeps them equal because a
  // section always enters the leader's band before it reaches the crease.
  let poseUnclipped = false;
  const poseLoaded = new Set();
  function renderPose(d) {
    const fr = d.frame;
    const wl = d.wl;
    const vert = d.axis === "y";
    const half = (vert ? fr.fw : fr.fh) / 2; // the hinge runs down the middle of the art
    // a solo pose lays the page out to the width of the half you actually see
    const k = (vert && d.solo ? half - fr.ox : fr.sw) / wl; // logical px -> frame px
    const sb = d.sbHalf ? fr.sb : null;
    const zone = sb ? Math.round(sb.top + sb.h) : 0; // status-bar band, reserved on BOTH halves
    // The rect of art the page paints into. Normally the whole screen, both halves live and the
    // page runs across the crease. A `solo` pose hands the page to the half that faces the
    // viewer and leaves the other dark, so the page is laid out to the panel you actually see.
    const px0 = vert && d.solo === 2 ? half : fr.ox;
    const px1 = vert && d.solo === 1 ? half : fr.ox + fr.sw;
    const py0 = !vert && d.solo === 2 ? half : fr.oy;
    const py1 = !vert && d.solo === 1 ? half : fr.oy + fr.sh;
    const hl = Math.round((py1 - py0 - zone) / k);
    const P = d.persp;
    const yaw = deg2rad(d.yaw || 0);
    const pitch = deg2rad(d.pitch || 0);
    const cross = (vert ? fr.fh : fr.fw) / 2; // half the art ACROSS the hinge

    // Project a point of one half - measured from the hinge - through the whole chain: the
    // half's own hinge rotation, then the camera, then perspective. Sizing the box off the real
    // projected bounds is what keeps fit() honest and stops capture() clipping a near corner.
    const project = (u, v, angle) => {
      const t = deg2rad(angle); // u runs out from the hinge, v across it
      let x = vert ? u * Math.cos(t) : v;
      let y = vert ? v : u * Math.cos(t);
      let z = vert ? -u * Math.sin(t) : u * Math.sin(t);
      const xy = x * Math.cos(yaw) + z * Math.sin(yaw);
      z = -x * Math.sin(yaw) + z * Math.cos(yaw);
      x = xy;
      const yp = y * Math.cos(pitch) - z * Math.sin(pitch);
      z = y * Math.sin(pitch) + z * Math.cos(pitch);
      y = yp;
      const m = P / Math.max(P - z, P * 0.2); // perspective magnification at that depth
      return [x * m, y * m];
    };
    const pts = [];
    [[-half, d.a], [half, d.b]].forEach(([u, angle]) => {
      [0, u].forEach((uu) => [-cross, cross].forEach((vv) => pts.push(project(uu, vv, angle))));
    });
    const minX = Math.min(...pts.map((q) => q[0]));
    const maxX = Math.max(...pts.map((q) => q[0]));
    const minY = Math.min(...pts.map((q) => q[1]));
    const maxY = Math.max(...pts.map((q) => q[1]));
    const W = Math.round(maxX - minX);
    const H = Math.round(maxY - minY);
    const hx = Math.round(-minX); // where the hinge lands inside the box
    const hy = Math.round(-minY);

    rig.setAttribute("data-type", "pose");
    device.style.setProperty("display", "none", "important");
    [crease, lapBase, standNeck, standFoot, bandTop, bandBot].forEach((n) =>
      n.style.setProperty("display", "none", "important")
    );
    poseBox.style.cssText =
      `display:block !important;position:relative !important;width:${W}px !important;height:${H}px !important;` +
      `opacity:${poseUnclipped ? 0 : 1} !important;` +
      `perspective:${P}px !important;perspective-origin:${hx}px ${hy}px !important;`;
    poseCam.style.cssText =
      `position:absolute !important;inset:0 !important;transform-style:preserve-3d !important;` +
      `transform-origin:${hx}px ${hy}px !important;` +
      `transform:rotateX(${d.pitch || 0}deg) rotateY(${d.yaw || 0}deg) !important;`;

    const SBW = scrollbarWidth();
    const url = FRAMES_BASE + fr.file;
    [{ h: halfA, ang: d.a, first: true }, { h: halfB, ang: d.b, first: false }].forEach((s2) => {
      const { h, ang, first } = s2;
      // clip box: from the outer edge to BLEED px PAST the hinge, with the hinge (the rotation
      // axis) pinned at its real place inside that box
      const lead = first ? -half : -BLEED;
      const span = half + BLEED;
      const pin = first ? half : BLEED;
      // Cut at the hinge with a MASK, not overflow:hidden or clip-path. Those count as
      // clipping for an IntersectionObserver inside the page, so each copy would only "see" its
      // own rows and lazy-mounted sections would land in one half and not the other - the two
      // halves then differ in height and the crease stops lining up. A mask is paint only: the
      // page sees its whole viewport in both halves and mounts the same things.
      const cut = poseUnclipped ? "none" : "linear-gradient(#000,#000) 0 0/100% 100% no-repeat";
      h.wrap.style.cssText =
        `position:absolute !important;-webkit-mask:${cut} !important;mask:${cut} !important;` +
        (vert
          ? `left:${hx + lead}px !important;top:${hy - cross}px !important;width:${span}px !important;height:${fr.fh}px !important;`
          : `top:${hy + lead}px !important;left:${hx - cross}px !important;width:${fr.fw}px !important;height:${span}px !important;`) +
        `transform-origin:${vert ? pin + "px 50%" : "50% " + pin + "px"} !important;` +
        `transform:rotate${vert ? "Y" : "X"}(${ang}deg) !important;`;
      h.pane.style.cssText =
        `position:absolute !important;width:${fr.fw}px !important;height:${fr.fh}px !important;` +
        (vert
          ? `left:${first ? 0 : BLEED - half}px !important;top:0 !important;`
          : `top:${first ? 0 : BLEED - half}px !important;left:0 !important;`);
      h.scr.style.cssText =
        `position:absolute !important;left:${fr.ox}px !important;top:${fr.oy}px !important;` +
        `width:${fr.sw}px !important;height:${fr.sh}px !important;background:${pageBg()} !important;` +
        `border-radius:${fr.sr || 0}px !important;overflow:hidden !important;`;
      // the dark half of a solo pose keeps its bezel but drops the page entirely
      const lit = !d.solo || d.solo === (first ? 1 : 2);
      h.ifr.style.cssText =
        `position:absolute !important;left:${px0 - fr.ox}px !important;top:${py0 - fr.oy + zone}px !important;` +
        `width:${wl + SBW}px !important;height:${hl}px !important;border:0 !important;` +
        `display:${lit ? "block" : "none"} !important;` +
        `background:${pageBg()} !important;transform-origin:0 0 !important;transform:scale(${k}) !important;`;
      h.img.style.setProperty("display", "block", "important");
      if (h.img.getAttribute("src") !== url) h.img.src = url;
      // the hinge edge of each half falls into shadow, and a half turned away from the viewer
      // dims overall - together that is what reads as a bend rather than two flat pictures
      const dim = (1 - Math.cos(deg2rad(ang))) * 0.62;
      const dir = vert ? (first ? 90 : 270) : first ? 180 : 0;
      const wash =
        `background:linear-gradient(${dir}deg, rgba(0,0,0,${(dim * 0.8).toFixed(3)}) 35%, ` +
        `rgba(0,0,0,${Math.min(0.88, dim + 0.2).toFixed(3)}) 100%) !important;`;
      h.gloss.style.cssText =
        `position:absolute !important;inset:0 !important;z-index:8 !important;pointer-events:none !important;` + wash;
      // masking to the PNG keeps the wash on the device instead of on the stage behind it
      h.shade.style.cssText =
        `position:absolute !important;inset:0 !important;z-index:7 !important;pointer-events:none !important;` +
        `-webkit-mask:url("${url}") center/100% 100% no-repeat !important;` +
        `mask:url("${url}") center/100% 100% no-repeat !important;` + wash;
    });

    // The status bar rides the half that faces the viewer. On a vertical hinge it only owns its
    // own half, so the clock lands just off the crease instead of being clipped away with it.
    if (sb) {
      const host = d.sbHalf === 2 ? halfB : halfA;
      if (statusbar.parentNode !== host.pane) host.pane.appendChild(statusbar);
      placeStatusBar(px0, py0, px1 - px0, sb);
    } else {
      placeStatusBar(0, 0, 0, null);
    }
    sbScrim.style.setProperty("display", "none", "important");
    placeSafariBar(0, 0, 0, 0, null);
  }

  function render(reloadSrc) {
    const d = current();
    if (d.type !== "pose") poseBox.style.setProperty("display", "none", "important");
    if (d.type === "pose") renderPose(d);
    else if (d.type === "image") renderImage(d);
    else renderDrawn(d);

    rotateBtn.disabled = !d.rot;
    rotateBtn.classList.toggle("df-active", !!(d.rot && state.landscape));
    custom.classList.toggle("df-show", d.id === "custom");
    root.classList.toggle("df-desk", !!d.desk); // wallpaper backdrop for Mac displays only
    const fam = d.fam ? FAMS[d.fam] : null;
    pick.icon.innerHTML = devGlyph(fam ? fam.glyph : d.id);
    pick.label.textContent = fam ? fam.label : d.label;
    modePick.box.style.setProperty("display", fam ? "block" : "none", "important");
    modePick.icon.innerHTML = devGlyph(d.id);
    modePick.label.textContent = d.mode || "";
    const rowId = d.fam ? famHead(d.fam).id : d.id;
    Object.keys(rows).forEach((k) => rows[k].classList.toggle("df-on", k === rowId));
    Object.keys(modeRows).forEach((k) => modeRows[k].classList.toggle("df-on", k === d.id));

    if (reloadSrc) {
      blocked.classList.remove("df-show");
      spinner.classList.add("df-show"); // spin while the page loads
      sfProg.classList.remove("df-done");
      void sfProg.offsetWidth; // restart the line from 0 on every reload
      sfProg.classList.add("df-go");
      // __DF_SRC lets preview.html swap the page. Only the active renderer holds it - the idle
      // one drops to about:blank so the framed site is never left running twice in the dark.
      const src = window.__DF_SRC || location.href;
      const folded = d.type === "pose";
      iframe.src = folded ? "about:blank" : src;
      if (folded) { poseUnclipped = true; poseLoaded.clear(); }
      halfA.ifr.src = halfB.ifr.src = folded ? src : "about:blank";
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => {
        spinner.classList.remove("df-show");
        blocked.classList.add("df-show");
      }, 6000);
    }
    fit();
  }

  // Rotate portrait <-> landscape with a real spin: the current render turns 90deg (CW into
  // landscape, back CCW), then the true layout is swapped in underneath with transitions off.
  // fitScale() is orientation-independent for rotatable devices, so this is a pure spin - the
  // device never changes size - and the swap lands on the same scale with no jump.
  let rotating = false;
  function rotate() {
    const d = current();
    if (!d.rot || rotating) return;
    rotating = true;
    const toLand = !state.landscape;
    const rw = rig.offsetWidth || 1;
    const rh = rig.offsetHeight || 1;
    const next = fitScale(rw, rh, d);
    scaler.style.setProperty("transition", "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)", "important");
    scaler.style.transform = `scale(${next}) rotate(${toLand ? 90 : -90}deg)`;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      scaler.removeEventListener("transitionend", finish);
      scaler.style.setProperty("transition", "none", "important");
      state.landscape = toLand;
      render(false); // fit() lands on scale(next) with no rotation
      void scaler.offsetWidth; // flush before the transition comes back
      scaler.style.removeProperty("transition");
      rotating = false;
    };
    scaler.addEventListener("transitionend", finish);
    setTimeout(finish, 650); // transitionend can be swallowed (tab hidden) - never get stuck
  }

  // Scale that fits the rig in the stage. A rotatable device is measured off its LONG side
  // against the stage's SHORT side, so portrait and landscape resolve to the same number and
  // rotating spins the device without resizing it. Fixed devices just fit their own box.
  function fitScale(rw, rh, d) {
    const availW = stage.clientWidth - 24;
    const availH = stage.clientHeight - 24;
    const fam = d && d.fam ? FAMS[d.fam] : null;
    const base = fam
      ? Math.min(Math.min(availW, availH) / fam.ref, availW / rw, availH / rh) // family scale, never overflowing
      : d && d.rot
        ? Math.min(availW, availH) / Math.max(rw, rh)
        : Math.min(availW / rw, availH / rh);
    // 0.8 = sit the device at 80% so it's smaller with breathing room, centered in the stage
    return Math.min(base, 1) * 0.8;
  }

  function fit() {
    scaler.style.transform = `scale(${fitScale(rig.offsetWidth || 1, rig.offsetHeight || 1, current())})`;
  }

  // ---- export: PNG (transparent) / WebP / copy / share ----
  // Grabs the rendered pixels (the framed page is cross-origin, so only a tab capture can see
  // it) and crops to the rig with a little padding for the shadow.
  let capturing = false;
  const loadImage = (src) =>
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));
  async function capture() {
    if (capturing) return null;
    capturing = true;
    const d = current();
    const dim = logicalDims(d);
    root.classList.add("df-capturing");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const dpr = window.devicePixelRatio || 1;
    const box = rig.getBoundingClientRect();
    const pad = 26;
    let resp;
    try {
      resp = await chrome.runtime.sendMessage({ type: "df-capture" });
    } catch (e) {
      resp = { error: e && e.message };
    }
    root.classList.remove("df-capturing");
    let img = null;
    if (resp && resp.dataUrl) img = await loadImage(resp.dataUrl).catch(() => null);
    capturing = false;
    if (!img) {
      console.warn("[Emulator] capture failed:", resp && resp.error);
      toast("Capture failed");
      return null;
    }
    const sx = Math.max(0, Math.round((box.left - pad) * dpr));
    const sy = Math.max(0, Math.round((box.top - pad) * dpr));
    const sw = Math.min(img.width - sx, Math.round((box.width + pad * 2) * dpr));
    const sh = Math.min(img.height - sy, Math.round((box.height + pad * 2) * dpr));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return { canvas, ox: sx, oy: sy, dpr, d, dim };
  }

  // ---- native-resolution export ----
  // captureVisibleTab only ever hands back SCREEN pixels, so cropping a screenshot exports the
  // device at whatever fraction of its art fit() happened to shrink it to - measured at 79% of
  // the frame art on a Retina laptop and 39% on a 1x external monitor, which is not something
  // you want to post anywhere. For an image-frame device the export is REBUILT instead: the
  // bezel is redrawn from its own PNG at 1:1, so it is always pixel-exact, and only the page
  // inside the opening comes from a capture - taken with the rig blown up until one screen
  // pixel covers at least one frame pixel. When the blown-up opening no longer fits the window
  // it is captured in tiles and stitched. Each tile is cropped by the opening's MEASURED rect,
  // so none of this depends on where flexbox centred the device.
  const XPAD = 26; // shadow room around the device, in frame px
  const frameOf = (d) => (d.rot && state.landscape && d.frameL ? d.frameL : d.frame);
  // a rotate-synthesised landscape spins the art with CSS and has no 1:1 source to redraw
  const nativeOk = (d) => d.type === "image" && d.frame && !(d.rot && state.landscape && !d.frameL);

  async function captureNative(d) {
    const fr = frameOf(d);
    const dpr = window.devicePixelRatio || 1;
    const availW = Math.max(1, stage.clientWidth - 24);
    const availH = Math.max(1, stage.clientHeight - 24);
    // never below 1 device pixel per frame pixel; take more when the window allows it
    const S = Math.max(1 / dpr, Math.min(availW / fr.sw, availH / fr.sh));
    const W = fr.sw * S;
    const H = fr.sh * S;
    const cols = Math.max(1, Math.ceil(W / availW - 1e-6));
    const rows = Math.max(1, Math.ceil(H / availH - 1e-6));

    const shot = document.createElement("canvas");
    shot.width = fr.sw;
    shot.height = fr.sh;
    const g = shot.getContext("2d");

    const prev = scaler.style.transform;
    root.classList.add("df-capturing");
    scaler.style.setProperty("transition", "none", "important");
    try {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          // centre this tile's slice of the opening in the stage
          const tx = -((i + 0.5) * (W / cols) - W / 2);
          const ty = -((j + 0.5) * (H / rows) - H / 2);
          scaler.style.transform = `translate(${tx}px, ${ty}px) scale(${S})`;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          // captureVisibleTab is rate-limited to 2 calls/sec; a single shot needs no wait
          await new Promise((r) => setTimeout(r, cols * rows > 1 ? 560 : 80));
          const r0 = screen.getBoundingClientRect();
          let resp;
          try { resp = await chrome.runtime.sendMessage({ type: "df-capture" }); } catch (e) { resp = { error: e && e.message }; }
          const img = resp && resp.dataUrl ? await loadImage(resp.dataUrl).catch(() => null) : null;
          if (!img) { console.warn("[Emulator] tile capture failed:", resp && resp.error); return null; }
          // the part of the opening this tile actually shows, clipped to the window
          const vx = Math.max(r0.left, 0);
          const vy = Math.max(r0.top, 0);
          const vr = Math.min(r0.right, window.innerWidth);
          const vb = Math.min(r0.bottom, window.innerHeight);
          if (vr <= vx || vb <= vy) continue;
          g.drawImage(img,
            vx * dpr, vy * dpr, (vr - vx) * dpr, (vb - vy) * dpr,
            ((vx - r0.left) / r0.width) * fr.sw, ((vy - r0.top) / r0.height) * fr.sh,
            ((vr - vx) / r0.width) * fr.sw, ((vb - vy) / r0.height) * fr.sh);
        }
      }
    } finally {
      scaler.style.transform = prev;
      scaler.style.removeProperty("transition");
      root.classList.remove("df-capturing");
    }

    const bmp = await createImageBitmap(await (await fetch(FRAMES_BASE + fr.file)).blob()).catch(() => null);
    if (!bmp) return null;
    const out = document.createElement("canvas");
    out.width = fr.fw + XPAD * 2;
    out.height = fr.fh + XPAD * 2;
    const o = out.getContext("2d");
    o.save(); // clip the page to the opening's painted corner radius
    o.beginPath();
    o.roundRect(XPAD + fr.ox, XPAD + fr.oy, fr.sw, fr.sh, fr.sr || 0);
    o.clip();
    o.drawImage(shot, XPAD + fr.ox, XPAD + fr.oy);
    o.restore();
    // the bezel punches its own display out, so drawing it on top leaves the surround
    // transparent - no knock-out mask needed on this path
    o.drawImage(bmp, XPAD, XPAD, fr.fw, fr.fh);
    return out;
  }

  // Knock the stage out so only the device is left: keep the frame PNG's opaque pixels (or the
  // drawn bezel's rounded boxes) plus the screen rect; everything else goes transparent.
  async function transparent(cap) {
    const { canvas, ox, oy, dpr, d } = cap;
    const mask = document.createElement("canvas");
    mask.width = canvas.width;
    mask.height = canvas.height;
    const g = mask.getContext("2d");
    g.fillStyle = "#000";
    const k = rig.getBoundingClientRect().width / (rig.offsetWidth || 1); // on-screen px per layout px
    const rect = (n, grow = 0) => {
      const r = n.getBoundingClientRect();
      const e = grow * k * dpr;
      return { x: r.left * dpr - ox - e, y: r.top * dpr - oy - e, w: r.width * dpr + e * 2, h: r.height * dpr + e * 2 };
    };
    const rrect = (b, rad) => { g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, Math.max(0, rad)); g.fill(); };
    if (d.type === "image") {
      const fr = d.rot && state.landscape && d.frameL ? d.frameL : d.frame;
      const rotated = d.rot && state.landscape && !d.frameL;
      const b = rect(device);
      try {
        const bmp = await createImageBitmap(await (await fetch(FRAMES_BASE + fr.file)).blob());
        g.save();
        if (rotated) { g.translate(b.x + b.w, b.y); g.rotate(Math.PI / 2); g.drawImage(bmp, 0, 0, b.h, b.w); }
        else g.drawImage(bmp, b.x, b.y, b.w, b.h);
        g.restore();
      } catch (_) {
        rrect(b, 0);
      }
      rrect(rect(screen), (fr.sr || 0) * k * dpr);
    } else {
      const rim = !["watch", "display", "laptop"].includes(d.type) ? 9 : 0; // metal rim sits 9px outside the body
      [device, lapBase, standNeck, standFoot, bandTop, bandBot].forEach((n) => {
        if (getComputedStyle(n).display === "none") return;
        const grow = n === device ? rim : 0;
        rrect(rect(n, grow), (parseFloat(getComputedStyle(n).borderRadius) || 0) * k * dpr + grow * k * dpr);
      });
    }
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const o = out.getContext("2d");
    o.drawImage(canvas, 0, 0);
    o.globalCompositeOperation = "destination-in";
    o.drawImage(mask, 0, 0);
    return out;
  }

  // One canvas for every exporter: native rebuild where the device has 1:1 art, cropped
  // screenshot otherwise (drawn bezels, Duo poses, rotate-synthesised landscape).
  async function exportCanvas() {
    if (capturing) return null;
    const d = current();
    if (nativeOk(d)) {
      capturing = true;
      let c;
      try { c = await captureNative(d); } finally { capturing = false; }
      if (c) return { canvas: c, d };
    }
    const cap = await capture();
    if (!cap) return null;
    return { canvas: await transparent(cap), d: cap.d };
  }

  // Name by the pixels actually written, not the logical viewport - the whole point is that
  // you can see what you are about to post.
  const fileName = (x, ext) => `emulator-${x.d.id}-${x.canvas.width}x${x.canvas.height}.${ext}`;
  function save(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function exportPng() {
    const x = await exportCanvas();
    if (!x) return;
    save(await toBlob(x.canvas, "image/png"), fileName(x, "png"));
    toast(`PNG saved - ${x.canvas.width} x ${x.canvas.height}, transparent`);
  }
  async function exportWebp() {
    const x = await exportCanvas();
    if (!x) return;
    // WebP carries alpha, so it gets the same transparent surround as the PNG - it used to
    // save cap.canvas raw, which baked the stage backdrop into the file.
    // quality 1 is the one value Chromium encodes LOSSLESS at - every opaque pixel comes back
    // bit-exact, at roughly half a PNG. It used to be 0.92, which is fine for photos and wrong
    // for a screenshot: 3% of pixels shifted, all of it on the small text a UI shot is made of,
    // and anything that re-encodes on upload (LinkedIn, X) compounds that first loss.
    save(await toBlob(x.canvas, "image/webp", 1), fileName(x, "webp"));
    toast(`WebP saved - ${x.canvas.width} x ${x.canvas.height}, lossless`);
  }
  async function copyPng() {
    const x = await exportCanvas();
    if (!x) return;
    const png = x.canvas;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error("insecure context");
      const blob = await toBlob(png, "image/png");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } catch (first) {
      // plain-http pages (LAN dev servers) have no clipboard API at all, and a page that lost
      // focus refuses writes - the extension's own page (secure, clipboardWrite) does it instead
      let resp = null;
      try { resp = await chrome.runtime.sendMessage({ type: "df-clipboard", dataUrl: png.toDataURL("image/png") }); } catch (_) {}
      if (!resp || !resp.ok) {
        console.warn("[Emulator] copy failed:", first && first.message, resp && resp.error);
        toast("Copy failed - " + ((resp && resp.error) || (first && first.message) || "unknown error"), 4000);
        return;
      }
    }
    flash(copyBtn);
    toast("Image copied - transparent PNG");
  }

  // Share: upload a WebP of the device to bunlongheng.com and hand back a public link.
  // The upload goes through the service worker (extension origin, no CORS dance).
  let toastTimer = null;
  function toast(msg, ms = 2200, href) {
    toastEl.textContent = msg;
    if (href) {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = href.replace(/^https?:\/\//, "");
      toastEl.append(a);
    }
    toastEl.classList.add("df-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("df-show"), ms);
  }
  const flash = (btn) => { btn.classList.add("df-active"); setTimeout(() => btn.classList.remove("df-active"), 1200); };

  // ---- events ----
  // Fires for whichever renderer is holding the page; the idle one parks on about:blank and
  // must not call the load off early.
  const onPageLoad = (e) => {
    if (e.target.getAttribute("src") === "about:blank") return;
    const f = e.target; // the event's target is gone by the time the timer fires
    autoTheme(f);
    setTimeout(() => { if (f.getAttribute("src") !== "about:blank") autoTheme(f); }, 700);
    clearTimeout(loadTimer);
    blocked.classList.remove("df-show");
    spinner.classList.remove("df-show"); // page arrived - stop the spinner
    sfProg.classList.remove("df-go");
    sfProg.classList.add("df-done"); // run the blue line to the end, then fade it
  };
  [iframe, halfA.ifr, halfB.ifr].forEach((f) => f.addEventListener("load", onPageLoad));

  // Keep a folded pose reading as ONE screen. The halves render the same page at the same
  // width, so the half that last took input LEADS and the other FOLLOWS - one direction at a
  // time (scroll events fire async, so a two-way mirror behind a flag echoed A->B->A). What
  // gets copied is STATE, not input: every scroller the leader moves (window or nested) is set
  // to the same offset on its twin, instantly, every frame - so a page's own smooth scroll
  // (CSS scroll-behavior, scrollIntoView, Lenis-style) animates in the leader and the follower
  // just tracks it. A synthetic wheel never scrolls anything natively, so the wheel is
  // forwarded ONLY to a page proven to eat it without moving any scroller (fullpage-style snaps
  // on transforms) - there the same input is the only route to the same frame. Readable only
  // while the framed page is same-origin (the extension's usual case - it frames the tab it is
  // injected into); cross-origin halves just scroll on their own.
  const halves = [halfA.ifr, halfB.ifr];
  const twinIfr = (f) => (f === halfA.ifr ? halfB.ifr : halfA.ifr);
  const docOf = (f) => { try { return f.contentWindow.document; } catch (_) { return null; } };
  let leader = halfA.ifr;
  let lastInput = 0; // when the leader last got pointer/wheel input - gates the canvas copy
  let wheelDriven = false; // the page swallowed a wheel without scrolling - forward wheels
  let wheelProbe = 0; // pending "did that wheel move anything?" check
  let moved = false; // a leader scroller moved since the last wheel

  // Same page, same width, same tree: a node's twin sits at the same child-index path (its id
  // when it has one). "" is the document scroller itself.
  const pathOf = (n) => {
    const d = n.ownerDocument;
    if (n === d.scrollingElement || n === d.documentElement) return "";
    if (n.id) return "#" + d.defaultView.CSS.escape(n.id);
    const p = [];
    for (let e = n; e && e !== d.documentElement; e = e.parentElement) {
      p.unshift(Array.prototype.indexOf.call(e.parentNode.children, e));
    }
    return p.join("/");
  };
  const twinOf = (n, d) => {
    const path = pathOf(n);
    if (path === "") return d.scrollingElement;
    if (path[0] === "#") return d.querySelector(path);
    let e = d.documentElement;
    for (const i of path.split("/")) e = e && e.children[i];
    return e || null;
  };
  const scrollerOf = (e, d) => (e.target === d ? d.scrollingElement : e.target);

  const copyScroll = (n, from) => {
    const td = docOf(twinIfr(from));
    const t = td && twinOf(n, td);
    if (!t) return;
    const x = n.scrollLeft;
    const y = n.scrollTop;
    // The value check is the echo guard: the follower only ever holds what we set, so when it
    // takes the lead it has nothing new to push back. "instant" overrides the page's own
    // scroll-behavior:smooth on the follower - the leader already did the easing.
    if (t.scrollLeft !== x || t.scrollTop !== y) t.scrollTo({ left: x, top: y, behavior: "instant" });
  };
  const forwardWheel = (e, to) => {
    const td = docOf(to);
    if (!td) return;
    const t = (e.target.nodeType === 1 && twinOf(e.target, td)) || td.documentElement;
    t.dispatchEvent(new to.contentWindow.WheelEvent("wheel", {
      deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode,
      clientX: e.clientX, clientY: e.clientY, bubbles: true, cancelable: true, composed: true,
    }));
  };

  const attachSync = (f) => {
    const d = docOf(f);
    if (!d || d.__dfSync) return; // cross-origin, or this document is already wired
    d.__dfSync = true;
    const w = d.defaultView;
    const opts = { capture: true, passive: true };
    // Leadership moves on INTENT, not hover - crossing the crease mid-animation must not
    // orphan a smooth scroll that is still running in the other half.
    // Only a REAL pointer hands over the lead - the copies we dispatch into the twin must not,
    // or the first mirrored pointerdown would flip leadership and drop the rest of the stroke.
    const lead = (e) => { if (e.isTrusted) leader = f; };
    ["pointerdown", "touchstart", "keydown", "focusin"].forEach((t) => d.addEventListener(t, lead, opts));
    // scroll does not bubble but it does capture: one listener sees window AND nested scrollers
    d.addEventListener("scroll", (e) => {
      if (leader !== f) return;
      moved = true;
      wheelDriven = false; // it scrolls after all - stop feeding it the wheel
      copyScroll(scrollerOf(e, d), f);
    }, opts);
    d.addEventListener("scrollend", (e) => { if (leader === f) copyScroll(scrollerOf(e, d), f); }, opts);
    // The pointer goes to the twin too, so the page's own handlers run in both copies - a
    // stroke on a canvas, a hover, a menu, a button - one screen, not two. Synthetic events are
    // never re-mirrored (isTrusted), and a click inside a form stays put so nothing submits twice.
    const POINTER = ["pointerdown", "pointermove", "pointerup", "pointercancel", "mousedown", "mousemove", "mouseup", "click"];
    POINTER.forEach((t) => d.addEventListener(t, (e) => {
      if (!e.isTrusted || leader !== f) return;
      if (t !== "pointermove" && t !== "mousemove") lastInput = Date.now();
      if (t === "click" && e.target.closest && e.target.closest("form")) return;
      const tw = twinIfr(f);
      const td = docOf(tw);
      if (!td) return;
      const target = (e.target.nodeType === 1 && twinOf(e.target, td)) || td.documentElement;
      const Ctor = e instanceof w.PointerEvent ? tw.contentWindow.PointerEvent : tw.contentWindow.MouseEvent;
      target.dispatchEvent(new Ctor(t, {
        clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
        button: e.button, buttons: e.buttons, pointerId: e.pointerId, pointerType: e.pointerType,
        isPrimary: e.isPrimary, pressure: e.pressure, width: e.width, height: e.height,
        ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
        bubbles: true, cancelable: true, composed: true,
      }));
    }, opts));
    // A mirrored pointer has no real pointer behind it, so a page that captures it on
    // pointerdown (every drawing app) would throw and drop the stroke. Let that call fail quietly.
    const proto = w.Element.prototype;
    ["setPointerCapture", "releasePointerCapture"].forEach((k) => {
      const orig = proto[k];
      proto[k] = function (id) { try { return orig.call(this, id); } catch (_) { return undefined; } };
    });
    d.addEventListener("wheel", (e) => {
      if (!e.isTrusted) return; // a forwarded wheel is never forwarded again
      leader = f;
      lastInput = Date.now();
      if (wheelDriven) { forwardWheel(e, twinIfr(f)); return; }
      // Probe: give the page a few frames. If no scroller moved, it ate the wheel itself -
      // forward this one late and every later one straight away.
      moved = false;
      clearTimeout(wheelProbe);
      wheelProbe = setTimeout(() => {
        if (moved || leader !== f) return;
        wheelDriven = true;
        forwardWheel(e, twinIfr(f));
      }, 120);
    }, opts);
    // an anchor jump in the leader lands the follower on the same anchor (its scroll follows)
    w.addEventListener("hashchange", () => {
      if (leader !== f) return;
      try {
        const tl = twinIfr(f).contentWindow.location;
        if (tl.hash !== w.location.hash) tl.hash = w.location.hash;
      } catch (_) {}
    });
  };
  // Wire each new document as it lands, and take the follower along on a full navigation
  // (a link followed in the leader). Only the leader pushes, so a redirect cannot ping-pong.
  const onHalfLoad = (e) => {
    const f = e.target;
    if (f.getAttribute("src") === "about:blank") return;
    attachSync(f);
    poseLoaded.add(f);
    if (poseUnclipped && poseLoaded.size === 2) {
      // a beat for the observers to fire on the full viewport, then cut and show
      setTimeout(() => {
        poseUnclipped = false;
        if (current().type === "pose") render(false);
      }, 150);
    }
    const d = docOf(f);
    const tw = twinIfr(f);
    const td = docOf(tw);
    if (f === leader && d && tw.src !== d.URL && (!td || td.URL !== d.URL)) tw.src = d.URL;
  };
  halves.forEach((f) => f.addEventListener("load", onHalfLoad));
  // What the page paints itself has to be carried over as well: a mirrored stroke can still
  // land a pixel off, and a canvas keeps no DOM state to copy. While the leader is being used,
  // every canvas it has is drawn onto the twin's each frame - same-origin only, 2d twins only
  // (a WebGL canvas will not hand out a 2d context, and is skipped).
  const copyCanvases = () => {
    if (!root.isConnected) return;
    if (current().type === "pose" && Date.now() - lastInput < 800) {
      const d = docOf(leader);
      const td = docOf(twinIfr(leader));
      if (d && td) {
        d.querySelectorAll("canvas").forEach((c) => {
          const t = twinOf(c, td);
          if (!t || t.tagName !== "CANVAS" || !c.width || !c.height) return;
          const ctx = t.getContext("2d");
          if (!ctx) return;
          if (t.width !== c.width || t.height !== c.height) { t.width = c.width; t.height = c.height; }
          ctx.clearRect(0, 0, t.width, t.height);
          ctx.drawImage(c, 0, 0);
        });
      }
    }
    requestAnimationFrame(copyCanvases);
  };
  requestAnimationFrame(copyCanvases);
  rotateBtn.addEventListener("click", rotate);
  dlBtn.addEventListener("click", (e) => { e.stopPropagation(); closePops(); menu.classList.toggle("df-show"); });
  miPng.addEventListener("click", () => { menu.classList.remove("df-show"); exportPng(); });
  miWebp.addEventListener("click", () => { menu.classList.remove("df-show"); exportWebp(); });
  miCopy.addEventListener("click", () => { menu.classList.remove("df-show"); copyPng(); });
  copyBtn.addEventListener("click", () => copyPng());
  menu.addEventListener("click", (e) => e.stopPropagation());
  const onDocClick = () => {
    if (!root.isConnected) { document.removeEventListener("click", onDocClick, true); return; }
    menu.classList.remove("df-show");
    closePops();
  };
  document.addEventListener("click", onDocClick, true);
  sfReload.addEventListener("click", () => render(true)); // Safari-bar reload (iPhone)
  closeBtn.addEventListener("click", () => close());

  const clampCustom = () => {
    state.customW = Math.max(80, Math.min(6000, parseInt(inW.value, 10) || 1280));
    state.customH = Math.max(80, Math.min(6000, parseInt(inH.value, 10) || 800));
    render(false);
  };
  inW.addEventListener("change", clampCustom);
  inH.addEventListener("change", clampCustom);

  // Both window listeners self-detach the moment THEIR overlay leaves the DOM (normal close,
  // or an orphan hard-removed after an extension reload). Without this, an orphaned overlay's
  // keydown/resize handlers stay bound to window forever, pinning its dead DOM in memory.
  const onKey = (e) => {
    if (!root.isConnected) { window.removeEventListener("keydown", onKey, true); return; }
    if (e.key === "Escape") {
      e.stopPropagation();
      if (popOpen()) { closePops(); return; }
      if (menu.classList.contains("df-show")) { menu.classList.remove("df-show"); return; }
      close();
      return;
    }
    // Cmd/Ctrl+R (and Cmd/Ctrl+Shift+R) reload the framed page - not the whole tab, which
    // would kill the overlay. There is no reload button: this is the reload.
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "r" || e.key === "R")) {
      e.preventDefault();
      e.stopPropagation();
      render(true);
    }
  };
  const onResize = () => {
    if (!root.isConnected) { window.removeEventListener("resize", onResize); return; }
    fit();
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onResize);

  function close() {
    clearTimeout(loadTimer);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("click", onDocClick, true);
    root.remove();
    delete window.__emulator;
    try { chrome.runtime.sendMessage({ type: "df-close" }); } catch (_) {} // drop header-strip rule
  }

  const setDevice = (id) => {
    if (!DEVICES.some((d) => d.id === id)) return;
    state.deviceId = id;
    render(true);
  };
  window.__emulator = { close, root, setDevice };
  try { chrome.runtime.sendMessage({ type: "df-open" }); } catch (_) {} // green "ON" badge
  render(true);
})();
