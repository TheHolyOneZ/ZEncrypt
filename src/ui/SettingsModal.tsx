import { useEffect, useState } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { saveSettings } from "../ipc/bridge";
import type { Settings } from "../ipc/bridge";
import { X } from "./icons";

interface Props {
  onClose: () => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ze-text-2)" }}>{label}</label>
      {hint && <span style={{ fontSize: 11, color: "var(--ze-text-3)" }}>{hint}</span>}
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <span style={{ fontSize: 12, color: "var(--ze-text-2)" }}>{label}</span>
        {children}
      </div>
      {hint && <span style={{ fontSize: 11, color: "var(--ze-text-3)" }}>{hint}</span>}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        background: value ? "var(--ze-accent)" : "rgba(255,255,255,0.12)",
        position: "relative",
        transition: "background 200ms",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: value ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 8,
          background: "#fff",
          transition: "left 200ms",
        }}
      />
    </button>
  );
}

function Select<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--ze-border-hair)",
        borderRadius: 8,
        color: "var(--ze-text-1)",
        padding: "5px 8px",
        fontSize: 12,
        cursor: "pointer",
        outline: "none",
        fontFamily: "var(--font-ui)",
        minWidth: 160,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#1a1a22" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--ze-text-3)",
        paddingTop: 4,
      }}
    >
      {children}
    </div>
  );
}

export function SettingsModal({ onClose }: Props) {
  const { settings, setSettings } = useSettingsStore();
  const [draft, setDraft] = useState<Settings>({ ...settings });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const update = <K extends keyof Settings>(key: K, val: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(draft);
      setSettings(draft);
      onClose();
    } catch {

      setSettings(draft);
      onClose();
    } finally {
      setSaving(false);
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
          width: 480,
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
            Settings
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


        <div className="flex flex-col gap-5 p-6 overflow-y-auto flex-1 min-h-0">
          <SectionHeader>Encryption defaults</SectionHeader>

          <Field
            label="Default cipher"
            hint="ChaCha20 is faster on modern CPUs without hardware AES; AES-256-GCM is the industry standard. Both are equally secure."
          >
            <Select
              value={draft.defaultCipher}
              onChange={(v) => update("defaultCipher", v)}
              options={[
                { value: "chacha20", label: "ChaCha20-Poly1305 (recommended)" },
                { value: "aes256gcm", label: "AES-256-GCM" },
              ]}
            />
          </Field>

          <Field
            label="Key strength"
            hint="How much CPU and memory is used to derive the encryption key from your password. Stronger = slower to open, but much harder to brute-force."
          >
            <Select
              value={draft.defaultKdfPreset}
              onChange={(v) => update("defaultKdfPreset", v)}
              options={[
                { value: "interactive", label: "Quick (~0.5 s)" },
                { value: "moderate", label: "Balanced (~2 s)" },
                { value: "paranoid", label: "Maximum security (~5 s)" },
              ]}
            />
          </Field>

          <Field
            label="Chunk size"
            hint="Larger chunks are faster but use more memory. 256 KiB works well for most files."
          >
            <Select
              value={String(draft.defaultChunkSize) as "65536" | "262144" | "1048576"}
              onChange={(v) => update("defaultChunkSize", Number(v) as 65536 | 262144 | 1048576)}
              options={[
                { value: "65536", label: "64 KiB (low memory)" },
                { value: "262144", label: "256 KiB (recommended)" },
                { value: "1048576", label: "1 MiB (fastest)" },
              ]}
            />
          </Field>

          <Row label="Compress by default" hint="Shrinks text, code, and most documents before encrypting. Already-compressed files (jpg, mp4, zip, pdf, …) are automatically skipped so nothing slows down.">
            <Toggle value={draft.defaultCompression} onChange={(v) => update("defaultCompression", v)} />
          </Row>

          <Field
            label="After encryption, delete original files?"
            hint="Secure-delete overwrites the file before deleting. On SSDs, deletion may not fully sanitize the data due to wear-leveling."
          >
            <Select
              value={draft.defaultSecureDelete}
              onChange={(v) => update("defaultSecureDelete", v)}
              options={[
                { value: "off", label: "No — keep originals" },
                { value: "1pass", label: "Yes — 1 pass (fast)" },
                { value: "3pass", label: "Yes — 3 pass DoD (recommended)" },
                { value: "7pass", label: "Yes — 7 pass Gutmann (slow, strongest)" },
              ]}
            />
          </Field>

          <SectionHeader>Behavior</SectionHeader>

          <Row label="Auto-open output folder after success" hint="Reveals the new file in your system's file manager as soon as a job finishes.">
            <Toggle value={draft.autoOpenOutputFolder} onChange={(v) => update("autoOpenOutputFolder", v)} />
          </Row>

          <Row label="Remember last keyfile path">
            <Toggle value={draft.rememberLastKeyfilePath} onChange={(v) => update("rememberLastKeyfilePath", v)} />
          </Row>

          <Row label="Show SSD secure-delete warning">
            <Toggle value={draft.showSsdWarning} onChange={(v) => update("showSsdWarning", v)} />
          </Row>

          <Row label="Clear history on exit">
            <Toggle value={draft.clearHistoryOnExit} onChange={(v) => update("clearHistoryOnExit", v)} />
          </Row>

          <Row label="Compact mode">
            <Toggle value={draft.compactMode} onChange={(v) => update("compactMode", v)} />
          </Row>

          <Field
            label="Auto-clear clipboard"
            hint="Wipes copied passwords and paths from the clipboard after a delay. Set to 0 to disable."
          >
            <Select
              value={String(draft.clipboardClearSeconds) as "0" | "15" | "30" | "60" | "120"}
              onChange={(v) => update("clipboardClearSeconds", Number(v))}
              options={[
                { value: "0", label: "Off — never clear" },
                { value: "15", label: "15 seconds" },
                { value: "30", label: "30 seconds (recommended)" },
                { value: "60", label: "1 minute" },
                { value: "120", label: "2 minutes" },
              ]}
            />
          </Field>

          <Row label="Randomize output filename" hint="Names new archives with a random hex string instead of the input filename. The original names are still preserved safely inside the encrypted payload.">
            <Toggle
              value={draft.randomizeOutputFilename}
              onChange={(v) => update("randomizeOutputFilename", v)}
            />
          </Row>

          <Field
            label="When output file exists"
            hint="‘Ask every time’ prevents accidental overwrites; ‘Overwrite silently’ skips the prompt."
          >
            <Select
              value={draft.confirmOverwrite}
              onChange={(v) => update("confirmOverwrite", v)}
              options={[
                { value: "always", label: "Ask every time" },
                { value: "never", label: "Overwrite silently" },
              ]}
            />
          </Field>
        </div>


        <div
          className="flex justify-end gap-2 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--ze-border-hair)" }}
        >
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--ze-border-hair)",
              borderRadius: 8,
              padding: "7px 18px",
              color: "var(--ze-text-2)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: "linear-gradient(135deg, var(--ze-accent), color-mix(in srgb, var(--ze-accent) 78%, #fff))",
              border: "none",
              borderRadius: 8,
              padding: "7px 20px",
              color: "#07080e",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
