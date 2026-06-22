import { useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { JobStats } from "../store/jobStore";
import { formatBytes } from "../util/formatBytes";
import { pathTail } from "../util/pathTail";
import { copyWithAutoClear } from "../util/clipboard";
import { CheckCircle2, FolderOpen, Copy, Check, RotateCcw, ShieldCheck } from "./icons";

interface Props {
  mode: "encrypt" | "decrypt";
  outputPath: string;
  stats: JobStats;
  onReset: () => void;
}

export function SuccessScreen({ mode, outputPath, stats, onReset }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyWithAutoClear(outputPath, "Path copied").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="flex flex-col items-center gap-5 ze-glass-2 rounded-2xl p-8"
        style={{ maxWidth: 400, width: "100%", animation: "ze-modal-in 240ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            background: "var(--ze-success-dim)",
            border: "1px solid rgba(76,222,140,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle2 size={28} style={{ color: "var(--ze-success)" }} />
        </div>

        <div className="text-center flex flex-col gap-1">
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--ze-text-1)", margin: 0 }}>
            {mode === "encrypt" ? "Encrypted successfully" : "Decrypted successfully"}
          </h2>
          {stats.bytesDone > 0 && (
            <p style={{ fontSize: 12, color: "var(--ze-text-3)", margin: 0 }}>
              {formatBytes(stats.bytesDone)} processed
            </p>
          )}
        </div>


        <div
          className="flex items-start gap-2 w-full rounded-xl"
          style={{
            background: "rgba(122,162,255,0.06)",
            border: "1px solid rgba(122,162,255,0.18)",
            padding: "10px 12px",
          }}
        >
          <ShieldCheck size={14} style={{ color: "var(--ze-accent)", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11.5, color: "var(--ze-text-2)", margin: 0, lineHeight: 1.55 }}>
            {mode === "encrypt"
              ? "You can safely share this .zsec file over email, chat, or cloud storage — nobody can open it without your password (and keyfile, if you used one). Store the password somewhere you won't lose it; without it, the file cannot be recovered."
              : "Your files were extracted to the folder shown below. The original .zsec archive is unchanged — keep it if you still need it, or delete it if you no longer do."}
          </p>
        </div>


        <div
          className="flex items-center gap-2 w-full rounded-xl"
          draggable
          onDragStart={(e) => {
            const uri = `file://${outputPath}`;
            e.dataTransfer.setData("text/uri-list", uri);
            e.dataTransfer.setData("text/plain", outputPath);
            e.dataTransfer.effectAllowed = "copy";
          }}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--ze-border-hair)",
            padding: "10px 12px",
            cursor: "grab",
          }}
          title="Drag to share, or use Reveal to open the folder"
        >
          <FolderOpen size={14} style={{ color: "var(--ze-text-3)", flexShrink: 0 }} />
          <span
            className="flex-1 truncate"
            style={{ fontSize: 12, color: "var(--ze-text-2)" }}
            title={outputPath}
          >
            {pathTail(outputPath)}
          </span>
          <button
            onClick={handleCopy}
            title="Copy path"
            style={{
              background: "none",
              border: "none",
              color: copied ? "var(--ze-success)" : "var(--ze-text-3)",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              transition: "color 200ms",
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button
            onClick={() => revealItemInDir(outputPath).catch(() => {})}
            style={{
              background: "none",
              border: "none",
              color: "var(--ze-text-3)",
              cursor: "pointer",
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 5,
              transition: "color 150ms, background 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--ze-text-1)";
              e.currentTarget.style.background = "rgba(255,255,255,0.07)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--ze-text-3)";
              e.currentTarget.style.background = "none";
            }}
          >
            Reveal
          </button>
        </div>

        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, var(--ze-accent), color-mix(in srgb, var(--ze-accent) 78%, #fff))",
            border: "none",
            borderRadius: 10,
            padding: "9px 28px",
            color: "#07080e",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            width: "100%",
            boxShadow: "0 2px 14px rgba(122,162,255,0.32)",
          }}
        >
          <RotateCcw size={13} strokeWidth={2.5} />
          {mode === "encrypt" ? "Encrypt more" : "Decrypt more"}
        </button>
      </div>
    </div>
  );
}
