import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { presetFromImage, type AvatarPreset } from "@/lib/preferences";
import { cn } from "@/lib/utils";

type Pattern = "orbit" | "waves" | "dots" | "grid" | "peaks" | "rays" | "sun" | "stars";

// Every preset is built from design tokens (chart/semantic colors), so it adapts to the theme.
const PRESETS: Record<AvatarPreset, { gradient: string; text: string; pattern: Pattern }> = {
  aurora: { gradient: "from-chart-1 to-chart-3", text: "text-white", pattern: "orbit" },
  ocean: { gradient: "from-info to-highlight", text: "text-white", pattern: "waves" },
  sunset: { gradient: "from-chart-5 to-warning", text: "text-white", pattern: "sun" },
  forest: { gradient: "from-success to-chart-2", text: "text-white", pattern: "peaks" },
  berry: { gradient: "from-chart-3 to-chart-5", text: "text-white", pattern: "dots" },
  citrus: { gradient: "from-star to-warning", text: "text-star-foreground", pattern: "rays" },
  lagoon: { gradient: "from-highlight to-chart-1", text: "text-white", pattern: "waves" },
  dusk: { gradient: "from-brand to-chart-5", text: "text-white", pattern: "stars" },
  ember: { gradient: "from-destructive to-warning", text: "text-white", pattern: "rays" },
  mint: { gradient: "from-chart-2 to-success", text: "text-white", pattern: "grid" },
  orchid: { gradient: "from-brand-violet to-chart-5", text: "text-white", pattern: "orbit" },
  nebula: { gradient: "from-brand to-brand-violet", text: "text-white", pattern: "stars" },
};

function PatternLayer({ pattern }: { pattern: Pattern }) {
  const common = { fill: "none", stroke: "white", strokeOpacity: 0.32, strokeWidth: 1.5 } as const;
  return (
    <svg viewBox="0 0 40 40" className="absolute inset-0 size-full" aria-hidden>
      {pattern === "orbit" && (
        <>
          <circle cx="31" cy="9" r="15" {...common} />
          <circle cx="31" cy="9" r="8" {...common} />
        </>
      )}
      {pattern === "waves" && <path d="M-2 29q6-5 11 0t11 0 11 0 11 0M-2 35q6-5 11 0t11 0 11 0 11 0" {...common} />}
      {pattern === "dots" &&
        [6, 14, 22, 30, 38].flatMap((x) =>
          [6, 14, 22, 30, 38].map((y) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="white" fillOpacity="0.3" />
          )),
        )}
      {pattern === "grid" && <path d="M10 0v40M20 0v40M30 0v40M0 10h40M0 20h40M0 30h40" {...common} strokeOpacity={0.2} />}
      {pattern === "peaks" && <path d="M0 40 13 25l7 7 9-12 11 20z" fill="white" fillOpacity="0.2" />}
      {pattern === "rays" && <path d="M40 0 18 40M40 0 4 30M40 0 28 40M40 0 0 16" {...common} strokeOpacity={0.25} />}
      {pattern === "sun" && <circle cx="32" cy="8" r="9" fill="white" fillOpacity="0.25" />}
      {pattern === "stars" &&
        [
          [8, 9, 1.4],
          [30, 6, 1],
          [34, 18, 1.6],
          [13, 33, 1],
          [27, 31, 1.2],
        ].map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="white" fillOpacity="0.55" />)}
    </svg>
  );
}

const SIZES = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

export type UserAvatarSize = keyof typeof SIZES;

/**
 * A user's avatar. `image` is users.image: a `preset:<id>` avatar (see AVATAR_PRESETS),
 * an https URL, or empty (initials). The user's name is the accessible label.
 *
 * @example <UserAvatar name={user.name} image={user.image} size="sm" />
 */
export function UserAvatar({
  name,
  image,
  size = "md",
  className,
  decorative = false,
}: {
  name: string;
  image?: string | null;
  size?: UserAvatarSize;
  className?: string;
  /** Set when the name is already shown next to the avatar, so screen readers don't repeat it. */
  decorative?: boolean;
}) {
  const label = decorative ? undefined : name;
  const preset = presetFromImage(image);
  if (preset) {
    const style = PRESETS[preset];
    return (
      <span
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-135 font-semibold ring-1 ring-black/5 select-none text-shadow-xs text-shadow-black/25",
          style.gradient,
          style.text,
          SIZES[size],
          className,
        )}
      >
        <PatternLayer pattern={style.pattern} />
        <span className="relative">{initials(name)}</span>
      </span>
    );
  }

  const url = image?.startsWith("https://") ? image : undefined;
  return (
    <Avatar
      className={cn(SIZES[size], "after:hidden", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {url && <AvatarImage src={url} alt="" />}
      <AvatarFallback className="bg-secondary font-semibold text-secondary-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Renders one preset by id (for pickers), independent of any user. */
export function AvatarPresetPreview({
  preset,
  name,
  size = "lg",
  className,
}: {
  preset: AvatarPreset;
  name: string;
  size?: UserAvatarSize;
  className?: string;
}) {
  return <UserAvatar name={name} image={`preset:${preset}`} size={size} className={className} decorative />;
}
