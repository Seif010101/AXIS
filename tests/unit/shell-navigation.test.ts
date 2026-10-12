import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { accountNavigation, navigation } from "@/config/navigation";
import { activeHref, findNavItem } from "@/components/shell/nav-utils";

const APP_DIR = fileURLToPath(new URL("../../src/app/(app)", import.meta.url));

/** True when `href` is served by a page under src/app/(app) (plain or optional catch-all). */
function hasPage(href: string): boolean {
  const dir = `${APP_DIR}${href}`;
  if (existsSync(`${dir}/page.tsx`)) return true;
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((entry) => /^\[\[\.\.\..+\]\]$/.test(entry) && existsSync(`${dir}/${entry}/page.tsx`));
}

describe("sidebar highlighting", () => {
  const hrefs = ["/student", "/student/homework", "/student/chat", "/settings"];

  it("highlights the longest matching section only", () => {
    expect(activeHref("/student", hrefs)).toBe("/student");
    expect(activeHref("/student/homework", hrefs)).toBe("/student/homework");
    expect(activeHref("/student/homework/42", hrefs)).toBe("/student/homework");
    expect(activeHref("/student/chat/abc", hrefs)).toBe("/student/chat");
    expect(activeHref("/student/homework/", hrefs)).toBe("/student/homework");
  });

  it("does not match on a shared prefix that is not a path segment", () => {
    expect(activeHref("/student/homeworks", ["/student/homework"])).toBeNull();
    expect(activeHref("/teacher", hrefs)).toBeNull();
  });

  it("finds the item and section that own a page", () => {
    expect(findNavItem("student", "/student/homework/1")?.item.href).toBe("/student/homework");
    expect(findNavItem("teacher", "/settings")?.section).toBe(accountNavigation);
    expect(findNavItem("student", "/owner")).toBeNull();
  });
});

describe("route map", () => {
  const hrefs = [...Object.values(navigation).flat(), accountNavigation].flatMap((section) =>
    section.items.map((item) => item.href),
  );

  it.each([...new Set(hrefs)])("%s has a page", (href) => {
    expect(hasPage(href)).toBe(true);
  });
});
