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

// Faint zone-coloured backplate so the user can read the scale even when silent
const BACKPLATE_GRADIENT = `linear-gradient(to top,
  rgba(34,197,94,0.12)  0%,
  rgba(34,197,94,0.12)  ${Y18_PCT.toFixed(1)}%,
  rgba(234,179,8,0.12)  ${Y18_PCT.toFixed(1)}%,
  rgba(234,179,8,0.12)  ${Y6_PCT.toFixed(1)}%,
  rgba(239,68,68,0.15)  ${Y6_PCT.toFixed(1)}%,
  rgba(239,68,68,0.15)  ${ZERO_PCT.toFixed(1)}%,
  rgba(220,38,38,0.22)  ${ZERO_PCT.toFixed(1)}%,
  rgba(220,38,38,0.22)  100%)`;

/**
 * Returns a CSS background for the fill bar that follows broadcast colour rules:
 * green (safe) / yellow (warning) / red (danger) / flashing-red (clipping).
 * Colour boundaries are expressed as percentages *within the fill bar itself*,
 * so they always land at the correct dB position regardless of bar height.
 */
function levelGradient(db: number, now: number): string {
  const pct = dbToPct(db);
  if (pct < 0.01) return 'transparent';

  // Where the zone boundaries fall inside this bar (0-100%)
  const g18 = Math.min(99.9, (Y18_PCT / pct) * 100);
  const g6  = Math.min(99.9, (Y6_PCT  / pct) * 100);
  const g0  = Math.min(99.9, (ZERO_PCT / pct) * 100);

  if (db <= -18) {
    return '#00ff00';
  }
  if (db <= -6) {
    return `linear-gradient(to top,#22c55e 0%,#22c55e ${g18.toFixed(1)}%,#eab308 ${g18.toFixed(1)}%,#eab308 100%)`;
  }
  if (db <= 0) {
    return `linear-gradient(to top,#22c55e 0%,#22c55e ${g18.toFixed(1)}%,#eab308 ${g18.toFixed(1)}%,#eab308 ${g6.toFixed(1)}%,#ef4444 ${g6.toFixed(1)}%,#ef4444 100%)`;
  }
  // Clipping: flash the region above 0 dB at ~2.5 Hz
  const clipColor = Math.floor(now / 200) % 2 === 0 ? '#ff1111' : '#7f0000';
  return `linear-gradient(to top,#22c55e 0%,#22c55e ${g18.toFixed(1)}%,#eab308 ${g18.toFixed(1)}%,#eab308 ${g6.toFixed(1)}%,#ef4444 ${g6.toFixed(1)}%,#ef4444 ${g0.toFixed(1)}%,${clipColor} ${g0.toFixed(1)}%,${clipColor} 100%)`;
}

/**
 * Broadcast-style vertical dual-channel loudness meter.
 *
 * Receives per-channel dBFS levels via postMessage from the go2rtc stream.html
 * iframe (which runs the audio analysis inside its same-origin WebRTC connection).
 * Messages: { type: 'audio-levels', volumeL: number, volumeR: number }
 *           { type: 'audio-levels-stop' }
 */
