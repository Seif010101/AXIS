import { accountNavigation, navigation, type NavItem, type NavSection } from "@/config/navigation";
import type { Role } from "@/server/policy/roles";

/**
 * The href that should be highlighted for `pathname`: the longest href that equals the
 * path or is a parent segment of it. "/student" stays inactive on "/student/chat", and
 * "/student/homework" is active on "/student/homework/123".
 */
export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let best: string | null = null;
  for (const href of hrefs) {
    if ((path === href || path.startsWith(`${href}/`)) && (!best || href.length > best.length)) best = href;
  }
  return best;
}

/** Every sidebar section of a role, account section last. */
export function sectionsFor(role: Role): NavSection[] {
  return [...navigation[role], accountNavigation];
}

/** The sidebar item (and its section) that owns `pathname` for this role, if any. */
export function findNavItem(role: Role, pathname: string): { section: NavSection; item: NavItem } | null {
  const sections = sectionsFor(role);
  const href = activeHref(
    pathname,
    sections.flatMap((section) => section.items.map((item) => item.href)),
  );
  if (!href) return null;
  for (const section of sections) {
    const item = section.items.find((candidate) => candidate.href === href);
    if (item) return { section, item };
  }
  return null;
}
