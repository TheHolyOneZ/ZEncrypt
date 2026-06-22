import type { ErrorKind } from "../store/jobStore";
import { XCircle, RotateCcw, KeyRound } from "./icons";

type Mode = "encrypt" | "decrypt";

function messageFor(mode: Mode, kind: ErrorKind): { title: string; body: string } {
  switch (kind) {
    case "wrong_creds":
      return mode === "decrypt"
        ? {
            title: "Password or keyfile didn't match",
            body:
              "This archive couldn't be opened with what you entered. Double-check your password — and if you used a keyfile, make sure you picked the same one. Nothing was extracted.",
          }
        : {
            title: "Passwords don't match",
            body: "The two password fields don't match. Re-enter your password and try again.",
          };
    case "auth_failed":
      return {
        title: "Archive failed integrity check",
        body:
          "The archive doesn't match what was originally encrypted. It may have been modified, corrupted, or only partially downloaded. No files were written.",
      };
    case "io":
      return mode === "encrypt"
        ? {
            title: "Couldn't write the encrypted file",
            body:
              "We couldn't save the archive. Check that the output folder exists, that you have permission to write to it, and that there's enough free disk space.",
          }
        : {
            title: "Couldn't read or write files",
            body:
              "We couldn't read the archive or write the extracted files. Check the file exists and the output folder has enough free space.",
          };
    case "cancelled":
      return {
        title: "Cancelled",
        body:
          mode === "encrypt"
            ? "You cancelled the operation. No encrypted file was created."
            : "You cancelled the operation. Nothing was extracted.",
      };
    case "unknown":
    default:
      return {
        title: "Something went wrong",
        body:
          "Something unexpected happened. Try again — if it keeps failing, the details below may help.",
      };
  }
}

interface Props {
  mode: Mode;
  errorKind: ErrorKind;
  message: string;
  onReset: () => void;
  onRetryCreds?: () => void;
}

export function ErrorScreen({ mode, errorKind, message, onReset, onRetryCreds }: Props) {
  const { title, body } = messageFor(mode, errorKind);
  const canRetryCreds = mode === "decrypt" && errorKind === "wrong_creds" && !!onRetryCreds;

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="flex flex-col items-center gap-5 ze-glass-2 rounded-2xl p-8"
        style={{ maxWidth: 420, width: "100%", animation: "ze-modal-in 240ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            background: "var(--ze-error-dim)",
            border: "1px solid rgba(240,112,112,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <XCircle size={28} style={{ color: "var(--ze-error)" }} />
        </div>

        <div className="text-center flex flex-col gap-2">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ze-text-1)", margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontSize: 13, color: "var(--ze-text-2)", margin: 0, lineHeight: 1.6 }}>
            {body}
          </p>
          {import.meta.env.DEV && message && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: "var(--ze-text-3)", cursor: "pointer" }}>
                Debug info
              </summary>
              <pre style={{ fontSize: 10, color: "var(--ze-text-3)", whiteSpace: "pre-wrap", marginTop: 4, textAlign: "left" }}>
                {message}
              </pre>
            </details>
          )}
        </div>

        <div className="flex flex-col gap-2" style={{ width: "100%" }}>
          {canRetryCreds && (
            <button
              onClick={onRetryCreds}
              className="flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, var(--ze-accent), color-mix(in srgb, var(--ze-accent) 78%, #fff))",
                border: "none",
                borderRadius: 10,
                padding: "9px 28px",
                color: "#07080e",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
              }}
            >
              <KeyRound size={13} />
              Try different password / keyfile
            </button>
          )}
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--ze-border-strong)",
              borderRadius: 10,
              padding: "9px 28px",
              color: "var(--ze-text-1)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            <RotateCcw size={13} />
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}
