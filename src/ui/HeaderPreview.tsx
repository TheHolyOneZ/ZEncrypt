import { useEffect, useRef, useState } from "react";
import type { ZencHeaderInfo } from "../ipc/bridge";
import { verifyIntegrity } from "../ipc/bridge";
import { onVerifyProgress } from "../ipc/events";
import { ShieldCheck, ShieldAlert, Loader2, Lock, KeyRound, Zap } from "./icons";
import { useToastStore } from "../store/toastStore";
import { pathTail } from "../util/pathTail";

interface Props {
  header: ZencHeaderInfo;
  zencPath: string;
  password?: string;
  keyfilePath?: string;
  privateKeyPath?: string;
}

type VerifyState = "idle" | "running" | "ok" | "fail";

export function HeaderPreview({ header, zencPath, password, keyfilePath, privateKeyPath }: Props) {
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [verifyPct, setVerifyPct] = useState(0);
  const toast = useToastStore();
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onVerifyProgress((p) => {
      if (p.inputPath !== zencPath) return;
      const pct = p.bytesTotal > 0 ? (p.bytesDone / p.bytesTotal) * 100 : 0;
      setVerifyPct(pct);
    }).then((un) => {
      unlistenRef.current = un;
    });
    return () => {
      unlistenRef.current?.();
    };
  }, [zencPath]);

  const handleVerify = async () => {


    const needsCreds = header.isPubkey
      ? !privateKeyPath
      : (header.hasKeyfile || !password ? !password || (header.hasKeyfile && !keyfilePath) : false);
    if (needsCreds) {
      const hint = header.isPubkey
        ? "Select your private key above first, then verify."
        : "Enter the password" + (header.hasKeyfile ? " and keyfile" : "") + " above first, then verify.";
      toast.push("info", hint);
      return;
    }
    setVerifyState("running");
    setVerifyPct(0);
    try {
      const ok = await verifyIntegrity(zencPath, password, keyfilePath, privateKeyPath);
      setVerifyState(ok ? "ok" : "fail");
      if (ok) {
        toast.push("success", "Integrity verified — the archive is authentic and unmodified.");
      } else {
        toast.push("error", "Integrity check failed — the archive may be corrupted or tampered with.");
      }
    } catch {
      setVerifyState("fail");
      toast.push("error", "Integrity check failed.");
    }
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ze-text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Archive info
      </div>

      <div className="rounded-xl p-3 flex flex-col gap-2 ze-glass-1">
        <Row label="File" value={pathTail(zencPath)} />
        <Row
          label="Cipher"
          value={header.cipher}
          icon={<Lock size={11} style={{ color: "var(--ze-accent)" }} />}
        />
        <Row
          label="Key strength"
          value={`${header.kdfPresetLabel} · ${Math.round(header.kdfMKib / 1024)} MiB · ${header.kdfTIters}×`}
          icon={<Zap size={11} style={{ color: "var(--ze-text-3)" }} />}
        />
        {header.isPubkey ? (
          <Row
            label="Recipient key"
            value={header.recipientFingerprint ? `Required · ${header.recipientFingerprint}` : "Required"}
            icon={<KeyRound size={11} style={{ color: "var(--ze-accent)" }} />}
            highlight
          />
        ) : (
          <Row
            label="Keyfile"
            value={
              header.hasKeyfile
                ? header.keyfileFingerprint
                  ? `Required · ${header.keyfileFingerprint}`
                  : "Required"
                : "None"
            }
            icon={<KeyRound size={11} style={{ color: header.hasKeyfile ? "var(--ze-accent)" : "var(--ze-text-3)" }} />}
            highlight={header.hasKeyfile}
          />
        )}
        <Row label="Compressed" value={header.isCompressed ? "Yes" : "No"} />
      </div>


      <button
        onClick={handleVerify}
        disabled={verifyState === "running"}
        className="flex items-center justify-center gap-2 relative overflow-hidden"
        style={{
          background: verifyState === "ok"
            ? "rgba(76,222,140,0.1)"
            : verifyState === "fail"
            ? "rgba(240,112,112,0.1)"
            : "rgba(255,255,255,0.04)",
          border: verifyState === "ok"
            ? "1px solid rgba(76,222,140,0.25)"
            : verifyState === "fail"
            ? "1px solid rgba(240,112,112,0.25)"
            : "1px solid var(--ze-border-hair)",
          borderRadius: 9,
          padding: "7px 0",
          color: verifyState === "ok"
            ? "var(--ze-success)"
            : verifyState === "fail"
            ? "var(--ze-error)"
            : "var(--ze-text-2)",
          fontSize: 12,
          fontWeight: 500,
          cursor: verifyState === "running" ? "not-allowed" : "pointer",
          opacity: verifyState === "running" ? 0.85 : 1,
          transition: "all 200ms",
        }}
      >

        {verifyState === "running" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(122,162,255,0.10)",
              transform: `scaleX(${Math.max(0.02, verifyPct / 100)})`,
              transformOrigin: "left",
              transition: "transform 200ms ease-out",
              zIndex: 0,
            }}
          />
        )}
        <span className="flex items-center gap-2" style={{ position: "relative", zIndex: 1 }}>
          {verifyState === "running" ? (
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          ) : verifyState === "ok" ? (
            <ShieldCheck size={13} />
          ) : verifyState === "fail" ? (
            <ShieldAlert size={13} />
          ) : (
            <ShieldCheck size={13} />
          )}
          {verifyState === "running"
            ? `Verifying… ${verifyPct.toFixed(0)}%`
            : verifyState === "ok"
            ? "Integrity verified"
            : verifyState === "fail"
            ? "Integrity failed"
            : "Verify integrity"}
        </span>
      </button>
    </div>
  );
}

function Row({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span style={{ fontSize: 12, color: "var(--ze-text-3)" }}>{label}</span>
      <div className="flex items-center gap-1.5">
        {icon}
        <span style={{ fontSize: 12, color: highlight ? "var(--ze-accent)" : "var(--ze-text-1)", fontWeight: 500 }}>
          {value}
        </span>
      </div>
    </div>
  );
}
