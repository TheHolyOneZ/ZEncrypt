import { useToastStore, type ToastKind } from "../store/toastStore";
import { X, Info, CheckCircle2, XCircle, AlertTriangle } from "./icons";

const KIND_COLOR: Record<ToastKind, string> = {
  info: "var(--ze-accent)",
  success: "var(--ze-success)",
  error: "var(--ze-error)",
  warning: "var(--ze-warning)",
};

function KindIcon({ kind }: { kind: ToastKind }) {
  const color = KIND_COLOR[kind];
  const size = 15;
  const s = { color, flexShrink: 0 as const };
  switch (kind) {
    case "success": return <CheckCircle2 size={size} style={s} />;
    case "error": return <XCircle size={size} style={s} />;
    case "warning": return <AlertTriangle size={size} style={s} />;
    default: return <Info size={size} style={s} />;
  }
}

export function ToastHost() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="ze-glass-2 rounded-xl"
          style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "flex-start",
            gap: 9,
            minWidth: 240,
            maxWidth: 360,
            animation: "ze-toast-in 240ms cubic-bezier(0.22,1,0.36,1) both",
            pointerEvents: "all",
            borderLeft: `3px solid ${KIND_COLOR[t.kind]}`,
          }}
        >
          <KindIcon kind={t.kind} />
          <span style={{ fontSize: 13, color: "var(--ze-text-1)", flex: 1, lineHeight: 1.5 }}>
            {t.message}
          </span>
          <button
            onClick={() => dismiss(t.id)}
            style={{
              background: "none",
              border: "none",
              color: "var(--ze-text-3)",
              cursor: "pointer",
              padding: "1px",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
