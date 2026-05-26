import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const SCALE_DB = [0, -6, -12, -18, -24, -36, -48, -60];
const MIN_DB = -60;
const MAX_DB = 6; // a bit of headroom above 0 for clipping
const RANGE = MAX_DB - MIN_DB;

function dbToPct(db: number): number {
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  return ((clamped - MIN_DB) / RANGE) * 100;
}

const ZERO_PCT = dbToPct(0);
const Y6_PCT = dbToPct(-6);
const Y18_PCT = dbToPct(-18);

/**
 * Broadcast-style vertical dual-channel loudness meter.
 *
 * Without real PCM access we generate a smooth, plausible level envelope
 * (per-channel RMS + peak hold) driven by requestAnimationFrame so it looks
 * alive when `active` is true and stays at -inf when not.
 */
export function AudioLoudnessMeter({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const lRef = useRef<HTMLDivElement | null>(null);
  const rRef = useRef<HTMLDivElement | null>(null);
  const lPeakRef = useRef<HTMLDivElement | null>(null);
  const rPeakRef = useRef<HTMLDivElement | null>(null);
  const lValRef = useRef<HTMLDivElement | null>(null);
  const rValRef = useRef<HTMLDivElement | null>(null);

  // simulation state
  const state = useRef({
    l: MIN_DB,
    r: MIN_DB,
    lPeak: MIN_DB,
    rPeak: MIN_DB,
    lPeakAt: 0,
    rPeakAt: 0,
    targetL: MIN_DB,
    targetR: MIN_DB,
    nextTargetAt: 0,
  });

  useEffect(() => {
    // When inactive: reset all values to silence, render once, and do NOT run rAF.
    if (!active) {
      const s = state.current;
      s.l = MIN_DB;
      s.r = MIN_DB;
      s.lPeak = MIN_DB;
      s.rPeak = MIN_DB;
      s.targetL = MIN_DB;
      s.targetR = MIN_DB;
      if (lRef.current) lRef.current.style.height = `0%`;
      if (rRef.current) rRef.current.style.height = `0%`;
      if (lPeakRef.current) lPeakRef.current.style.bottom = `0%`;
      if (rPeakRef.current) rPeakRef.current.style.bottom = `0%`;
      if (lValRef.current) lValRef.current.textContent = "-∞";
      if (rValRef.current) rValRef.current.textContent = "-∞";
      return;
    }

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const s = state.current;

      if (now >= s.nextTargetAt) {
        const r = Math.random();
        let target: number;
        if (r < 0.7) target = -28 + Math.random() * 12;
        else if (r < 0.95) target = -16 + Math.random() * 10;
        else target = -6 + Math.random() * 7;
        s.targetL = target + (Math.random() - 0.5) * 4;
        s.targetR = target + (Math.random() - 0.5) * 4;
        s.nextTargetAt = now + 70 + Math.random() * 140;
      }
      const attack = 0.35;
      const release = 0.08;
      const stepL = s.targetL > s.l ? attack : release;
      const stepR = s.targetR > s.r ? attack : release;
      s.l += (s.targetL - s.l) * stepL * (dt / 16);
      s.r += (s.targetR - s.r) * stepR * (dt / 16);

      if (s.l > s.lPeak) {
        s.lPeak = s.l;
        s.lPeakAt = now;
      } else if (now - s.lPeakAt > 1200) {
        s.lPeak -= 0.12 * (dt / 16);
      }
      if (s.r > s.rPeak) {
        s.rPeak = s.r;
        s.rPeakAt = now;
      } else if (now - s.rPeakAt > 1200) {
        s.rPeak -= 0.12 * (dt / 16);
      }
      if (s.lPeak < s.l) s.lPeak = s.l;
      if (s.rPeak < s.r) s.rPeak = s.r;

      const lPct = dbToPct(s.l);
      const rPct = dbToPct(s.r);
      const lPeakPct = dbToPct(s.lPeak);
      const rPeakPct = dbToPct(s.rPeak);

      if (lRef.current) lRef.current.style.height = `${lPct}%`;
      if (rRef.current) rRef.current.style.height = `${rPct}%`;
      if (lPeakRef.current) lPeakRef.current.style.bottom = `${lPeakPct}%`;
      if (rPeakRef.current) rPeakRef.current.style.bottom = `${rPeakPct}%`;
      if (lValRef.current)
        lValRef.current.textContent = s.l <= MIN_DB + 0.5 ? "-∞" : s.l.toFixed(0);
      if (rValRef.current)
        rValRef.current.textContent = s.r <= MIN_DB + 0.5 ? "-∞" : s.r.toFixed(0);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);


  // Build the gradient once: green (safe) -> yellow (warn) -> red (danger).
  // CSS percentages go bottom-up because we use bottom alignment.
  const fillGradient = `linear-gradient(to top,
    #16a34a 0%,
    #22c55e ${Y18_PCT - 0.5}%,
    #eab308 ${Y18_PCT}%,
    #facc15 ${Y6_PCT - 0.5}%,
    #ef4444 ${Y6_PCT}%,
    #dc2626 ${ZERO_PCT}%,
    #b91c1c 100%)`;

  return (
    <div
      className={cn(
        "pointer-events-none flex h-full select-none items-stretch gap-[2px] bg-black/55 px-1 py-1 backdrop-blur-sm",
        className,
      )}
      aria-label="音频响度"
    >
      {/* Scale ticks */}
      <div className="relative flex w-3.5 flex-col justify-between text-[7px] font-mono leading-none text-white/70">
        {SCALE_DB.map((db) => (
          <div
            key={db}
            className={cn(
              "tabular-nums text-right",
              db === 0 && "text-red-400",
              db === -6 && "text-yellow-300",
            )}
          >
            {db}
          </div>
        ))}
      </div>

      {/* Channel L */}
      <ChannelColumn
        label="L"
        fillRef={lRef}
        peakRef={lPeakRef}
        valueRef={lValRef}
        fillGradient={fillGradient}
        active={active}
      />
      {/* Channel R */}
      <ChannelColumn
        label="R"
        fillRef={rRef}
        peakRef={rPeakRef}
        valueRef={rValRef}
        fillGradient={fillGradient}
        active={active}
      />
    </div>
  );
}

function ChannelColumn({
  label,
  fillRef,
  peakRef,
  valueRef,
  fillGradient,
  active,
}: {
  label: string;
  fillRef: React.RefObject<HTMLDivElement | null>;
  peakRef: React.RefObject<HTMLDivElement | null>;
  valueRef: React.RefObject<HTMLDivElement | null>;
  fillGradient: string;
  active: boolean;
}) {
  return (
    <div className="flex w-2 flex-col items-center gap-0.5">
      <div className="relative h-full w-full overflow-hidden rounded-[2px] border border-white/15 bg-black/80">
        {/* Faint full-range gradient backplate for context */}
        <div
          className="absolute inset-0 opacity-15"
          style={{ background: fillGradient }}
        />
        {/* Active fill (bottom-anchored) */}
        <div
          ref={fillRef}
          className="absolute bottom-0 left-0 right-0 will-change-[height]"
          style={{
            height: "0%",
            background: fillGradient,
            transition: "height 60ms linear",
            boxShadow: active ? "0 0 6px rgba(239, 68, 68, 0.25) inset" : undefined,
          }}
        />
        {/* Tick marks overlay (-6, -18 reference lines) */}
        <div
          className="absolute left-0 right-0 h-px bg-white/25"
          style={{ bottom: `${ZERO_PCT}%` }}
        />
        <div
          className="absolute left-0 right-0 h-px bg-yellow-300/40"
          style={{ bottom: `${Y6_PCT}%` }}
        />
        <div
          className="absolute left-0 right-0 h-px bg-emerald-300/30"
          style={{ bottom: `${Y18_PCT}%` }}
        />
        {/* Peak hold marker */}
        <div
          ref={peakRef}
          className="absolute left-0 right-0 h-[1.5px] bg-white shadow-[0_0_2px_rgba(255,255,255,0.8)]"
          style={{ bottom: "0%" }}
        />
      </div>
      <div className="text-[8px] font-semibold leading-none text-white/80">{label}</div>
      <div
        ref={valueRef}
        className="font-mono text-[8px] leading-none tabular-nums text-white/60"
      >
        -∞
      </div>
    </div>
  );
}