export function AudioLoudnessMeter({
  active,
  webrtcUrl,
  className,
}: {
  active: boolean;
  /** Full go2rtc stream.html URL, e.g. "http://host:port/stream.html?src=540p" */
  webrtcUrl?: string | null;
  className?: string;
}) {
  const lRef = useRef<HTMLDivElement | null>(null);
  const rRef = useRef<HTMLDivElement | null>(null);
  const lPeakRef = useRef<HTMLDivElement | null>(null);
  const rPeakRef = useRef<HTMLDivElement | null>(null);
  const lValRef = useRef<HTMLDivElement | null>(null);
  const rValRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const resetMeter = () => {
      if (lRef.current) lRef.current.style.height = "0%";
      if (rRef.current) rRef.current.style.height = "0%";
      if (lPeakRef.current) lPeakRef.current.style.bottom = "0%";
      if (rPeakRef.current) rPeakRef.current.style.bottom = "0%";
      if (lValRef.current) lValRef.current.textContent = "-∞";
      if (rValRef.current) rValRef.current.textContent = "-∞";
    };

    if (!active || !webrtcUrl) {
      resetMeter();
      return;
    }

    let expectedOrigin: string;
    try {
      expectedOrigin = new URL(webrtcUrl).origin;
    } catch {
      resetMeter();
      return;
    }

    const peakL = { val: MIN_DB, at: 0 };
    const peakR = { val: MIN_DB, at: 0 };

    const pushFrame = (dbL: number, dbR: number, now: number) => {
      if (dbL > peakL.val) { peakL.val = dbL; peakL.at = now; }
      else if (now - peakL.at > 1200) peakL.val -= 0.12;
      if (dbR > peakR.val) { peakR.val = dbR; peakR.at = now; }
      else if (now - peakR.at > 1200) peakR.val -= 0.12;
      if (peakL.val < dbL) peakL.val = dbL;
      if (peakR.val < dbR) peakR.val = dbR;

      if (lRef.current) lRef.current.style.height = `${dbToPct(dbL)}%`;
      if (lRef.current) lRef.current.style.background = levelGradient(dbL, now);
      if (rRef.current) rRef.current.style.height = `${dbToPct(dbR)}%`;
      if (rRef.current) rRef.current.style.background = levelGradient(dbR, now);
      if (lPeakRef.current) lPeakRef.current.style.bottom = `${dbToPct(peakL.val)}%`;
      if (rPeakRef.current) rPeakRef.current.style.bottom = `${dbToPct(peakR.val)}%`;
      if (lValRef.current) lValRef.current.textContent = dbL <= MIN_DB + 0.5 ? "-∞" : dbL.toFixed(0);
      if (rValRef.current) rValRef.current.textContent = dbR <= MIN_DB + 0.5 ? "-∞" : dbR.toFixed(0);
    };

    const handler = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;
      const data = event.data as { type: string; volumeL?: number; volumeR?: number } | null;
      if (!data) return;
      if (data.type === 'audio-levels-stop') { resetMeter(); return; }
      if (data.type !== 'audio-levels') return;
      pushFrame(data.volumeL ?? MIN_DB, data.volumeR ?? MIN_DB, performance.now());
    };

    window.addEventListener('message', handler);

    return () => {
      window.removeEventListener('message', handler);
      resetMeter();
    };
  }, [active, webrtcUrl]);

  return (
    <div
      className={cn(
        "pointer-events-none flex h-full select-none items-stretch gap-[2px] bg-black/55 px-1 py-1 backdrop-blur-sm",
        className,
      )}
      aria-label="音频响度"
    >
      {/* Scale ticks */}
      <div className="relative flex w-4 flex-col justify-between text-[9px] font-mono leading-none text-white/70">
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
        active={active}
      />
      {/* Channel R */}
      <ChannelColumn
        label="R"
        fillRef={rRef}
        peakRef={rPeakRef}
        active={active}
      />
    </div>
  );
}

function ChannelColumn({
  label,
  fillRef,
  peakRef,
  active,
}: {
  label: string;
  fillRef: React.RefObject<HTMLDivElement | null>;
  peakRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
}) {
  return (
    <div className="flex w-2 flex-col items-center gap-0.5">
      <div className="relative h-full w-full overflow-hidden rounded-[2px] border border-white/15 bg-black/80">
        {/* Zone-coloured backplate: faint colour bands show safe/warn/danger at a glance */}
        <div
          className="absolute inset-0"
          style={{ background: BACKPLATE_GRADIENT }}
        />
        {/* Active fill (bottom-anchored); height + background set per-frame via ref */}
        <div
          ref={fillRef}
          className="absolute bottom-0 left-0 right-0 will-change-[height,background]"
          style={{
            height: "0%",
            boxShadow: active ? "0 0 4px rgba(255,255,255,0.15) inset" : undefined,
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
      <div className="text-[9px] font-semibold leading-none text-white/80">{label}</div>
    </div>
  );
}
