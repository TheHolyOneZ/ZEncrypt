const SKIP = new Set([
  "jpg","jpeg","png","webp","gif","heic","avif",
  "mp4","mov","mkv","webm","m4v","avi",
  "mp3","aac","m4a","ogg","opus","flac",
  "zip","7z","rar","gz","xz","zst","bz2","lz4","br",
  "pdf",
  "docx","xlsx","pptx","odt","ods","odp","epub","apk","jar",
]);

export function isIncompressible(filename: string): boolean {
  const ext = filename.split(".").at(-1)?.toLowerCase() ?? "";
  return SKIP.has(ext);
}
