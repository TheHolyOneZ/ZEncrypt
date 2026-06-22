import type { InputItem } from "../store/jobStore";
import { formatBytes } from "../util/formatBytes";
import { File, Folder, X, Plus } from "./icons";

interface Props {
  items: InputItem[];
  onRemove: (index: number) => void;
  onPickMore?: () => void;
}

export function FileList({ items, onRemove, onPickMore }: Props) {
  const totalSize = items.reduce((sum, i) => sum + (i.size ?? 0), 0);
  const hasSize = items.some((i) => i.size !== undefined);

  return (
    <div
      className="flex flex-col p-3 overflow-y-auto"
      style={{ minWidth: 210, maxWidth: 260, borderRight: "1px solid var(--ze-border-hair)" }}
    >

      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ze-text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {items.length} {items.length === 1 ? "file" : "files"}
        </span>
        {hasSize && totalSize > 0 && (
          <span style={{ fontSize: 11, color: "var(--ze-text-3)" }}>{formatBytes(totalSize)}</span>
        )}
      </div>


      <div className="flex flex-col gap-0.5 flex-1">
        {items.map((item, i) => {
          const isDir = item.isDir ?? false;
          return (
            <div
              key={item.path}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 group"
              style={{ background: "rgba(255,255,255,0.025)" }}
              title={item.path}
            >
              <span style={{ flexShrink: 0, color: isDir ? "var(--ze-accent)" : "var(--ze-text-3)", opacity: 0.7 }}>
                {isDir ? <Folder size={13} /> : <File size={13} />}
              </span>
              <span
                className="flex-1 truncate"
                style={{ fontSize: 12, color: "var(--ze-text-1)" }}
              >
                {item.name}
              </span>
              {item.size !== undefined && item.size > 0 && (
                <span style={{ fontSize: 10, color: "var(--ze-text-3)", flexShrink: 0 }}>
                  {formatBytes(item.size)}
                </span>
              )}
              <button
                onClick={() => onRemove(i)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ze-text-3)",
                  cursor: "pointer",
                  padding: "2px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
                aria-label={`Remove ${item.name}`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {onPickMore && (
        <button
          onClick={onPickMore}
          className="flex items-center justify-center gap-1.5 mt-2"
          style={{
            background: "transparent",
            border: `1px dashed var(--ze-border-hair)`,
            borderRadius: 8,
            padding: "6px 10px",
            color: "var(--ze-text-3)",
            fontSize: 11,
            cursor: "pointer",
            transition: "color 150ms, border-color 150ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--ze-accent)";
            e.currentTarget.style.borderColor = "var(--ze-border-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--ze-text-3)";
            e.currentTarget.style.borderColor = "var(--ze-border-hair)";
          }}
        >
          <Plus size={11} />
          Add more files
        </button>
      )}
    </div>
  );
}
