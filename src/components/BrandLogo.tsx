import { cn } from "@/lib/utils";

/**
 * UBS-Mux brand mark.
 * Concept: three streams (5G uplinks) converge into one bonded 4K output —
 * a literal multiplex glyph. Tiny "5G·4K" caption sits inside the frame as a
 * machined nameplate, not as decoration.
 */
export function BrandLogo({
  className,
  size = 32,
  showCaption = true,
}: {
  className?: string;
  size?: number;
  showCaption?: boolean;
}) {
  const id = "ubsmux";
  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      aria-label="UBS-Mux"
    >
      <svg viewBox="0 0 48 48" width={size} height={size} className="block">
        <defs>
          <linearGradient id={`${id}-surface`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.22 0.04 250)" />
            <stop offset="100%" stopColor="oklch(0.14 0.03 260)" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.75 0.14 220)" stopOpacity="0.7" />
            <stop offset="55%" stopColor="oklch(0.55 0.16 250)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.65 0.18 290)" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id={`${id}-stream`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.72 0.16 220)" />
            <stop offset="100%" stopColor="oklch(0.85 0.14 200)" />
          </linearGradient>
          <linearGradient id={`${id}-bond`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.78 0.16 230)" />
            <stop offset="100%" stopColor="oklch(0.92 0.10 200)" />
          </linearGradient>
        </defs>

        {/* chamfered tile */}
        <path
          d="M10 1 H38 A9 9 0 0 1 47 10 V38 A9 9 0 0 1 38 47 H10 A9 9 0 0 1 1 38 V10 A9 9 0 0 1 10 1 Z"
          fill={`url(#${id}-surface)`}
          stroke={`url(#${id}-edge)`}
          strokeWidth="1"
        />

        {/* subtle inner bevel */}
        <path
          d="M10 3 H38 A7 7 0 0 1 45 10 V38 A7 7 0 0 1 38 45 H10 A7 7 0 0 1 3 38 V10 A7 7 0 0 1 10 3 Z"
          fill="none"
          stroke="oklch(1 0 0)"
          strokeOpacity="0.05"
          strokeWidth="1"
        />

        {/* three streams converging into one — the "mux" glyph */}
        <g fill="none" strokeLinecap="round">
          {/* faint guide rail */}
          <path d="M9 24 H39" stroke="oklch(1 0 0)" strokeOpacity="0.06" strokeWidth="0.75" />

          {/* uplink streams */}
          <path
            d="M9 14 C 18 14, 20 24, 28 24"
            stroke={`url(#${id}-stream)`}
            strokeOpacity="0.55"
            strokeWidth="1.4"
          />
          <path
            d="M9 24 H 28"
            stroke={`url(#${id}-stream)`}
            strokeOpacity="0.85"
            strokeWidth="1.6"
          />
          <path
            d="M9 34 C 18 34, 20 24, 28 24"
            stroke={`url(#${id}-stream)`}
            strokeOpacity="0.55"
            strokeWidth="1.4"
          />

          {/* bonded output */}
          <path
            d="M28 24 H 39"
            stroke={`url(#${id}-bond)`}
            strokeWidth="2.6"
          />
        </g>

        {/* junction node */}
        <circle cx="28" cy="24" r="2" fill="oklch(0.95 0.06 210)" />
        <circle cx="28" cy="24" r="3.6" fill="none" stroke="oklch(0.85 0.12 210)" strokeOpacity="0.35" />

        {/* uplink dots */}
        <circle cx="9" cy="14" r="1.1" fill="oklch(0.8 0.12 220)" opacity="0.85" />
        <circle cx="9" cy="24" r="1.1" fill="oklch(0.85 0.13 210)" />
        <circle cx="9" cy="34" r="1.1" fill="oklch(0.8 0.12 220)" opacity="0.85" />

        {/* output terminal */}
        <rect x="38.5" y="22.4" width="3.2" height="3.2" rx="0.6" fill="oklch(0.92 0.10 200)" />

        {showCaption ? (
          <text
            x="24"
            y="42"
            textAnchor="middle"
            fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
            fontSize="5"
            fontWeight="600"
            letterSpacing="1.2"
            fill="oklch(0.78 0.04 230)"
            opacity="0.85"
          >
            5G · 4K
          </text>
        ) : null}
      </svg>
    </div>
  );
}
