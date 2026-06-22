import { useEffect, useRef, useState } from "react";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { exists, readDir } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import { TitleBar } from "../ui/TitleBar";
import { DropZone } from "../ui/DropZone";
import { FileList } from "../ui/FileList";
import { CredentialsPanel, type Credentials } from "../ui/CredentialsPanel";
import { OptionsPanel } from "../ui/OptionsPanel";
import { HeaderPreview } from "../ui/HeaderPreview";
import { ProgressBar } from "../ui/ProgressBar";
import { SuccessScreen } from "../ui/SuccessScreen";
import { ErrorScreen } from "../ui/ErrorScreen";
import { ToastHost } from "../ui/Toast";
import { SettingsModal } from "../ui/SettingsModal";
import { AboutModal } from "../ui/AboutModal";
import { KeyfileManager } from "../ui/KeyfileManager";
import { RecentList } from "../ui/RecentList";
import { Lock, LockOpen, FolderOpen } from "../ui/icons";

import { useJobStore } from "../store/jobStore";
import { useSettingsStore } from "../store/settingsStore";
import { useToastStore } from "../store/toastStore";

import {
  startEncryptJob,
  startDecryptJob,
  cancelJob,
  loadSettings,
  saveSettings,
} from "../ipc/bridge";
import {
  onJobProgress,
  onJobDone,
  onJobFailed,
  onJobCancelled,
  onJobWarning,
  onOpenFile,
} from "../ipc/events";
import { pathTail } from "../util/pathTail";
import { previewHeader } from "../ipc/bridge";
import { statItems } from "../util/statItems";
import { useModKey } from "../util/platform";

