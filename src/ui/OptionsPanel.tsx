interface EncryptOptions {
  cipher: "chacha20" | "aes256gcm";
  kdfPreset: "interactive" | "moderate" | "paranoid";
  chunkSize: number;
  compress: boolean;
  secureDeleteMode: "off" | "1pass" | "3pass" | "7pass";
  outputPath: string;
}

interface Props {
  value: EncryptOptions;
  onChange: (o: EncryptOptions) => void;
  onPickOutput: () => void;
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
        width: "100%",
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

export function OptionsPanel({ value, onChange, onPickOutput }: Props) {
  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto" style={{ minWidth: 220 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ze-text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Options
      </div>

      <Field
        label="Cipher"
        hint="ChaCha20 is faster on most CPUs; AES is the industry standard. Both are equally secure."
      >
        <Select
          value={value.cipher}
          onChange={(cipher) => onChange({ ...value, cipher })}
          options={[
            { value: "chacha20", label: "ChaCha20-Poly1305 (recommended)" },
            { value: "aes256gcm", label: "AES-256-GCM" },
          ]}
        />
      </Field>

      <Field
        label="Key strength"
        hint="Higher levels make brute-forcing your password much harder, but take longer to open the file."
      >
        <Select
          value={value.kdfPreset}
          onChange={(kdfPreset) => onChange({ ...value, kdfPreset })}
          options={[
            { value: "interactive", label: "Quick (~0.5s)" },
            { value: "moderate", label: "Balanced (~2s)" },
            { value: "paranoid", label: "Maximum security (~5s)" },
          ]}
        />
      </Field>

      <Field label="After encryption, delete originals?">
        <Select
          value={value.secureDeleteMode}
          onChange={(secureDeleteMode) => onChange({ ...value, secureDeleteMode })}
          options={[
            { value: "off", label: "No — keep originals" },
            { value: "1pass", label: "Yes — 1 pass (fast)" },
            { value: "3pass", label: "Yes — 3 pass DoD (recommended)" },
            { value: "7pass", label: "Yes — 7 pass Gutmann (slow, strongest)" },
          ]}
        />
      </Field>

      <div className="flex items-center justify-between">
        <label style={{ fontSize: 12, color: "var(--ze-text-2)" }}>Compress</label>
        <Toggle value={value.compress} onChange={(compress) => onChange({ ...value, compress })} />
      </div>

      <Field label="Output path">
        <div className="flex gap-1.5">
          <div
            className="flex-1 rounded-lg px-2 py-1.5 truncate text-xs"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--ze-border-hair)",
              color: value.outputPath ? "var(--ze-text-2)" : "var(--ze-text-3)",
            }}
            title={value.outputPath}
          >
            {value.outputPath || "Same as input"}
          </div>
          <button
            onClick={onPickOutput}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--ze-border-hair)",
              borderRadius: 8,
              color: "var(--ze-text-2)",
              cursor: "pointer",
              padding: "5px 8px",
              fontSize: 11,
            }}
          >
            Choose
          </button>
        </div>
      </Field>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={{ fontSize: 12, color: "var(--ze-text-2)", fontWeight: 500 }}>{label}</label>
      {hint && (
        <span style={{ fontSize: 11, color: "var(--ze-text-3)", lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
      {children}
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
