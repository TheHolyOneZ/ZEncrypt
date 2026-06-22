import { useMemo } from "react";
import { type } from "@tauri-apps/plugin-os";

let cachedIsMac: boolean | null = null;

function detectIsMac(): boolean {
  if (cachedIsMac !== null) return cachedIsMac;
  try {
    cachedIsMac = type() === "macos";
  } catch {
    cachedIsMac = false;
  }
  return cachedIsMac;
}

export function useModKey(): string {
  return useMemo(() => (detectIsMac() ? "Cmd" : "Ctrl"), []);
}
