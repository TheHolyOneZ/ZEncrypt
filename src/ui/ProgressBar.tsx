import { useState } from "react";
import type { Progress } from "../store/jobStore";
import { formatBytes } from "../util/formatBytes";
import { formatEta } from "../util/formatDuration";
import { Lock, LockOpen, Zap, Timer, X } from "./icons";

interface Props {
  mode: "encrypt" | "decrypt";
  progress: Progress;
  onCancel: () => void;
  isPubkey?: boolean;
}

export function ProgressBar({ mode, progress, onCancel, isPubkey }: Props) {
  const { bytesDone, bytesTotal, throughputMbs, etaMs } = progress;
  const pct = bytesTotal > 0 ? Math.min(100, (bytesDone / bytesTotal) * 100) : 0;
  const label = mode === "encrypt" ? "Encrypting" : "Decrypting";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(true);
  const Icon = mode === "encrypt" ? Lock : LockOpen;


  const prePhaseLabel = mode === "encrypt"
    ? isPubkey
      ? "Wrapping key for recipient…"
      : "Deriving encryption key — this can take a few seconds…"
    : isPubkey
      ? "Unwrapping recipient key and reading archive…"
      : "Verifying password and reading archive…";

  const handleCancel = () => {
    if (!cancelArmed) return;
    if (confirmCancel) {
      onCancel();
      return;
    }
    setConfirmCancel(true);
    setCancelArmed(false);
    setTimeout(() => setCancelArmed(true), 400);
    setTimeout(() => setConfirmCancel(false), 3000);
  };

  return (
    <div
      className="shrink-0 flex flex-col gap-2.5 px-5 py-3 ze-glass-1"
      style={{ borderRadius: "0 0 12px 12px", borderTop: "1px solid var(--ze-border-hair)" }}
    >

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon size={13} style={{ color: mode === "encrypt" ? "var(--ze-accent)" : "var(--ze-success)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--ze-text-2)", fontWeight: 500 }}>{label}…</span>
          {bytesTotal > 0 && (
            <span style={{ fontSize: 11, color: "var(--ze-text-3)" }}>
              {formatBytes(bytesDone)} / {formatBytes(bytesTotal)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {throughputMbs > 0 && (
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--ze-text-3)" }}>
                <Zap size={10} />
                {throughputMbs.toFixed(1)} MB/s
              </span>
              {etaMs > 0 && (
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--ze-text-3)" }}>
                  <Timer size={10} />
                  {formatEta(etaMs)}
                </span>
              )}
            </div>
          )}

          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5"
            style={{
              background: confirmCancel ? "rgba(240,112,112,0.22)" : "rgba(240,112,112,0.10)",
              border: `1px solid ${confirmCancel ? "rgba(240,112,112,0.5)" : "rgba(240,112,112,0.22)"}`,
              borderRadius: 8,
              color: "var(--ze-error)",
              cursor: "pointer",
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: confirmCancel ? 600 : 500,
              transition: "background 200ms, border-color 200ms",
            }}
          >
            <X size={11} />
            {confirmCancel ? "Confirm cancel" : "Cancel"}
          </button>
        </div>
      </div>


      <div
        style={{
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: bytesTotal === 0 ? "100%" : `${pct}%`,
            background: mode === "encrypt"
              ? `linear-gradient(90deg, var(--ze-accent) 0%, color-mix(in srgb, var(--ze-accent) 70%, #fff) 100%)`
              : `linear-gradient(90deg, var(--ze-success) 0%, color-mix(in srgb, var(--ze-success) 70%, #fff) 100%)`,
            borderRadius: 3,
            transition: bytesTotal === 0 ? "none" : "width 200ms ease",
            animation: bytesTotal === 0 ? "ze-indeterminate 1.4s ease-in-out infinite" : undefined,
          }}
        />
      </div>


      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, color: "var(--ze-text-3)" }}>
          {bytesTotal === 0 ? prePhaseLabel : `${pct.toFixed(0)}%`}
        </span>
        {bytesTotal > 0 && (
          <span style={{ fontSize: 10, color: "var(--ze-text-3)" }}>
            {formatBytes(bytesTotal - bytesDone)} remaining
          </span>
        )}
      </div>
    </div>
  );
}
