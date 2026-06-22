export function pathTail(p: string): string {
  return p.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? p;
}
