import { useEffect, useState } from "react";
import { listRecent, clearHistory } from "../ipc/bridge";
import type { OperationRow } from "../ipc/bridge";
import { formatBytes } from "../util/formatBytes";
import { pathTail } from "../util/pathTail";
import { X, Lock, LockOpen, History, Trash2 } from "./icons";

interface Props {
  onClose: () => void;
}

function formatDate(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function RecentList({ onClose }: Props) {
  const [rows, setRows] = useState<OperationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    listRecent(100)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));

    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearHistory();
      setRows([]);
    } catch {}
    setClearing(false);
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
          width: 520,
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
            Recent operations
          </h2>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-1.5"
                style={{
                  background: "rgba(240,112,112,0.08)",
                  border: "1px solid rgba(240,112,112,0.2)",
                  borderRadius: 7,
                  color: "var(--ze-error)",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "4px 10px",
                }}
              >
                <Trash2 size={11} />
                {clearing ? "Clearing…" : "Clear all"}
              </button>
            )}
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
        </div>


        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <span style={{ fontSize: 13, color: "var(--ze-text-3)" }}>Loading…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 gap-2">
              <History size={32} style={{ color: "var(--ze-text-3)", opacity: 0.3 }} />
              <span style={{ fontSize: 13, color: "var(--ze-text-3)" }}>No recent operations</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {rows.map((row, i) => (
                <div
                  key={row.id}
                  className="flex items-start gap-3 px-5 py-3"
                  style={{
                    borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}
                >

                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: row.kind === "encrypt"
                        ? "rgba(122,162,255,0.1)"
                        : "rgba(76,222,140,0.1)",
                      border: row.kind === "encrypt"
                        ? "1px solid rgba(122,162,255,0.15)"
                        : "1px solid rgba(76,222,140,0.15)",
                      color: row.kind === "encrypt" ? "var(--ze-accent)" : "var(--ze-success)",
                    }}
                  >
                    {row.kind === "encrypt" ? <Lock size={14} /> : <LockOpen size={14} />}
                  </div>


                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: row.status === "success" ? "var(--ze-text-1)" : "var(--ze-error)",
                          textTransform: "capitalize",
                        }}
                      >
                        {row.kind}
                      </span>
                      {row.status !== "success" && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--ze-error)",
                            background: "rgba(240,112,112,0.1)",
                            border: "1px solid rgba(240,112,112,0.2)",
                            borderRadius: 4,
                            padding: "1px 5px",
                          }}
                        >
                          {row.status}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--ze-text-3)", marginLeft: "auto" }}>
                        {formatDate(row.startedAt)}
                      </span>
                    </div>
                    <span
                      className="truncate"
                      style={{ fontSize: 12, color: "var(--ze-text-2)" }}
                      title={row.outputPath}
                    >
                      {pathTail(row.outputPath)}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ze-text-3)" }}>
                      {row.fileCount} {row.fileCount === 1 ? "file" : "files"} · {formatBytes(row.totalBytes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
