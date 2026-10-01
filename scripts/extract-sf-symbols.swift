// Export the SF Symbols the device chrome uses, as Apple draws them.
//
//   swiftc -O scripts/extract-sf-symbols.swift -o /tmp/sfx && /tmp/sfx frames
//
// The status bar and Safari toolbar glyphs are real SF Symbols, rendered by macOS itself
// rather than redrawn by hand - a redrawn wifi arc or share box never quite matches and the
// frame stops reading as a real device. Each symbol is written white-on-transparent, so the
// ALPHA channel is the artwork; overlay.css paints it with a CSS mask over currentColor,
// which lets one file serve both the light and the dark status bar.
//
// 256px on the long edge: the chrome draws these at roughly 40 frame px, so there is ~6x of
// headroom for a 4K export. Apple's vector source lives in a compiled asset catalog that is
// not readable here, so this is the closest exact artwork available offline.
import AppKit

let LONG: CGFloat = 256

// symbol name -> output basename, plus the weight the real iOS chrome uses.
let SYMBOLS: [(String, String, NSFont.Weight)] = [
    ("cellularbars",        "sf-cellularbars",  .regular),
    ("wifi",                "sf-wifi",          .regular),
    ("battery.100percent",  "sf-battery",       .regular),
    ("chevron.backward",    "sf-back",          .semibold),
    ("chevron.forward",     "sf-forward",       .semibold),
    ("square.and.arrow.up", "sf-share",         .regular),
    ("book",                "sf-book",          .regular),
    ("square.on.square",    "sf-tabs",          .regular),
    ("arrow.clockwise",     "sf-reload",        .semibold),
    ("lock.fill",           "sf-lock",          .regular),
    ("textformat.size",     "sf-textformat",    .regular),
]

let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "frames"
var failed = false

for (symbol, base, weight) in SYMBOLS {
    guard let src = NSImage(systemSymbolName: symbol, accessibilityDescription: nil),
          let img = src.withSymbolConfiguration(.init(pointSize: 256, weight: weight)) else {
        FileHandle.standardError.write("MISSING \(symbol)\n".data(using: .utf8)!)
        failed = true
        continue
    }
    let s = img.size
    let scale = LONG / max(s.width, s.height)
    let w = Int((s.width * scale).rounded()), h = Int((s.height * scale).rounded())
    // RGBA: a 2-sample .deviceWhite buffer silently renders empty here, so keep four channels
    guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { continue }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSColor.white.set()
    img.draw(in: CGRect(x: 0, y: 0, width: CGFloat(w), height: CGFloat(h)))
    NSGraphicsContext.restoreGraphicsState()
    guard let png = rep.representation(using: .png, properties: [:]) else { continue }
    let path = "\(outDir)/\(base).png"
    try! png.write(to: URL(fileURLWithPath: path))
    print("\(path)  \(w)x\(h)  \(png.count) B  (\(symbol), \(weight == .semibold ? "semibold" : "regular"))")
}
exit(failed ? 1 : 0)
