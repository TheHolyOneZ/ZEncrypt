import { create } from "zustand";
import type { Settings } from "../ipc/bridge";

const DEFAULT: Settings = {
  defaultCipher: "chacha20",
  defaultKdfPreset: "interactive",
  defaultCompression: true,
  defaultSecureDelete: "off",
  defaultChunkSize: 262144,
  autoOpenOutputFolder: false,
  confirmOverwrite: "always",
  showSsdWarning: true,
  rememberLastKeyfilePath: false,
  lastKeyfilePath: "",
  clearHistoryOnExit: false,
  compactMode: false,
  clipboardClearSeconds: 30,
  randomizeOutputFilename: false,
};

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  setSettings: (s: Settings) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT,
  loaded: false,
  setSettings: (settings) => set({ settings, loaded: true }),
}));
