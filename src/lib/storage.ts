import path from "path";

/**
 * Root directory for item-photo uploads.
 *
 * On Railway, attach a Volume to the service — its mount path is exposed as
 * RAILWAY_VOLUME_MOUNT_PATH and photos are written under <mount>/uploads.
 * UPLOAD_DIR overrides this with an explicit absolute path. In local dev with
 * neither set, falls back to a .uploads folder in the project root.
 */
export const UPLOAD_ROOT =
  process.env.UPLOAD_DIR ||
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "uploads")
    : path.join(process.cwd(), ".uploads"));

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return MIME[ext] || "application/octet-stream";
}

/**
 * Resolve stored path segments to an absolute path, guaranteeing the result
 * stays inside UPLOAD_ROOT (defends against ../ traversal). Returns null if the
 * path would escape the uploads root.
 */
export function resolveWithinUploads(segments: string[]): string | null {
  if (!segments || segments.length === 0) return null;
  if (segments.some((s) => s.includes("\0") || s === "..")) return null;

  const root = path.resolve(UPLOAD_ROOT);
  const resolved = path.resolve(root, segments.join("/"));

  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}
