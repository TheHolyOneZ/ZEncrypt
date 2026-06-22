import { useEffect, useState } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { generateKeyfile, fingerprintKeyfile, generateKeypair, inspectPubkey } from "../ipc/bridge";
import { pathTail } from "../util/pathTail";
import { X, KeyRound, Fingerprint, Copy, Check, Wand2, Search, AlertTriangle } from "./icons";

interface Props {
  onClose: () => void;
}

export function KeyfileManager({ onClose }: Props) {
  const [copiedGen, setCopiedGen] = useState(false);
  const [copiedFp, setCopiedFp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const [genPath, setGenPath] = useState("");
  const [genFingerprint, setGenFingerprint] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState("");

  const [fpPath, setFpPath] = useState("");
  const [fp, setFp] = useState("");
  const [fpKind, setFpKind] = useState<"keyfile" | "pubkey" | "">("");
  const [fpBusy, setFpBusy] = useState(false);
  const [fpError, setFpError] = useState("");

  const [kpPubPath, setKpPubPath] = useState("");
  const [kpPrivPath, setKpPrivPath] = useState("");
  const [kpFp, setKpFp] = useState("");
  const [kpBusy, setKpBusy] = useState(false);
  const [kpError, setKpError] = useState("");

  const handleGenerateKeypair = async () => {
    setKpError("");
    const dest = await save({
      title: "Save keypair as (extensions added automatically)",
      defaultPath: "my-zsec-key",
    });
    if (!dest) return;
    setKpBusy(true);
    try {

      const base = dest.replace(/\.(zkey-pub|zkey-priv)$/i, "");
      const info = await generateKeypair(base);
      setKpPubPath(info.publicPath);
      setKpPrivPath(info.privatePath);
      setKpFp(info.fingerprint);
    } catch (e) {
      setKpError(String(e));
    } finally {
      setKpBusy(false);
    }
  };

  const handleGenerate = async () => {
    setGenError("");
    const dest = await save({
      title: "Save keyfile as",
      defaultPath: "my.keyfile",
    });
    if (!dest) return;
    setGenBusy(true);
    try {
      const info = await generateKeyfile(dest);
      setGenPath(info.path);
      setGenFingerprint(info.fingerprint);
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGenBusy(false);
    }
  };

  const handleFingerprint = async () => {
    setFpError("");
    setFp("");
    setFpKind("");
    const selected = await open({
      title: "Select keyfile or .zkey-pub",
      multiple: false,
      directory: false,
      filters: [
        { name: "Any key file", extensions: ["zkey-pub", "keyfile", "key", "*"] },
      ],
    });
    if (typeof selected !== "string") return;
    setFpPath(selected);
    setFpBusy(true);
    try {

      if (selected.toLowerCase().endsWith(".zkey-pub")) {
        const info = await inspectPubkey(selected);
        setFp(info.fingerprint);
        setFpKind("pubkey");
      } else {
        const result = await fingerprintKeyfile(selected);
        setFp(result);
        setFpKind("keyfile");
      }
    } catch (e) {
      setFpError(String(e));
    } finally {
      setFpBusy(false);
    }
  };

  const copyToClipboard = (text: string, which: "gen" | "fp") => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (which === "gen") {
      setCopiedGen(true);
      setTimeout(() => setCopiedGen(false), 2000);
    } else {
      setCopiedFp(true);
      setTimeout(() => setCopiedFp(false), 2000);
    }
  };

  return (
    <div
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
          width: 440,
          maxWidth: "100%",
          maxHeight: "100%",
          overflow: "hidden",
          animation: "ze-modal-in 220ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >

        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--ze-border-hair)" }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ze-text-1)", margin: 0 }}>
            Keyfile Manager
          </h2>
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

        <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1 min-h-0">

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ze-text-3)" }}>
              <Wand2 size={12} />
              Generate new keyfile
            </div>
            <p style={{ fontSize: 12, color: "var(--ze-text-2)", lineHeight: 1.5, margin: 0 }}>
              Creates a 512-byte CSPRNG keyfile. Store it safely — losing it means losing access to anything encrypted with it.
            </p>
            <button
              onClick={handleGenerate}
              disabled={genBusy}
              className="flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, var(--ze-accent), color-mix(in srgb, var(--ze-accent) 78%, #fff))",
                border: "none",
                borderRadius: 9,
                padding: "9px 0",
                color: "#07080e",
                fontSize: 13,
                fontWeight: 700,
                cursor: genBusy ? "not-allowed" : "pointer",
                opacity: genBusy ? 0.6 : 1,
              }}
            >
              <KeyRound size={14} strokeWidth={2.5} />
              {genBusy ? "Generating…" : "Generate keyfile…"}
            </button>

            {genError && (
              <p style={{ fontSize: 12, color: "var(--ze-error)", margin: 0 }}>{genError}</p>
            )}

            {genPath && (
              <div className="flex flex-col gap-1.5">
                <div
                  style={{
                    background: "rgba(76,222,140,0.06)",
                    border: "1px solid rgba(76,222,140,0.2)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "var(--ze-success)",
                  }}
                >
                  Saved: {pathTail(genPath)}
                </div>
                <div
                  className="flex items-center gap-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--ze-border-hair)",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span style={{ fontSize: 10, color: "var(--ze-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      BLAKE3 fingerprint
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--ze-text-2)",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                        lineHeight: 1.4,
                      }}
                    >
                      {genFingerprint}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(genFingerprint, "gen")}
                    className="flex items-center gap-1.5"
                    style={{
                      background: "none",
                      border: "1px solid var(--ze-border-hair)",
                      borderRadius: 6,
                      color: copiedGen ? "var(--ze-success)" : "var(--ze-text-3)",
                      cursor: "pointer",
                      padding: "4px 8px",
                      fontSize: 11,
                      flexShrink: 0,
                      transition: "color 200ms",
                    }}
                  >
                    {copiedGen ? <Check size={11} /> : <Copy size={11} />}
                    {copiedGen ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>


          <div style={{ borderTop: "1px solid var(--ze-border-hair)" }} />


          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ze-text-3)" }}>
              <KeyRound size={12} />
              Generate keypair — let people encrypt to you
            </div>
            <p style={{ fontSize: 12, color: "var(--ze-text-2)", lineHeight: 1.5, margin: 0 }}>
              Creates an X25519 keypair: a <code style={{ color: "var(--ze-accent)" }}>.zkey-pub</code> you send to anyone who wants to encrypt files for you, and a <code style={{ color: "var(--ze-accent)" }}>.zkey-priv</code> you keep secret — it's the only key that can decrypt those files. No password is involved on either side.
            </p>
            <div
              style={{
                background: "rgba(122,162,255,0.06)",
                border: "1px solid rgba(122,162,255,0.18)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 11.5,
                color: "var(--ze-text-2)",
                lineHeight: 1.55,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ze-accent)", marginBottom: 6 }}>
                How it works
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                <li>You (the recipient) generate the keypair here.</li>
                <li>Keep the <code style={{ color: "var(--ze-accent)" }}>.zkey-priv</code> safe and private — it never leaves your machine.</li>
                <li>Send the <code style={{ color: "var(--ze-accent)" }}>.zkey-pub</code> to whoever wants to encrypt files for you. It's safe to share over email, chat, or even publish publicly.</li>
                <li>They encrypt with your <code style={{ color: "var(--ze-accent)" }}>.zkey-pub</code> and send the archive back. Only your <code style={{ color: "var(--ze-accent)" }}>.zkey-priv</code> can open it.</li>
              </ol>
            </div>
            <button
              onClick={handleGenerateKeypair}
              disabled={kpBusy}
              className="flex items-center justify-center gap-2"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--ze-border-hair)",
                borderRadius: 9,
                padding: "9px 0",
                color: "var(--ze-text-1)",
                fontSize: 13,
                fontWeight: 600,
                cursor: kpBusy ? "not-allowed" : "pointer",
                opacity: kpBusy ? 0.6 : 1,
              }}
            >
              <KeyRound size={13} />
              {kpBusy ? "Generating…" : "Generate keypair…"}
            </button>

            {kpError && (
              <p style={{ fontSize: 12, color: "var(--ze-error)", margin: 0 }}>{kpError}</p>
            )}

            {kpFp && (
              <div className="flex flex-col gap-1.5">
                <div
                  style={{
                    background: "rgba(76,222,140,0.06)",
                    border: "1px solid rgba(76,222,140,0.2)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "var(--ze-success)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span>Public: {pathTail(kpPubPath)}</span>
                  <span>Private: {pathTail(kpPrivPath)}</span>
                </div>
                <div
                  className="flex items-start gap-2"
                  style={{
                    background: "rgba(245,176,82,0.08)",
                    border: "1px solid rgba(245,176,82,0.3)",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  <AlertTriangle size={13} style={{ color: "var(--ze-warning)", flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 11.5, color: "var(--ze-text-2)", margin: 0, lineHeight: 1.5 }}>
                    Back up the <code style={{ color: "var(--ze-warning)" }}>.zkey-priv</code> file now. If you lose it, every archive ever sent to you with this public key becomes permanently unrecoverable — there is no reset, no recovery, no support that can help.
                  </p>
                </div>
                <div
                  className="flex items-center gap-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--ze-border-hair)",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span style={{ fontSize: 10, color: "var(--ze-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Key fingerprint
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--ze-text-2)",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                        lineHeight: 1.4,
                      }}
                    >
                      {kpFp}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>


          <div style={{ borderTop: "1px solid var(--ze-border-hair)" }} />


          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ze-text-3)" }}>
              <Fingerprint size={12} />
              Inspect a key file
            </div>
            <p style={{ fontSize: 12, color: "var(--ze-text-2)", lineHeight: 1.5, margin: 0 }}>
              Show the fingerprint of a <code style={{ color: "var(--ze-accent)" }}>.zkey-pub</code> or a keyfile. Useful for verifying a public key someone sent you matches what they read aloud, or that a keyfile matches an archive.
            </p>
            <button
              onClick={handleFingerprint}
              disabled={fpBusy}
              className="flex items-center justify-center gap-2"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--ze-border-hair)",
                borderRadius: 9,
                padding: "9px 0",
                color: "var(--ze-text-1)",
                fontSize: 13,
                fontWeight: 600,
                cursor: fpBusy ? "not-allowed" : "pointer",
                opacity: fpBusy ? 0.6 : 1,
              }}
            >
              <Search size={13} />
              {fpBusy ? "Computing…" : "Select a key file to inspect…"}
            </button>

            {fpError && (
              <p style={{ fontSize: 12, color: "var(--ze-error)", margin: 0 }}>{fpError}</p>
            )}

            {fp && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--ze-text-3)" }}>
                  <span>{pathTail(fpPath)}</span>
                  {fpKind && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: fpKind === "pubkey" ? "rgba(122,162,255,0.12)" : "rgba(255,255,255,0.06)",
                        color: fpKind === "pubkey" ? "var(--ze-accent)" : "var(--ze-text-3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        fontWeight: 600,
                      }}
                    >
                      {fpKind === "pubkey" ? "Public key" : "Keyfile"}
                    </span>
                  )}
                </div>
                <div
                  className="flex items-center gap-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--ze-border-hair)",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span style={{ fontSize: 10, color: "var(--ze-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {fpKind === "pubkey" ? "Key fingerprint" : "BLAKE3 fingerprint"}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--ze-text-2)",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                        lineHeight: 1.4,
                      }}
                    >
                      {fp}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(fp, "fp")}
                    className="flex items-center gap-1.5"
                    style={{
                      background: "none",
                      border: "1px solid var(--ze-border-hair)",
                      borderRadius: 6,
                      color: copiedFp ? "var(--ze-success)" : "var(--ze-text-3)",
                      cursor: "pointer",
                      padding: "4px 8px",
                      fontSize: 11,
                      flexShrink: 0,
                      transition: "color 200ms",
                    }}
                  >
                    {copiedFp ? <Check size={11} /> : <Copy size={11} />}
                    {copiedFp ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex justify-end px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--ze-border-hair)" }}
        >
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--ze-border-hair)",
              borderRadius: 8,
              padding: "7px 20px",
              color: "var(--ze-text-2)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
