import { cn } from "@/lib/utils";

export function BrandLogo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-md overflow-hidden",
        "shadow-[0_0_12px_-2px_color-mix(in_oklab,var(--primary)_55%,transparent)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="UBS-Mux logo"
    >
      <svg viewBox="0 0 40 40" width={size} height={size} className="block">
        <defs>
          <linearGradient id="ubs-logo-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.55 0.18 250)" />
            <stop offset="100%" stopColor="oklch(0.42 0.16 280)" />
          </linearGradient>
          <linearGradient id="ubs-logo-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.15 220)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="oklch(0.65 0.18 280)" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="8" fill="url(#ubs-logo-bg)" />
        <rect
          x="1"
          y="1"
          width="38"
          height="38"
          rx="8"
          fill="none"
          stroke="url(#ubs-logo-stroke)"
          strokeWidth="1"
        />
        {/* diagonal divider */}
        <line x1="6" y1="34" x2="34" y2="6" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        {/* 5G top-left */}
        <text
          x="9"
          y="17"
          fontFamily="ui-sans-serif, system-ui, -apple-system, 'SF Pro Display', sans-serif"
          fontSize="11"
          fontWeight="800"
          fill="#fff"
          letterSpacing="-0.5"
        >
          5G
        </text>
        {/* 4K bottom-right */}
        <text
          x="20"
          y="33"
          fontFamily="ui-sans-serif, system-ui, -apple-system, 'SF Pro Display', sans-serif"
          fontSize="11"
          fontWeight="800"
          fill="#fff"
          letterSpacing="-0.5"
        >
          4K
        </text>
      </svg>
    </div>
  );
}
