// Small isomorphic formatting helpers. Dates, numbers and relative times are NOT here:
// they go through next-intl's useFormatter()/getFormatter() (see docs/CONVENTIONS.md §5).

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
const CJK_SCRIPT = /[぀-ヿ㐀-䶿一-鿿가-힯]/;

/**
 * Initials for avatars. Latin names give two letters ("Sara Ali" → "SA"); Arabic and CJK
 * names give one, because joined Arabic letters or two ideographs read badly in a circle.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0] ?? "?";
  if (ARABIC_SCRIPT.test(first) || CJK_SCRIPT.test(first) || words.length === 1) {
    return first.toLocaleUpperCase();
  }
  const last = Array.from(words[words.length - 1])[0] ?? "";
  return `${first}${last}`.toLocaleUpperCase();
}

export interface DeviceInfo {
  browser: string | null;
  os: string | null;
  mobile: boolean;
}

// Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows NT/, "Windows"],
  [/iPhone|iPod/, "iOS"],
  [/iPad/, "iPadOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

/** Browser and OS names (proper nouns, not translated) from a User-Agent header. */
export function describeUserAgent(userAgent: string | null | undefined): DeviceInfo {
  const ua = userAgent ?? "";
  return {
    browser: BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? null,
    os: SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? null,
    mobile: /Mobi|iPhone|iPod|Android.+Mobile/.test(ua),
  };
}

/**
 * A stored IP address in its short, readable form: IPv6 compressed ("::1"), IPv4-mapped
 * IPv6 shown as IPv4. Null when unknown or unspecified ("::").
 */
export function displayIp(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;
  if (!value.includes(":")) return value;
  let host: string;
  try {
    host = new URL(`http://[${value}]`).hostname.slice(1, -1);
  } catch {
    return value;
  }
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return host === "::" ? null : host;
}
