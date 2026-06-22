import { stat } from "@tauri-apps/plugin-fs";
import type { InputItem } from "../store/jobStore";
import { pathTail } from "./pathTail";

export async function statItems(paths: string[]): Promise<InputItem[]> {
  return Promise.all(
    paths.map(async (p) => {
      try {
        const info = await stat(p);
        return { path: p, name: pathTail(p), size: info.size, isDir: info.isDirectory };
      } catch {
        return { path: p, name: pathTail(p) };
      }
    })
  );
}
