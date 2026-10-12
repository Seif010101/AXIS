import { describe, expect, it } from "vitest";
import { describeUserAgent, initials } from "@/lib/format";
import {
  AVATAR_PRESETS,
  DIFFICULTIES,
  HOBBIES_MAX,
  HOBBY_MAX_LENGTH,
  addHobby,
  isAvatarPreset,
  isOneOf,
  presetFromImage,
} from "@/lib/preferences";

describe("preset avatars", () => {
  it("offers twelve distinct presets", () => {
    expect(AVATAR_PRESETS).toHaveLength(12);
    expect(new Set(AVATAR_PRESETS).size).toBe(12);
  });

  it("reads only known presets from users.image", () => {
    expect(presetFromImage("preset:ocean")).toBe("ocean");
    expect(presetFromImage("preset:unknown")).toBeNull();
    expect(presetFromImage("ocean")).toBeNull();
    expect(presetFromImage("https://example.com/a.png")).toBeNull();
    expect(presetFromImage(null)).toBeNull();
    expect(isAvatarPreset("nebula")).toBe(true);
    expect(isAvatarPreset("preset:nebula")).toBe(false);
  });
});

describe("hobbies", () => {
  it("adds trimmed hobbies and rejects empty, long and duplicate ones", () => {
    expect(addHobby([], "  board   games ")).toEqual({ ok: true, hobbies: ["board games"] });
    expect(addHobby(["Chess"], "   ")).toEqual({ ok: false, reason: "empty" });
    expect(addHobby(["Chess"], "chess")).toEqual({ ok: false, reason: "duplicate" });
    expect(addHobby([], "x".repeat(HOBBY_MAX_LENGTH + 1))).toEqual({ ok: false, reason: "tooLong" });
    expect(addHobby([], "x".repeat(HOBBY_MAX_LENGTH))).toMatchObject({ ok: true });
  });

  it("stops at the maximum", () => {
    const full = Array.from({ length: HOBBIES_MAX }, (_, i) => `hobby ${i}`);
    expect(addHobby(full, "one more")).toEqual({ ok: false, reason: "limit" });
  });

  it("narrows radio values to the allowed list", () => {
    expect(isOneOf(DIFFICULTIES, "hard")).toBe(true);
    expect(isOneOf(DIFFICULTIES, "extreme")).toBe(false);
    expect(isOneOf(DIFFICULTIES, 2)).toBe(false);
  });
});

describe("format helpers", () => {
  it("builds avatar initials per script", () => {
    expect(initials("Sara Ali")).toBe("SA");
    expect(initials("  omar  ")).toBe("O");
    expect(initials("أحمد علي")).toBe("أ");
    expect(initials("王小明")).toBe("王");
    expect(initials("")).toBe("?");
  });

  it("names the browser and system of a session", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0",
      ),
    ).toEqual({ browser: "Edge", os: "Windows", mobile: false });
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ browser: "Safari", os: "iOS", mobile: true });
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "Android", mobile: true });
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null, mobile: false });
  });
});
