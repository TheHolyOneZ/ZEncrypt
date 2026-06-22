import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
import { appLocalDataDir } from "@tauri-apps/api/path";
import { X, ExternalLink, Github, Globe } from "./icons";
import { useModKey } from "../util/platform";

interface Props {
  onClose: () => void;
}

export function AboutModal({ onClose }: Props) {
  const [version, setVersion] = useState("…");
  const mod = useModKey();

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("—"));

    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const openDataDir = async () => {
    try {
      const dir = await appLocalDataDir();
      await revealItemInDir(dir);
    } catch {}
  };

  const openLink = (url: string) => {
    openUrl(url).catch(() => {});
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="ze-glass-2 rounded-2xl flex flex-col"
        style={{
          width: 360,
          maxWidth: "100%",
          maxHeight: "100%",
          overflow: "hidden",
          animation: "ze-modal-in 220ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        <div className="flex justify-end w-full px-4 pt-4 shrink-0">
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--ze-text-3)",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center",
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center w-full">
        <div className="flex flex-col items-center gap-2 px-8 pb-2">
          <img
            src="/icon-128.png"
            alt="ZEncrypt"
            width={64}
            height={64}
            style={{
              borderRadius: 18,
              boxShadow: "0 8px 28px rgba(122,162,255,0.35)",
              marginBottom: 4,
              display: "block",
            }}
          />
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              margin: 0,
              background: "linear-gradient(120deg, var(--ze-accent), #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            ZEncrypt
          </h1>
          <p style={{ fontSize: 12, color: "var(--ze-text-3)", margin: 0 }}>
            Version {version}
          </p>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "var(--ze-text-2)",
            textAlign: "center",
            lineHeight: 1.6,
            margin: "16px 32px",
          }}
        >
          Encrypt files and folders with modern authenticated encryption.
          ChaCha20-Poly1305 &amp; AES-256-GCM, Argon2id key derivation,
          streaming AEAD with end-to-end integrity.
        </p>

        <div
          className="flex flex-col gap-0 w-full"
          style={{ borderTop: "1px solid var(--ze-border-hair)", borderBottom: "1px solid var(--ze-border-hair)" }}
        >
          {[
            ["Format", ".zsec v3"],
            ["Ciphers", "ChaCha20-Poly1305, AES-256-GCM"],
            ["KDF", "Argon2id"],
            ["Integrity", "BLAKE3 + per-chunk AEAD"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between px-6 py-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span style={{ fontSize: 12, color: "var(--ze-text-3)" }}>{k}</span>
              <span style={{ fontSize: 12, color: "var(--ze-text-2)" }}>{v}</span>
            </div>
          ))}
        </div>

        <div
          className="flex flex-col gap-0 w-full"
          style={{ borderBottom: "1px solid var(--ze-border-hair)" }}
        >
          <div
            className="px-6 pt-3 pb-2"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ze-text-3)",
            }}
          >
            Keyboard shortcuts
          </div>
          {[
            ["Encrypt", `${mod}+E`],
            ["Decrypt", `${mod}+D`],
            ["Cancel running job", "Esc"],
            ["Recent operations", `${mod}+H`],
            ["Keyfile manager", `${mod}+K`],
            ["Settings", `${mod}+,`],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between px-6 py-1.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
            >
              <span style={{ fontSize: 12, color: "var(--ze-text-3)" }}>{k}</span>
              <kbd
                style={{
                  fontSize: 11,
                  color: "var(--ze-text-1)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--ze-border-hair)",
                  borderRadius: 4,
                  padding: "1px 6px",
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                }}
              >
                {v}
              </kbd>
            </div>
          ))}
        </div>

        <div
          className="flex flex-col gap-0 w-full"
          style={{ borderBottom: "1px solid var(--ze-border-hair)" }}
        >
          <div
            className="px-6 pt-3 pb-2"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ze-text-3)",
            }}
          >
            Developer
          </div>
          {[
            { icon: <Github size={12} />, label: "github.com/TheHolyOneZ", url: "https://github.com/TheHolyOneZ" },
            { icon: <Globe size={12} />, label: "zsync.eu", url: "https://zsync.eu/" },
          ].map((l) => (
            <button
              key={l.url}
              onClick={() => openLink(l.url)}
              className="flex items-center justify-between px-6 py-1.5"
              style={{
                background: "none",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                color: "var(--ze-text-2)",
                cursor: "pointer",
                fontSize: 12,
                textAlign: "left",
                width: "100%",
              }}
            >
              <span className="flex items-center gap-2" style={{ color: "var(--ze-text-3)" }}>
                {l.icon}
                {l.label}
              </span>
              <ExternalLink size={11} style={{ color: "var(--ze-text-3)" }} />
            </button>
          ))}
          <div
            className="px-6 pt-3 pb-2"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ze-text-3)",
            }}
          >
            Project
          </div>
          {[
            { icon: <Github size={12} />, label: "github.com/TheHolyOneZ/ZEncrypt", url: "https://github.com/TheHolyOneZ/ZEncrypt" },
            { icon: <Globe size={12} />, label: "zsync.eu/zencrypt", url: "https://zsync.eu/zencrypt/" },
          ].map((l) => (
            <button
              key={l.url}
              onClick={() => openLink(l.url)}
              className="flex items-center justify-between px-6 py-1.5"
              style={{
                background: "none",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                color: "var(--ze-text-2)",
                cursor: "pointer",
                fontSize: 12,
                textAlign: "left",
                width: "100%",
              }}
            >
              <span className="flex items-center gap-2" style={{ color: "var(--ze-text-3)" }}>
                {l.icon}
                {l.label}
              </span>
              <ExternalLink size={11} style={{ color: "var(--ze-text-3)" }} />
            </button>
          ))}
        </div>
        </div>

        <div className="flex flex-col gap-2 w-full px-6 py-4 shrink-0">
          <button
            onClick={openDataDir}
            className="flex items-center justify-center gap-2"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--ze-border-hair)",
              borderRadius: 8,
              padding: "8px 0",
              color: "var(--ze-text-2)",
              fontSize: 12,
              cursor: "pointer",
              width: "100%",
            }}
          >
            <ExternalLink size={12} />
            Open app data folder
          </button>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--ze-text-3)",
              fontSize: 12,
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
