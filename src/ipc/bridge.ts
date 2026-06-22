import { invoke } from "@tauri-apps/api/core";

export interface ZencHeaderInfo {
  cipher: string;
  kdfPresetLabel: string;
  kdfMKib: number;
  kdfTIters: number;
  kdfPLanes: number;
  hasKeyfile: boolean;
  isCompressed: boolean;
  isPubkey: boolean;
  keyfileFingerprint: string;
  recipientFingerprint: string;
}

export interface EncryptRequest {
  inputPaths: string[];
  outputPath: string;
  password?: string;
  keyfilePath?: string;
  recipientPubkeyPath?: string;
  cipher: "chacha20" | "aes256gcm";
  kdfPreset: "interactive" | "moderate" | "paranoid";
  chunkSize: number;
  compress: boolean;
  secureDeleteMode?: string;
}

export interface DecryptRequest {
  inputPath: string;
  outputDir: string;
  password?: string;
  keyfilePath?: string;
  privateKeyPath?: string;
}

export interface OperationRow {
  id: number;
  kind: string;
  inputPaths: string;
  outputPath: string;
  fileCount: number;
  totalBytes: number;
  status: string;
  startedAt: number;
  endedAt: number;
}

export interface Settings {
  defaultCipher: "chacha20" | "aes256gcm";
  defaultKdfPreset: "interactive" | "moderate" | "paranoid";
  defaultCompression: boolean;
  defaultSecureDelete: "off" | "1pass" | "3pass" | "7pass";
  defaultChunkSize: number;
  autoOpenOutputFolder: boolean;
  confirmOverwrite: "always" | "never";
  showSsdWarning: boolean;
  rememberLastKeyfilePath: boolean;
  lastKeyfilePath: string;
  clearHistoryOnExit: boolean;
  compactMode: boolean;
  clipboardClearSeconds: number;
  randomizeOutputFilename: boolean;
}

export interface KeyfileInfo {
  path: string;
  fingerprint: string;
}

export interface KeypairInfo {
  publicPath: string;
  privatePath: string;
  fingerprint: string;
}

export interface PubkeyInfo {
  path: string;
  fingerprint: string;
}


export const startEncryptJob = (req: EncryptRequest) =>
  invoke<string>("start_encrypt_job", { req });

export const startDecryptJob = (req: DecryptRequest) =>
  invoke<string>("start_decrypt_job", { req });

export const cancelJob = (jobId: string) =>
  invoke<void>("cancel_job", { jobId });

export const previewHeader = (inputPath: string) =>
  invoke<ZencHeaderInfo>("preview_header", { inputPath });

export const verifyIntegrity = (
  inputPath: string,
  password?: string,
  keyfilePath?: string,
  privateKeyPath?: string,
) =>
  invoke<boolean>("verify_integrity", { inputPath, password, keyfilePath, privateKeyPath });

export const generateKeyfile = (path: string) =>
  invoke<KeyfileInfo>("generate_keyfile", { path });

export const fingerprintKeyfile = (path: string) =>
  invoke<string>("fingerprint_keyfile", { path });

export const generateKeypair = (basePath: string) =>
  invoke<KeypairInfo>("generate_keypair", { basePath });

export const inspectPubkey = (path: string) =>
  invoke<PubkeyInfo>("inspect_pubkey", { path });

export const listRecent = (limit = 50) =>
  invoke<OperationRow[]>("list_recent", { limit });

export const clearHistory = () =>
  invoke<void>("clear_history");

export const loadSettings = () =>
  invoke<Settings>("load_settings");

export const saveSettings = (settings: Settings) =>
  invoke<void>("save_settings", { settings });
