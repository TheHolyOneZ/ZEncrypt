import { create } from "zustand";
import type { ZencHeaderInfo } from "../ipc/bridge";

export type JobMode = "encrypt" | "decrypt";
export type ErrorKind = "wrong_creds" | "auth_failed" | "io" | "cancelled" | "unknown";

export interface InputItem {
  path: string;
  name: string;
  size?: number;
  isDir?: boolean;
}

export interface Progress {
  bytesDone: number;
  bytesTotal: number;
  throughputMbs: number;
  etaMs: number;
}

export interface JobStats {
  bytesDone: number;
  bytesTotal: number;
}

type JobState =
  | { kind: "Idle" }
  | { kind: "FilesLoaded"; items: InputItem[] }
  | { kind: "ZencLoaded"; path: string; header: ZencHeaderInfo }
  | { kind: "Running"; id: string; mode: JobMode; progress: Progress }
  | { kind: "Success"; mode: JobMode; outputPath: string; stats: JobStats }
  | { kind: "Error"; mode: JobMode; errorKind: ErrorKind; message: string };

interface JobStore {
  state: JobState;


  loadFiles: (items: InputItem[]) => void;
  loadZenc: (path: string, header: ZencHeaderInfo) => void;
  startJob: (id: string, mode: JobMode) => void;
  updateProgress: (progress: Progress) => void;
  finishJob: (outputPath: string) => void;
  failJob: (mode: JobMode, message: string) => void;
  cancelJob: () => void;
  reset: () => void;
}

function classifyError(message: string): ErrorKind {
  const m = message.toLowerCase();
  if (m.includes("authentication failed") || m.includes("auth")) return "auth_failed";
  if (m.includes("wrong") || m.includes("incorrect") || m.includes("invalid password")) return "wrong_creds";
  if (m.includes("io") || m.includes("read") || m.includes("write") || m.includes("file")) return "io";
  if (m.includes("cancel")) return "cancelled";
  return "unknown";
}

export const useJobStore = create<JobStore>((set, get) => ({
  state: { kind: "Idle" },

  loadFiles: (items) => set({ state: { kind: "FilesLoaded", items } }),

  loadZenc: (path, header) => set({ state: { kind: "ZencLoaded", path, header } }),

  startJob: (id, mode) =>
    set({
      state: {
        kind: "Running",
        id,
        mode,
        progress: { bytesDone: 0, bytesTotal: 0, throughputMbs: 0, etaMs: 0 },
      },
    }),

  updateProgress: (progress) => {
    const s = get().state;
    if (s.kind === "Running") {
      set({ state: { ...s, progress } });
    }
  },

  finishJob: (outputPath) => {
    const s = get().state;
    const mode: JobMode = s.kind === "Running" ? s.mode : "encrypt";
    const stats: JobStats =
      s.kind === "Running"
        ? { bytesDone: s.progress.bytesDone, bytesTotal: s.progress.bytesTotal }
        : { bytesDone: 0, bytesTotal: 0 };
    set({ state: { kind: "Success", mode, outputPath, stats } });
  },

  failJob: (mode, message) =>
    set({
      state: { kind: "Error", mode, errorKind: classifyError(message), message },
    }),

  cancelJob: () => set({ state: { kind: "Idle" } }),

  reset: () => set({ state: { kind: "Idle" } }),
}));
