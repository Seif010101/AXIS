// One-off: converts the legacy Vue dictionary (frontend/src/composables/useI18n.js → STATIC)
// into next-intl message files (messages/<locale>.json).
// Brand names are replaced by the {brand} token, resolved at load time from src/config/brand.ts.
//
// Usage: node scripts/convert-legacy-i18n.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../frontend/src/composables/useI18n.js");
const outDir = resolve(here, "../messages");
const LOCALES = ["ar", "en", "zh", "de", "es", "fr"];
const BRAND_PATTERNS = [/Memorix/g, /Morix/g, /MORIX/g, /موريكس/g, /莫瑞克斯/g];

const text = readFileSync(source, "utf8");
const start = text.indexOf("const STATIC = {");
if (start === -1) throw new Error("STATIC dictionary not found");

// Find the matching closing brace of the STATIC object, skipping strings and comments.
const open = text.indexOf("{", start);
let depth = 0;
let end = -1;
for (let i = open; i < text.length; i++) {
  const ch = text[i];
  if (ch === "/" && text[i + 1] === "/") {
    i = text.indexOf("\n", i);
    continue;
  }
  if (ch === "/" && text[i + 1] === "*") {
    i = text.indexOf("*/", i) + 1;
    continue;
  }
  if (ch === "'" || ch === '"' || ch === "`") {
    for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === "\\") i++;
    continue;
  }
  if (ch === "{") depth++;
  if (ch === "}" && --depth === 0) {
    end = i;
    break;
  }
}
if (end === -1) throw new Error("Unbalanced STATIC object");

// The object is plain data (string literals only), so evaluate it in an empty sandbox.
const dict = vm.runInNewContext(`(${text.slice(open, end + 1)})`, Object.create(null), {
  timeout: 1000,
});

const messages = Object.fromEntries(LOCALES.map((l) => [l, {}]));
const missing = [];
const icuUnsafe = [];

for (const [key, translations] of Object.entries(dict)) {
  for (const locale of LOCALES) {
    let value = translations[locale];
    if (typeof value !== "string" || value.length === 0) {
      missing.push(`${key}.${locale}`);
      value = translations.en ?? translations.ar ?? key;
    }
    for (const re of BRAND_PATTERNS) value = value.replace(re, "{brand}");
    // ICU MessageFormat treats { } as syntax; only the {brand} token may remain.
    if (/[{}]/.test(value.replaceAll("{brand}", ""))) icuUnsafe.push(`${key}.${locale}`);
    messages[locale][key] = value;
  }
}

mkdirSync(outDir, { recursive: true });
for (const locale of LOCALES) {
  writeFileSync(resolve(outDir, `${locale}.json`), JSON.stringify(messages[locale], null, 2) + "\n");
}

console.log(`keys: ${Object.keys(dict).length} × locales: ${LOCALES.length}`);
console.log(`missing (filled from en/ar): ${missing.length ? missing.join(", ") : "none"}`);
if (icuUnsafe.length) {
  console.error(`ICU-unsafe values (contain { or }): ${icuUnsafe.join(", ")}`);
  process.exitCode = 1;
}
