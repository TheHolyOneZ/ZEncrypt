import { create } from "zustand";
import type { OperationRow } from "../ipc/bridge";

interface HistoryStore {
  rows: OperationRow[];
  setRows: (rows: OperationRow[]) => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  rows: [],
  setRows: (rows) => set({ rows }),
  clear: () => set({ rows: [] }),
}));
