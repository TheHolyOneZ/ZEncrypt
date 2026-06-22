import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { passwordScore, scoreLabel, scoreColor, entropyBits, crackTimeLabel } from "../util/entropy";
import { pathTail } from "../util/pathTail";
import { copyWithAutoClear } from "../util/clipboard";
import { inspectPubkey } from "../ipc/bridge";
import { Eye, EyeOff, X, KeyRound, Wand2, Fingerprint, Copy, Check } from "./icons";

export interface Credentials {
  password: string;
  confirmPassword: string;
  keyfilePath: string;
  recipientPubkeyPath: string;
  privateKeyPath: string;
}

interface Props {
  value: Credentials;
  onChange: (c: Credentials) => void;
  mode: "encrypt" | "decrypt";
  requireKeyfile?: boolean;
  savedKeyfilePath?: string;
  kdfPreset?: "interactive" | "moderate" | "paranoid";

  requirePrivateKey?: boolean;
}

const PWGEN_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_+=?";

function generatePassword(len = 20): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => PWGEN_CHARS[b % PWGEN_CHARS.length]).join("");
}

export function CredentialsPanel({ value, onChange, mode, requireKeyfile, kdfPreset, requirePrivateKey }: Props) {
  const [showPw, setShowPw] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pubkeyFp, setPubkeyFp] = useState("");


  const [encryptTab, setEncryptTab] = useState<"password" | "pubkey">(
    value.recipientPubkeyPath ? "pubkey" : "password"
  );

  const isPubkeyMode = mode === "encrypt" ? encryptTab === "pubkey" : !!requirePrivateKey;

  const switchTab = (tab: "password" | "pubkey") => {
    if (tab === encryptTab) return;
    setEncryptTab(tab);

    if (tab === "pubkey") {
      onChange({ ...value, password: "", confirmPassword: "", keyfilePath: "" });
    } else {
      onChange({ ...value, recipientPubkeyPath: "" });
    }
  };

  const score = passwordScore(value.password);
  const bits = entropyBits(value.password);
  const mismatch = mode === "encrypt" && value.password !== value.confirmPassword && value.confirmPassword.length > 0;


  useEffect(() => {
    if (!value.recipientPubkeyPath) { setPubkeyFp(""); return; }
    let alive = true;
    inspectPubkey(value.recipientPubkeyPath)
      .then((info) => { if (alive) setPubkeyFp(info.fingerprint); })
      .catch(() => { if (alive) setPubkeyFp("invalid"); });
    return () => { alive = false; };
  }, [value.recipientPubkeyPath]);


  const handlePwKey = (e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    if ("getModifierState" in e) setCapsLock(e.getModifierState("CapsLock"));
  };

  const pickKeyfile = async () => {
    const selected = await open({ title: "Select keyfile", multiple: false, directory: false });
    if (typeof selected === "string") {
      onChange({ ...value, keyfilePath: selected });
    }
  };

  const pickRecipientPubkey = async () => {
    const selected = await open({
      title: "Select recipient public key (.zkey-pub)",
      multiple: false,
      directory: false,
      filters: [{ name: "ZEncrypt public key", extensions: ["zkey-pub"] }],
    });
    if (typeof selected === "string") {
      onChange({ ...value, recipientPubkeyPath: selected, password: "", confirmPassword: "", keyfilePath: "" });
    }
  };

  const pickPrivateKey = async () => {
    const selected = await open({
      title: "Select your private key (.zkey-priv)",
      multiple: false,
      directory: false,
      filters: [{ name: "ZEncrypt private key", extensions: ["zkey-priv"] }],
    });
    if (typeof selected === "string") {
      onChange({ ...value, privateKeyPath: selected });
    }
  };

  const handleGenerate = () => {
    const pw = generatePassword();
    onChange({ ...value, password: pw, confirmPassword: pw });
    setShowPw(true);
  };

  return (
    <div className="flex flex-col gap-3 p-4" style={{ minWidth: 230 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ze-text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Credentials
      </div>


      {mode === "encrypt" && (
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 11, color: "var(--ze-text-3)", fontWeight: 500 }}>
            Encryption method
          </label>
          <div
            className="flex"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--ze-border-hair)",
              borderRadius: 8,
              padding: 2,
              gap: 2,
            }}
          >
            <button
              onClick={() => switchTab("password")}
              className="flex-1 flex items-center justify-center gap-1.5"
              style={{
                background: encryptTab === "password" ? "rgba(122,162,255,0.15)" : "transparent",
                border: "none",
                borderRadius: 6,
                color: encryptTab === "password" ? "var(--ze-accent)" : "var(--ze-text-3)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                padding: "5px 8px",
                transition: "background 150ms, color 150ms",
              }}
            >
              Password
            </button>
            <button
              onClick={() => switchTab("pubkey")}
              className="flex-1 flex items-center justify-center gap-1.5"
              style={{
                background: encryptTab === "pubkey" ? "rgba(122,162,255,0.15)" : "transparent",
                border: "none",
                borderRadius: 6,
                color: encryptTab === "pubkey" ? "var(--ze-accent)" : "var(--ze-text-3)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                padding: "5px 8px",
                transition: "background 150ms, color 150ms",
              }}
            >
              Public key
            </button>
          </div>
          <span style={{ fontSize: 10, color: "var(--ze-text-3)", lineHeight: 1.4 }}>
            {encryptTab === "password"
              ? "Anyone with the password (and keyfile, if used) can decrypt."
              : "Only the holder of the matching private key can decrypt. No password needed."}
          </span>
        </div>
      )}


      {!isPubkeyMode && (
      <>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label style={{ fontSize: 12, color: "var(--ze-text-2)", fontWeight: 500 }}>Password</label>
          {mode === "encrypt" && (
            <button
              onClick={handleGenerate}
              title="Generate strong password"
              className="flex items-center gap-1"
              style={{
                background: "none",
                border: "none",
                color: "var(--ze-text-3)",
                cursor: "pointer",
                fontSize: 11,
                padding: "2px 4px",
                borderRadius: 4,
                transition: "color 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ze-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ze-text-3)")}
            >
              <Wand2 size={11} />
              Generate
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type={showPw ? "text" : "password"}
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            onKeyDown={handlePwKey}
            onKeyUp={handlePwKey}
            onFocus={handlePwKey}
            placeholder="Enter password"
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${mismatch ? "var(--ze-error)" : "var(--ze-border-hair)"}`,
              color: "var(--ze-text-1)",
              outline: "none",
              fontFamily: "var(--font-ui)",
            }}
          />
          <button
            onClick={() => setShowPw(!showPw)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--ze-border-hair)",
              borderRadius: 8,
              color: "var(--ze-text-3)",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
            }}
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {mode === "encrypt" && value.password && (
            <button
              onClick={() => {
                copyWithAutoClear(value.password, "Password copied").catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              title="Copy password"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--ze-border-hair)",
                borderRadius: 8,
                color: copied ? "var(--ze-success)" : "var(--ze-text-3)",
                cursor: "pointer",
                padding: "6px 8px",
                display: "flex",
                alignItems: "center",
                transition: "color 200ms",
              }}
              aria-label="Copy password"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}
        </div>


        {capsLock && (
          <div
            className="flex items-center gap-1.5 rounded px-2 py-1"
            style={{
              background: "var(--ze-warning-dim)",
              border: "1px solid rgba(240,184,66,0.3)",
              fontSize: 11,
              color: "var(--ze-warning)",
            }}
          >
            <span style={{ fontWeight: 700, letterSpacing: "0.06em" }}>CAPS LOCK</span>
            <span style={{ color: "var(--ze-text-2)" }}>is on</span>
          </div>
        )}


        {mode === "encrypt" && value.password && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 26,
                      height: 3,
                      borderRadius: 2,
                      background: i < score ? scoreColor[score] : "rgba(255,255,255,0.1)",
                      transition: "background 200ms",
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 11, color: scoreColor[score] }}>{scoreLabel[score]}</span>
              <span style={{ fontSize: 10, color: "var(--ze-text-3)", marginLeft: "auto" }}>
                ~{Math.round(bits)} bits
              </span>
            </div>
            {kdfPreset && bits > 0 && (
              <span style={{ fontSize: 10, color: "var(--ze-text-3)" }}>
                {crackTimeLabel(bits, kdfPreset)}
              </span>
            )}
          </>
        )}
      </div>


      {mode === "encrypt" && (
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12, color: "var(--ze-text-2)", fontWeight: 500 }}>Confirm password</label>
          <input
            type={showPw ? "text" : "password"}
            value={value.confirmPassword}
            onChange={(e) => onChange({ ...value, confirmPassword: e.target.value })}
            onKeyDown={handlePwKey}
            onKeyUp={handlePwKey}
            onFocus={handlePwKey}
            placeholder="Re-enter password"
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${mismatch ? "var(--ze-error)" : "var(--ze-border-hair)"}`,
              color: "var(--ze-text-1)",
              outline: "none",
              fontFamily: "var(--font-ui)",
            }}
          />
          {mismatch && (
            <span style={{ fontSize: 11, color: "var(--ze-error)" }}>Passwords do not match</span>
          )}
        </div>
      )}


      <div style={{ borderTop: "1px solid var(--ze-border-hair)", margin: "2px 0" }} />


      <div className="flex flex-col gap-1.5">
        <label style={{ fontSize: 12, color: "var(--ze-text-2)", fontWeight: 500 }}>
          Keyfile{requireKeyfile ? " (required)" : " (optional)"}
        </label>
        <span style={{ fontSize: 11, color: "var(--ze-text-3)", lineHeight: 1.4 }}>
          {mode === "encrypt"
            ? "A file that must be present alongside the password to decrypt. Adds a second factor — keep it somewhere safe."
            : requireKeyfile
              ? "This archive needs the exact keyfile used during encryption."
              : "Only needed if a keyfile was used during encryption."}
        </span>
        {value.keyfilePath ? (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              background: "rgba(122,162,255,0.06)",
              border: "1px solid rgba(122,162,255,0.18)",
            }}
          >
            <KeyRound size={13} style={{ color: "var(--ze-accent)", flexShrink: 0 }} />
            <span
              className="flex-1 truncate"
              style={{ fontSize: 12, color: "var(--ze-text-1)" }}
              title={value.keyfilePath}
            >
              {pathTail(value.keyfilePath)}
            </span>
            <button
              onClick={() => onChange({ ...value, keyfilePath: "" })}
              style={{
                background: "none",
                border: "none",
                color: "var(--ze-text-3)",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Clear keyfile"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={pickKeyfile}
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px dashed var(--ze-border-hair)",
              color: "var(--ze-text-3)",
              cursor: "pointer",
              fontSize: 12,
              textAlign: "left",
              transition: "border-color 150ms, color 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(122,162,255,0.4)";
              e.currentTarget.style.color = "var(--ze-text-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--ze-border-hair)";
              e.currentTarget.style.color = "var(--ze-text-3)";
            }}
          >
            <Fingerprint size={13} />
            Select keyfile…
          </button>
        )}
      </div>
      </>
      )}


      {mode === "encrypt" && isPubkeyMode && (
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12, color: "var(--ze-text-2)", fontWeight: 500 }}>
            Recipient's public key (.zkey-pub)
          </label>
          <span style={{ fontSize: 11, color: "var(--ze-text-3)", lineHeight: 1.4 }}>
            The person you're sending to must generate a keypair and send you their <code>.zkey-pub</code> file. Pick it here — only their <code>.zkey-priv</code> will be able to decrypt the archive.
          </span>
          <div
            style={{
              background: "rgba(122,162,255,0.06)",
              border: "1px solid rgba(122,162,255,0.18)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 11,
              color: "var(--ze-text-2)",
              lineHeight: 1.55,
              marginTop: 2,
            }}
          >
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ze-accent)", marginBottom: 4 }}>
              How it works
            </div>
            <ol style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
              <li>Ask the recipient to open ZEncrypt and generate a keypair (Keyfile Manager → Generate keypair).</li>
              <li>They send you their <code style={{ color: "var(--ze-accent)" }}>.zkey-pub</code> file. They keep the <code style={{ color: "var(--ze-accent)" }}>.zkey-priv</code> private.</li>
              <li>Pick their <code style={{ color: "var(--ze-accent)" }}>.zkey-pub</code> below and encrypt. Only they can open the result.</li>
            </ol>
          </div>
          {value.recipientPubkeyPath ? (
            <div
              className="flex flex-col gap-1.5 rounded-lg px-3 py-2"
              style={{
                background: "rgba(122,162,255,0.06)",
                border: "1px solid rgba(122,162,255,0.18)",
              }}
            >
              <div className="flex items-center gap-2">
                <KeyRound size={13} style={{ color: "var(--ze-accent)", flexShrink: 0 }} />
                <span className="flex-1 truncate" style={{ fontSize: 12, color: "var(--ze-text-1)" }} title={value.recipientPubkeyPath}>
                  {pathTail(value.recipientPubkeyPath)}
                </span>
                <button
                  onClick={() => onChange({ ...value, recipientPubkeyPath: "" })}
                  style={{ background: "none", border: "none", color: "var(--ze-text-3)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
                  aria-label="Clear recipient key"
                >
                  <X size={12} />
                </button>
              </div>
              {pubkeyFp && (
                <div className="flex items-center gap-1.5" style={{ paddingTop: 4, borderTop: "1px solid rgba(122,162,255,0.15)" }}>
                  <span style={{ fontSize: 10, color: "var(--ze-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Fingerprint
                  </span>
                  <span style={{ fontSize: 11, color: pubkeyFp === "invalid" ? "var(--ze-error)" : "var(--ze-text-2)", fontFamily: "var(--font-mono)" }}>
                    {pubkeyFp === "invalid" ? "invalid key file" : pubkeyFp}
                  </span>
                </div>
              )}
              {pubkeyFp && pubkeyFp !== "invalid" && (
                <span style={{ fontSize: 10, color: "var(--ze-text-3)", lineHeight: 1.4 }}>
                  Tip: confirm this fingerprint with the recipient over a trusted channel before sending.
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={pickRecipientPubkey}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px dashed var(--ze-border-hair)",
                color: "var(--ze-text-3)",
                cursor: "pointer",
                fontSize: 12,
                textAlign: "left",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(122,162,255,0.4)"; e.currentTarget.style.color = "var(--ze-text-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ze-border-hair)"; e.currentTarget.style.color = "var(--ze-text-3)"; }}
            >
              <KeyRound size={13} />
              Select recipient's .zkey-pub…
            </button>
          )}
        </div>
      )}

      {/* Private-key picker (decrypt only, when archive is pubkey-encrypted) */}
      {mode === "decrypt" && requirePrivateKey && (
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12, color: "var(--ze-text-2)", fontWeight: 500 }}>Your private key (.zkey-priv)</label>
          <span style={{ fontSize: 11, color: "var(--ze-text-3)", lineHeight: 1.4 }}>
            This archive was encrypted to your public key. Pick your matching <code>.zkey-priv</code> — it never leaves your machine.
          </span>
          {value.privateKeyPath ? (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: "rgba(122,162,255,0.06)",
                border: "1px solid rgba(122,162,255,0.18)",
              }}
            >
              <KeyRound size={13} style={{ color: "var(--ze-accent)", flexShrink: 0 }} />
              <span className="flex-1 truncate" style={{ fontSize: 12, color: "var(--ze-text-1)" }} title={value.privateKeyPath}>
                {pathTail(value.privateKeyPath)}
              </span>
              <button
                onClick={() => onChange({ ...value, privateKeyPath: "" })}
                style={{ background: "none", border: "none", color: "var(--ze-text-3)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
                aria-label="Clear private key"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={pickPrivateKey}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px dashed var(--ze-border-hair)",
                color: "var(--ze-text-3)",
                cursor: "pointer",
                fontSize: 12,
                textAlign: "left",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(122,162,255,0.4)"; e.currentTarget.style.color = "var(--ze-text-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ze-border-hair)"; e.currentTarget.style.color = "var(--ze-text-3)"; }}
            >
              <KeyRound size={13} />
              Select your .zkey-priv…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
