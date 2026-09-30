import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import { directionOf, locales } from "@/i18n/config";
import { withBrand } from "@/i18n/messages";
import ar from "../../messages/ar.json";
import de from "../../messages/de.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";
import zh from "../../messages/zh.json";

const all: Record<string, Record<string, string>> = { ar, en, zh, de, es, fr };

describe("messages", () => {
  const reference = Object.keys(ar).sort();

  it.each(locales)("%s has exactly the same keys as ar", (locale) => {
    expect(Object.keys(all[locale]).sort()).toEqual(reference);
  });

  it.each(locales)("%s messages are valid ICU after brand substitution", (locale) => {
    for (const [key, value] of Object.entries(withBrand(all[locale], "Brand"))) {
      expect(() => new IntlMessageFormat(value, locale), key).not.toThrow();
    }
  });

  it("no hard-coded product names remain in message files", () => {
    for (const messages of Object.values(all)) {
      for (const value of Object.values(messages)) {
        expect(value).not.toMatch(/morix|memorix|موريكس|莫瑞克斯/i);
      }
    }
  });

  it("brand token is substituted", () => {
    expect(withBrand({ a: "{brand} — x" }, "AXIS")).toEqual({ a: "AXIS — x" });
  });
});

describe("direction", () => {
  it("only Arabic is RTL among supported locales", () => {
    expect(locales.filter((l) => directionOf(l) === "rtl")).toEqual(["ar"]);
  });
});
