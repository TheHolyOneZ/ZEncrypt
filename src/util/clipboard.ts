import { useSettingsStore } from "../store/settingsStore";
import { useToastStore } from "../store/toastStore";

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let lastWritten = "";


export async function copyWithAutoClear(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }
  lastWritten = text;

  const seconds = useSettingsStore.getState().settings.clipboardClearSeconds;
  const toast = useToastStore.getState();

  if (pendingTimer) clearTimeout(pendingTimer);

  if (seconds > 0) {
    toast.push("success", `${label} — clipboard clears in ${seconds}s.`);
    pendingTimer = setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === lastWritten) {
          await navigator.clipboard.writeText("");
        }
      } catch {


        try { await navigator.clipboard.writeText(""); } catch {}
      }
      pendingTimer = null;
    }, seconds * 1000);
  } else {
    toast.push("success", `${label}.`);
  }
}
