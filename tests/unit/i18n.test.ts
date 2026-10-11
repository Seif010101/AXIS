import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { directionOf, locales } from "@/i18n/config";
import { withBrand, type MessageTree } from "@/i18n/messages";
import { namespaces } from "@/i18n/namespaces";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");

function read(locale: string, namespace: string): MessageTree {
  return JSON.parse(readFileSync(path.join(MESSAGES_DIR, locale, `${namespace}.json`), "utf8"));
}

function flatten(tree: MessageTree, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === "string"
        ? [[`${prefix}${key}`, value]]
        : Object.entries(flatten(value, `${prefix}${key}.`)),
    ),
  );
}

describe("messages", () => {
  it.each(locales)("%s has exactly the registered namespace files", (locale) => {
    const files = readdirSync(path.join(MESSAGES_DIR, locale)).map((f) => f.replace(/\.json$/, ""));
    expect(files.sort()).toEqual([...namespaces].sort());
  });

  for (const namespace of namespaces) {
    const reference = Object.keys(flatten(read("ar", namespace))).sort();

    it.each(locales)(`${namespace}: %s has exactly the same keys as ar`, (locale) => {
      expect(Object.keys(flatten(read(locale, namespace))).sort()).toEqual(reference);
    });

    it.each(locales)(`${namespace}: %s messages are non-empty valid ICU`, (locale) => {
      for (const [key, value] of Object.entries(flatten(withBrand(read(locale, namespace), "Brand")))) {
        expect(value.trim(), `${namespace}.${key}`).not.toBe("");
        expect(() => new IntlMessageFormat(value, locale), `${namespace}.${key}`).not.toThrow();
      }
    });

    it(`${namespace}: no hard-coded product names`, () => {
      for (const locale of locales) {
        for (const value of Object.values(flatten(read(locale, namespace)))) {
          expect(value).not.toMatch(/morix|memorix|موريكس|莫瑞克斯|\baxis\b/i);
        }
      }
    });
  }

  it("brand token is substituted in nested trees", () => {
    expect(withBrand({ a: "{brand} — x", b: { c: "by {brand}" } }, "AXIS")).toEqual({
      a: "AXIS — x",
      b: { c: "by AXIS" },
    });
  });
});

describe("direction", () => {
  it("only Arabic is RTL among supported locales", () => {
    expect(locales.filter((l) => directionOf(l) === "rtl")).toEqual(["ar"]);
  });
});
