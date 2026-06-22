import { getCurrentWindow } from "@tauri-apps/api/window";
import { History, KeyRound, Settings2, Minus, Square, X, ArrowLeft } from "./icons";
import { useModKey } from "../util/platform";

interface Props {
  onSettings: () => void;
  onHistory: () => void;
  onKeyfile: () => void;
  onAbout: () => void;
  onBack?: () => void;
}

function WinBtn({
  onClick, label, children, danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 rounded-md flex items-center justify-center"
      style={{ color: "var(--ze-text-3)", background: "transparent", border: "none", cursor: "pointer", transition: "background 150ms, color 150ms" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "rgba(240,112,112,0.18)" : "rgba(255,255,255,0.08)";
        if (danger) e.currentTarget.style.color = "#f07070";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--ze-text-3)";
      }}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function IconBtn({
  onClick, label, children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        background: "none",
        border: "none",
        color: "var(--ze-text-3)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        padding: 0,
        borderRadius: 6,
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
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function TitleBar({ onSettings, onHistory, onKeyfile, onAbout, onBack }: Props) {
  const win = getCurrentWindow();
  const mod = useModKey();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-10 px-3 shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >

      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={onAbout}
          title="About ZEncrypt"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 8px 2px 2px",
            marginRight: 2,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <img
            src="/icon-32.png"
            alt=""
            width={18}
            height={18}
            style={{ borderRadius: 5, display: "block", flexShrink: 0 }}
          />
          <span className="text-sm font-bold tracking-tight" style={{ color: "var(--ze-accent)" }}>
            Z<span style={{ color: "var(--ze-text-1)" }}>Encrypt</span>
          </span>
        </button>

        <IconBtn onClick={onHistory} label={`Recent operations (${mod}+H)`}><History size={14} /></IconBtn>
        <IconBtn onClick={onKeyfile} label={`Keyfile manager (${mod}+K)`}><KeyRound size={14} /></IconBtn>
        <IconBtn onClick={onSettings} label={`Settings (${mod}+,)`}><Settings2 size={14} /></IconBtn>

        {onBack && (
          <button
            onClick={onBack}
            title="Clear and go back to the drop area"
            className="flex items-center gap-1.5"
            style={{
              WebkitAppRegion: "no-drag",
              marginLeft: 6,
              padding: "3px 9px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--ze-border-hair)",
              borderRadius: 7,
              color: "var(--ze-text-2)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 150ms, color 150ms, border-color 150ms",
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.09)";
              e.currentTarget.style.color = "var(--ze-text-1)";
              e.currentTarget.style.borderColor = "var(--ze-border-strong)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.color = "var(--ze-text-2)";
              e.currentTarget.style.borderColor = "var(--ze-border-hair)";
            }}
          >
            <ArrowLeft size={12} />
            Back
          </button>
        )}
      </div>


      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <WinBtn onClick={() => win.minimize()} label="Minimize"><Minus size={12} /></WinBtn>
        <WinBtn onClick={() => win.toggleMaximize()} label="Maximize"><Square size={11} /></WinBtn>
        <WinBtn onClick={() => win.close()} label="Close" danger><X size={12} /></WinBtn>
      </div>
    </div>
  );
}
