import { useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { previewHeader } from "../ipc/bridge";
import { useJobStore } from "../store/jobStore";
import { useToastStore } from "../store/toastStore";
import { statItems } from "../util/statItems";
import { Lock, Upload } from "./icons";

type DzState = "idle" | "over-files" | "over-zsec";

export function DropZone({ children }: { children?: React.ReactNode }) {
  const [dzState, setDzState] = useState<DzState>("idle");
  const enterPathsRef = useRef<string[]>([]);
  const { state, loadFiles, loadZenc } = useJobStore();
  const pushToast = useToastStore((s) => s.push);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const win = getCurrentWebviewWindow();
    let mounted = true;

    win.onDragDropEvent((event) => {
      if (!mounted) return;
      const ev = event.payload;

      if (ev.type === "enter") {
        const paths: string[] = ev.paths;
        enterPathsRef.current = paths;
        const allZsec = paths.length > 0 && paths.every((p: string) => p.endsWith(".zsec"));
        setDzState(allZsec ? "over-zsec" : "over-files");
      } else if (ev.type === "over") {
        const paths = enterPathsRef.current;
        const allZsec = paths.length > 0 && paths.every((p: string) => p.endsWith(".zsec"));
        setDzState(allZsec ? "over-zsec" : "over-files");
      } else if (ev.type === "drop") {
        setDzState("idle");
        enterPathsRef.current = [];
        const paths: string[] = ev.paths;
        if (paths.length === 0) return;

        const zsecPaths = paths.filter((p: string) => p.endsWith(".zsec"));
        const otherPaths = paths.filter((p: string) => !p.endsWith(".zsec"));

        if (zsecPaths.length === 1 && otherPaths.length === 0) {
          previewHeader(zsecPaths[0])
            .then((header) => loadZenc(zsecPaths[0], header))
            .catch((err) => {
              const msg = typeof err === "string" ? err : (err?.message ?? "Unknown error");
              pushToast("error", `Can't read this .zsec file: ${msg}`);
            });
        } else if (otherPaths.length > 0) {
          statItems(otherPaths).then(loadFiles);
        } else if (zsecPaths.length > 1) {
          statItems(zsecPaths).then(loadFiles);
        }
      } else {
        setDzState("idle");
        enterPathsRef.current = [];
      }
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });

    return () => {
      mounted = false;
      unlistenRef.current?.();
    };
  }, [loadFiles, loadZenc, pushToast]);

  const isActive = state.kind !== "Idle";
  const showOverlay = dzState !== "idle";

  const getBorderColor = () => {
    if (dzState === "over-zsec") return "rgba(76,222,140,0.6)";
    if (dzState === "over-files") return "rgba(122,162,255,0.6)";
    return "rgba(122,162,255,0.22)";
  };

  return (
    <div
      className="flex-1 relative flex flex-col overflow-hidden"
      style={{
        border: `1.5px dashed ${getBorderColor()}`,
        borderRadius: 16,
        margin: "0 12px 12px",
        transition: "border-color 180ms ease, box-shadow 180ms ease",
        boxShadow: showOverlay
          ? `0 0 0 4px rgba(122,162,255,0.08), inset 0 0 40px rgba(122,162,255,0.03)`
          : undefined,
        animation: !isActive && !showOverlay ? "ze-dz-pulse var(--ze-dz-pulse) ease-in-out infinite" : undefined,
      }}
    >
      {showOverlay && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl flex flex-col items-center justify-center gap-3"
          style={{
            background: dzState === "over-zsec" ? "rgba(76,222,140,0.06)" : "rgba(122,162,255,0.06)",
            zIndex: 50,
          }}
        >
          <Upload
            size={40}
            style={{
              color: dzState === "over-zsec" ? "var(--ze-success)" : "var(--ze-accent)",
              opacity: 0.7,
            }}
          />
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: dzState === "over-zsec" ? "var(--ze-success)" : "var(--ze-accent)",
          }}>
            {dzState === "over-zsec" ? "Drop to decrypt" : "Drop to encrypt"}
          </span>
        </div>
      )}

      {!isActive && !showOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none gap-4">
          <Lock
            size={44}
            style={{ color: "var(--ze-accent)", opacity: 0.18 }}
          />
          <p style={{ color: "var(--ze-text-2)", fontSize: 15, fontWeight: 500, textAlign: "center", maxWidth: 360, margin: 0 }}>
            Drop files or folders to <strong style={{ color: "var(--ze-text-1)" }}>encrypt</strong>
            <br />
            or drop a <code style={{ color: "var(--ze-accent)", fontSize: 13 }}>.zsec</code> file to <strong style={{ color: "var(--ze-text-1)" }}>decrypt</strong>
          </p>
        </div>
      )}

      {isActive && children}
    </div>
  );
}
