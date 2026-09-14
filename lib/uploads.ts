export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

// Extensions accepted from both team and clients. Anything executable/scripty is out.
const ALLOWED_EXTENSIONS = new Set([
  // images
  "png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "heic", "tif", "tiff", "bmp",
  // documents
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "md", "rtf", "odt", "ods", "odp", "json",
  // design / source
  "fig", "sketch", "xd", "psd", "ai", "eps", "indd", "afdesign", "afphoto",
  // video / audio
  "mp4", "mov", "webm", "m4v", "mp3", "wav", "m4a",
  // fonts / archives
  "ttf", "otf", "woff", "woff2", "zip",
]);

export function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

export function isAllowedUpload(file: File): boolean {
  return ALLOWED_EXTENSIONS.has(fileExtension(file.name));
}

export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