const EMPTY_CREDS: Credentials = { password: "", confirmPassword: "", keyfilePath: "", recipientPubkeyPath: "", privateKeyPath: "" };

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function App() {
  const job = useJobStore();
  const { settings, setSettings } = useSettingsStore();
  const toast = useToastStore();
  const mod = useModKey();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [keyfileOpen, setKeyfileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);


  const pendingOutputRef = useRef("");

  const lastZencRef = useRef<{ path: string; header: import("../ipc/bridge").ZencHeaderInfo } | null>(null);

  const [creds, setCreds] = useState<Credentials>(EMPTY_CREDS);
  const [opts, setOpts] = useState({
    cipher: settings.defaultCipher,
    kdfPreset: settings.defaultKdfPreset,
    chunkSize: settings.defaultChunkSize,
    compress: settings.defaultCompression,
    secureDeleteMode: settings.defaultSecureDelete,
    outputPath: "",
  });


  useEffect(() => {
    loadSettings()
      .then((s) => {
        setSettings(s);
        setOpts((o) => ({
          ...o,
          cipher: s.defaultCipher,
          kdfPreset: s.defaultKdfPreset,
          chunkSize: s.defaultChunkSize,
          compress: s.defaultCompression,
          secureDeleteMode: s.defaultSecureDelete,
        }));

        if (s.rememberLastKeyfilePath && s.lastKeyfilePath) {
          setCreds((c) => ({ ...c, keyfilePath: s.lastKeyfilePath }));
        }
      })
      .catch(() => {});

    const unlistens = Promise.all([
      onJobProgress((p) => {
        job.updateProgress({
          bytesDone: p.bytesDone,
          bytesTotal: p.bytesTotal,
          throughputMbs: p.throughputMbs,
          etaMs: p.etaMs,
        });
      }),
      onJobDone((_jobId) => {
        const output = pendingOutputRef.current || "(auto)";
        job.finishJob(output);
      }),
      onJobFailed((p) => {
        const mode = job.state.kind === "Running" ? job.state.mode : "encrypt";
        job.failJob(mode, p.message);
      }),
      onJobCancelled(() => {
        job.cancelJob();
        toast.push("info", "Job cancelled — no output was written.");
      }),
      onJobWarning((p) => {
        toast.push("error", p.message);
      }),
      onOpenFile(async (path) => {
        if (path.endsWith(".zsec")) {
          previewHeader(path)
            .then((header) => job.loadZenc(path, header))
            .catch(() => {});
        } else {
          const items = await statItems([path]);
          job.loadFiles(items);
        }
      }),
    ]);

    return () => {
      unlistens.then((fns) => fns.forEach((f) => f()));
    };
  }, []);


  useEffect(() => {
    if (job.state.kind === "Success" && settings.autoOpenOutputFolder) {
      revealItemInDir(job.state.outputPath).catch(() => {});
    }
  }, [job.state.kind]);


  useEffect(() => {
    if (job.state.kind === "ZencLoaded") {
      lastZencRef.current = { path: job.state.path, header: job.state.header };
    }
  }, [job.state.kind]);

  const handleRetryCreds = () => {
    const last = lastZencRef.current;
    if (!last) {
      job.reset();
      setCreds(EMPTY_CREDS);
      return;
    }
    setCreds((c) => ({ ...c, password: "", confirmPassword: "" }));
    job.loadZenc(last.path, last.header);
  };


  useEffect(() => {
    if (
      settings.rememberLastKeyfilePath &&
      creds.keyfilePath &&
      creds.keyfilePath !== settings.lastKeyfilePath
    ) {
      const updated = { ...settings, lastKeyfilePath: creds.keyfilePath };
      saveSettings(updated).catch(() => {});
      setSettings(updated);
    }
  }, [creds.keyfilePath]);


  useEffect(() => {
    setOpts((o) => ({
      ...o,
      cipher: settings.defaultCipher,
      kdfPreset: settings.defaultKdfPreset,
      chunkSize: settings.defaultChunkSize,
      compress: settings.defaultCompression,
      secureDeleteMode: settings.defaultSecureDelete,
    }));
  }, [
    settings.defaultCipher,
    settings.defaultKdfPreset,
    settings.defaultChunkSize,
    settings.defaultCompression,
    settings.defaultSecureDelete,
  ]);


  const maybeShowSsdWarning = (mode: string) => {
    if (mode === "off" || !settings.showSsdWarning) return;
    toast.push(
      "warning",
      "Secure-delete may be ineffective on SSDs — wear-leveling can leave copies of the original data in blocks we can't reach."
    );
    const updated = { ...settings, showSsdWarning: false };
    saveSettings(updated).catch(() => {});
    setSettings(updated);
  };

  const handleEncrypt = async () => {
    const usingPubkey = !!creds.recipientPubkeyPath;
    if (!usingPubkey && !creds.password && !creds.keyfilePath) {
      toast.push("error", "Provide a password, a keyfile, or a recipient public key.");
      return;
    }
    if (!usingPubkey && creds.password && creds.password !== creds.confirmPassword) {
      toast.push("error", "Passwords do not match.");
      return;
    }
    if (job.state.kind !== "FilesLoaded") return;

    const inputPaths = job.state.items.map((i) => i.path);

    let outputPath = opts.outputPath;
    if (!outputPath) {
      const firstInput = inputPaths[0];
      const dir = firstInput.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
      const baseName = settings.randomizeOutputFilename
        ? randomHex(16)
        : pathTail(firstInput).replace(/\.[^.]+$/, "");
      const clean = `${dir}/${baseName}.zsec`;


      if (settings.confirmOverwrite === "never") {
        outputPath = clean;
      } else {
        try {
          if (await exists(clean)) {
            const ok = await ask(
              `${pathTail(clean)} already exists in that folder. Overwrite it?`,
              { title: "Overwrite existing file?", kind: "warning", okLabel: "Overwrite", cancelLabel: "Use a new name" }
            );
            outputPath = ok ? clean : `${dir}/${baseName}_${Date.now()}.zsec`;
          } else {
            outputPath = clean;
          }
        } catch {
          outputPath = `${dir}/${baseName}_${Date.now()}.zsec`;
        }
      }
    } else if (settings.confirmOverwrite === "always") {

      try {
        if (await exists(outputPath)) {
          const ok = await ask(
            `${pathTail(outputPath)} already exists. Overwrite it?`,
            { title: "Overwrite existing file?", kind: "warning", okLabel: "Overwrite", cancelLabel: "Cancel" }
          );
          if (!ok) return;
        }
      } catch {

      }
    }


    maybeShowSsdWarning(opts.secureDeleteMode);

    try {
      const id = await startEncryptJob({
        inputPaths,
        outputPath,
        password: creds.password || undefined,
        keyfilePath: creds.keyfilePath || undefined,
        recipientPubkeyPath: creds.recipientPubkeyPath || undefined,
        cipher: opts.cipher as "chacha20" | "aes256gcm",
        kdfPreset: opts.kdfPreset as "interactive" | "moderate" | "paranoid",
        chunkSize: opts.chunkSize,
        compress: opts.compress,
        secureDeleteMode: opts.secureDeleteMode !== "off" ? opts.secureDeleteMode : undefined,
      });
      pendingOutputRef.current = outputPath;
      job.startJob(id, "encrypt");
      setOpts((o) => ({ ...o, outputPath }));
    } catch (e) {
      toast.push("error", String(e));
    }
  };

  const handleDecrypt = async () => {
    if (job.state.kind !== "ZencLoaded") return;

    if (job.state.header.isPubkey) {
      if (!creds.privateKeyPath) {
        toast.push("error", "This archive needs your private key (.zkey-priv).");
        return;
      }
    } else if (!creds.password && !creds.keyfilePath) {
      if (job.state.header.hasKeyfile && !creds.keyfilePath) {
        toast.push("error", "This archive requires a keyfile.");
        return;
      }
      if (!creds.password) {
        toast.push("error", "Provide a password and/or a keyfile.");
        return;
      }
    }

    const outDir = opts.outputPath || job.state.path.replace(/[^/\\]+$/, "");


    if (settings.confirmOverwrite === "always") {
      try {
        if (await exists(outDir)) {
          const entries = await readDir(outDir).catch(() => [] as Array<unknown>);
          if (entries.length > 0) {
            const ok = await ask(
              `"${pathTail(outDir) || outDir}" already has files in it. Decrypting here will overwrite any files with the same name. Continue?`,
              { title: "Folder is not empty", kind: "warning", okLabel: "Continue", cancelLabel: "Cancel" }
            );
            if (!ok) return;
          }
        }
      } catch {

      }
    }

    try {
      const id = await startDecryptJob({
        inputPath: job.state.path,
        outputDir: outDir,
        password: creds.password || undefined,
        keyfilePath: creds.keyfilePath || undefined,
        privateKeyPath: creds.privateKeyPath || undefined,
      });
      pendingOutputRef.current = outDir;
      job.startJob(id, "decrypt");
      setOpts((o) => ({ ...o, outputPath: outDir }));
    } catch (e) {
      toast.push("error", String(e));
    }
  };

  const handleCancel = async () => {
    if (job.state.kind === "Running") {
      await cancelJob(job.state.id).catch(() => {});
    }
  };

  const handleReset = () => {
    job.reset();
    setCreds(EMPTY_CREDS);
    setOpts((o) => ({ ...o, outputPath: "" }));
    pendingOutputRef.current = "";
  };


  useEffect(() => {
    const handler = (e: KeyboardEvent) => {

      if (e.key === "Escape" && job.state.kind === "Running") {
        e.preventDefault();
        handleCancel();
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;


      if (e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      if (e.key.toLowerCase() === "e") {
        if (job.state.kind === "FilesLoaded") {
          e.preventDefault();
          handleEncrypt();
        }
        return;
      }

      if (e.key.toLowerCase() === "d") {
        if (job.state.kind === "ZencLoaded") {
          e.preventDefault();
          handleDecrypt();
        }
        return;
      }

      if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        setHistoryOpen(true);
        return;
      }

      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setKeyfileOpen(true);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [job.state, creds, opts, settings]);

  const removeItem = (index: number) => {
    if (job.state.kind !== "FilesLoaded") return;
    const newItems = job.state.items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      job.reset();
    } else {
      job.loadFiles(newItems);
    }
  };

  const pickMoreFiles = async () => {
    const selected = await open({ multiple: true, directory: false, title: "Add files to encrypt" });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const newItems = await statItems(paths);
    if (job.state.kind === "FilesLoaded") {
      job.loadFiles([...job.state.items, ...newItems]);
    } else {
      job.loadFiles(newItems);
    }
  };

  const pickOutputPath = async () => {
    const isEncrypt = job.state.kind === "FilesLoaded";
    if (isEncrypt) {
      const p = await save({ title: "Save encrypted archive as", filters: [{ name: "ZEncrypt", extensions: ["zsec"] }] });
      if (typeof p === "string") setOpts((o) => ({ ...o, outputPath: p }));
    } else {
      const p = await open({ title: "Decrypt to folder", directory: true, multiple: false });
      if (typeof p === "string") setOpts((o) => ({ ...o, outputPath: p }));
    }
  };

  const s = job.state;


  const encryptOutputPreview = (() => {
    if (s.kind !== "FilesLoaded") return "";
    if (opts.outputPath) return pathTail(opts.outputPath);
    if (settings.randomizeOutputFilename) return "<random>.zsec";
    const first = s.items[0]?.path;
    if (!first) return "";
    return `${pathTail(first).replace(/\.[^.]+$/, "")}.zsec`;
  })();


  const encryptDisableReason = (() => {
    if (s.kind !== "FilesLoaded") return "";
    const usingPubkey = !!creds.recipientPubkeyPath;
    if (usingPubkey) return "";
    if (!creds.password && !creds.keyfilePath) return "Enter a password, pick a keyfile, or switch to public-key encryption.";
    if (creds.password && creds.password !== creds.confirmPassword) return "Password and confirmation don't match.";
    return "";
  })();

  return (
    <div
      className={settings.compactMode ? "ze-compact" : undefined}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--ze-bg-0)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <TitleBar
        onSettings={() => setSettingsOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        onKeyfile={() => setKeyfileOpen(true)}
        onAbout={() => setAboutOpen(true)}
        onBack={s.kind === "FilesLoaded" || s.kind === "ZencLoaded" ? handleReset : undefined}
      />

      {s.kind === "Success" ? (
        <SuccessScreen
          mode={s.mode}
          outputPath={s.outputPath}
          stats={s.stats}
          onReset={handleReset}
        />
      ) : s.kind === "Error" ? (
        <ErrorScreen
          mode={s.mode}
          errorKind={s.errorKind}
          message={s.message}
          onReset={handleReset}
          onRetryCreds={handleRetryCreds}
        />
      ) : (
        <DropZone>
          {(s.kind === "FilesLoaded" || s.kind === "Running") && (
            <div className="flex-1 flex overflow-hidden">
              {s.kind === "FilesLoaded" && (
                <FileList
                  items={s.items}
                  onRemove={removeItem}
                  onPickMore={pickMoreFiles}
                />
              )}
              <div className="flex-1 flex overflow-hidden">
                <CredentialsPanel
                  value={creds}
                  onChange={setCreds}
                  mode="encrypt"
                  kdfPreset={opts.kdfPreset as "interactive" | "moderate" | "paranoid"}
                />
                <div style={{ flex: 1, borderLeft: "1px solid var(--ze-border-hair)" }}>
                  <OptionsPanel
                    value={opts as Parameters<typeof OptionsPanel>[0]["value"]}
                    onChange={(o) => setOpts(o as typeof opts)}
                    onPickOutput={pickOutputPath}
                  />
                  {s.kind === "FilesLoaded" && (
                    <div className="px-4 pb-4 flex flex-col gap-2">
                      <button
                        onClick={handleEncrypt}
                        disabled={!!encryptDisableReason}
                        title={encryptDisableReason || `Encrypt (${mod}+E)`}
                        className="flex items-center justify-center gap-2"
                        style={{
                          width: "100%",
                          background: encryptDisableReason
                            ? "rgba(122,162,255,0.18)"
                            : "linear-gradient(135deg, var(--ze-accent), color-mix(in srgb, var(--ze-accent) 78%, #fff))",
                          border: "none",
                          borderRadius: 10,
                          padding: "10px",
                          color: encryptDisableReason ? "var(--ze-text-3)" : "#07080e",
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: encryptDisableReason ? "not-allowed" : "pointer",
                          boxShadow: encryptDisableReason ? "none" : "0 2px 16px rgba(122,162,255,0.35)",
                          transition: "background 200ms, color 200ms, box-shadow 200ms",
                        }}
                      >
                        <Lock size={15} strokeWidth={2.5} />
                        <span>
                          Encrypt
                          {encryptOutputPreview && (
                            <span style={{ opacity: 0.7, fontWeight: 600, marginLeft: 6 }}>
                              → {encryptOutputPreview}
                            </span>
                          )}
                        </span>
                      </button>
                      {encryptDisableReason && (
                        <p style={{ fontSize: 11, color: "var(--ze-text-3)", margin: 0, textAlign: "center" }}>
                          {encryptDisableReason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {s.kind === "ZencLoaded" && (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex flex-col" style={{ minWidth: 260, borderRight: "1px solid var(--ze-border-hair)" }}>
                <HeaderPreview
                  header={s.header}
                  zencPath={s.path}
                  password={creds.password || undefined}
                  keyfilePath={creds.keyfilePath || undefined}
                  privateKeyPath={creds.privateKeyPath || undefined}
                />
              </div>
              <div className="flex-1 flex overflow-hidden">
                <CredentialsPanel
                  value={creds}
                  onChange={setCreds}
                  mode="decrypt"
                  requireKeyfile={s.header.hasKeyfile}
                  requirePrivateKey={s.header.isPubkey}
                />
                <div style={{ flex: 1, borderLeft: "1px solid var(--ze-border-hair)", padding: 16 }}>
                  <div style={{ fontSize: 12, color: "var(--ze-text-3)", marginBottom: 8 }}>Output folder</div>
                  <div className="flex gap-2">
                    <div style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--ze-border-hair)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: opts.outputPath ? "var(--ze-text-2)" : "var(--ze-text-3)",
                    }}>
                      {opts.outputPath || "Same folder as .zsec"}
                    </div>
                    <button
                      onClick={pickOutputPath}
                      className="flex items-center gap-1.5"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid var(--ze-border-hair)",
                        borderRadius: 8,
                        color: "var(--ze-text-2)",
                        cursor: "pointer",
                        padding: "5px 10px",
                        fontSize: 12,
                      }}
                    >
                      <FolderOpen size={13} />
                      Choose
                    </button>
                  </div>
                  <button
                    onClick={handleDecrypt}
                    title={`Decrypt (${mod}+D)`}
                    className="flex items-center justify-center gap-2"
                    style={{
                      marginTop: 16,
                      width: "100%",
                      background: "linear-gradient(135deg, var(--ze-success), color-mix(in srgb, var(--ze-success) 78%, #fff))",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px",
                      color: "#07080e",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 2px 16px rgba(76,222,140,0.28)",
                    }}
                  >
                    <LockOpen size={15} strokeWidth={2.5} />
                    Decrypt
                  </button>
                </div>
              </div>
            </div>
          )}

          {s.kind === "Idle" && (
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <button
                onClick={pickMoreFiles}
                className="flex items-center gap-2"
                style={{
                  background: "rgba(122,162,255,0.10)",
                  border: "1px solid var(--ze-border-accent)",
                  borderRadius: 10,
                  color: "var(--ze-accent)",
                  cursor: "pointer",
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Browse for files
              </button>
            </div>
          )}
        </DropZone>
      )}

      {s.kind === "Running" && (
        <ProgressBar
          mode={s.mode}
          progress={s.progress}
          onCancel={handleCancel}
          isPubkey={s.mode === "encrypt" ? !!creds.recipientPubkeyPath : !!creds.privateKeyPath}
        />
      )}

      <ToastHost />

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {keyfileOpen && <KeyfileManager onClose={() => setKeyfileOpen(false)} />}
      {historyOpen && <RecentList onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
