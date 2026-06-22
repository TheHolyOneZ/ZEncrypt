import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface ProgressPayload {
  jobId: string;
  bytesDone: number;
  bytesTotal: number;
  throughputMbs: number;
  etaMs: number;
}

export interface JobFailedPayload {
  jobId: string;
  message: string;
}

export interface JobWarningPayload {
  id: string;
  kind: string;
  message: string;
}

export const onJobProgress = (cb: (p: ProgressPayload) => void): Promise<UnlistenFn> =>
  listen<ProgressPayload>("job:progress", (e) => cb(e.payload));

export const onJobDone = (cb: (jobId: string) => void): Promise<UnlistenFn> =>
  listen<string>("job:done", (e) => cb(e.payload));

export const onJobFailed = (cb: (p: JobFailedPayload) => void): Promise<UnlistenFn> =>
  listen<JobFailedPayload>("job:failed", (e) => cb(e.payload));

export const onJobCancelled = (cb: (jobId: string) => void): Promise<UnlistenFn> =>
  listen<string>("job:cancelled", (e) => cb(e.payload));

export const onJobWarning = (cb: (p: JobWarningPayload) => void): Promise<UnlistenFn> =>
  listen<JobWarningPayload>("job:warning", (e) => cb(e.payload));

export const onOpenFile = (cb: (path: string) => void): Promise<UnlistenFn> =>
  listen<string>("open-file", (e) => cb(e.payload));

export const onDbReady = (cb: () => void): Promise<UnlistenFn> =>
  listen("db:ready", () => cb());

export interface VerifyProgressPayload {
  inputPath: string;
  bytesDone: number;
  bytesTotal: number;
}

export const onVerifyProgress = (cb: (p: VerifyProgressPayload) => void): Promise<UnlistenFn> =>
  listen<VerifyProgressPayload>("verify:progress", (e) => cb(e.payload));
