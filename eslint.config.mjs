import js from "@eslint/js";

const ignore = { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" };

export default [
  js.configs.recommended,
  {
    files: ["overlay.js", "background.js", "copy.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly", document: "readonly", location: "readonly", navigator: "readonly",
        chrome: "readonly", console: "readonly", URL: "readonly", URLSearchParams: "readonly",
        Image: "readonly", Event: "readonly", Blob: "readonly", HTMLElement: "readonly",
        fetch: "readonly", createImageBitmap: "readonly", ClipboardItem: "readonly", FileReader: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", requestAnimationFrame: "readonly",
        devicePixelRatio: "readonly", getComputedStyle: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", ignore],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    // node test runner + browser-context globals used inside page.evaluate() callbacks
    files: ["tests/**/*.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "module",
      globals: {
        console: "readonly", process: "readonly", setTimeout: "readonly",
        document: "readonly", getComputedStyle: "readonly", window: "readonly",
        Image: "readonly", Uint8Array: "readonly",
        createImageBitmap: "readonly", fetch: "readonly",
      },
    },
    rules: { "no-unused-vars": ["warn", ignore] },
  },
];
