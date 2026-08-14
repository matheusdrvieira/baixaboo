// URL utils + validação (inclui prevenção básica contra SSRF no cliente).

const BLOCKED_HOSTNAMES = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"];

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

export interface UrlValidation {
  valid: boolean;
  reason?:
    | "required"
    | "invalid"
    | "protocol"
    | "internal"
    | "privateIp"
    | "domain"
    | "youtubeUrl"
    | "singleVideoRequired"
    | "playlistRequired";
  hostname?: string;
}

export type DownloadUrlKind = "video" | "playlist";

export type NormalizedDownloadUrl = {
  kind: DownloadUrlKind;
  url: string;
};

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PLAYLIST_ID = /^[A-Za-z0-9_-]{10,100}$/;

export function getDownloadUrlKind(raw: string): DownloadUrlKind {
  return normalizeDownloadUrl(raw)?.kind ?? "video";
}

export function normalizeDownloadUrl(raw: string): NormalizedDownloadUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "youtu.be") {
    const segments = parsed.pathname.split("/").filter(Boolean);
    const videoId = segments.length === 1 ? segments[0] : null;
    if (!videoId || !YOUTUBE_VIDEO_ID.test(videoId) || parsed.searchParams.has("list")) {
      return null;
    }
    return {
      kind: "video",
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (hostname !== "youtube.com" && hostname !== "www.youtube.com") {
    return null;
  }

  const pathname = parsed.pathname.replace(/\/$/, "");
  if (pathname === "/watch" && !parsed.searchParams.has("list")) {
    const videoId = parsed.searchParams.get("v")?.trim();
    if (!videoId || !YOUTUBE_VIDEO_ID.test(videoId)) return null;
    return {
      kind: "video",
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (pathname === "/playlist") {
    const playlistId = parsed.searchParams.get("list")?.trim();
    if (!playlistId || !YOUTUBE_PLAYLIST_ID.test(playlistId)) return null;
    return {
      kind: "playlist",
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
    };
  }

  return null;
}

export function validateMediaUrl(raw: string): UrlValidation {
  const value = raw.trim();
  if (!value) return { valid: false, reason: "required" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, reason: "invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valid: false, reason: "protocol" };
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    return { valid: false, reason: "internal" };
  }
  if (PRIVATE_IP_PATTERNS.some((p) => p.test(host))) {
    return { valid: false, reason: "privateIp" };
  }
  if (!host.includes(".")) {
    return { valid: false, reason: "domain" };
  }
  return { valid: true, hostname: host };
}

export function validateDownloadUrl(raw: string, expectedKind: DownloadUrlKind): UrlValidation {
  const validation = validateMediaUrl(raw);
  if (!validation.valid) return validation;

  const normalized = normalizeDownloadUrl(raw);
  if (!normalized) {
    return { ...validation, valid: false, reason: "youtubeUrl" };
  }
  if (expectedKind === "video" && normalized.kind === "playlist") {
    return { ...validation, valid: false, reason: "singleVideoRequired" };
  }
  if (expectedKind === "playlist" && normalized.kind !== "playlist") {
    return { ...validation, valid: false, reason: "playlistRequired" };
  }
  return validation;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s`;
  return `~${Math.round(seconds / 60)} min`;
}

export function formatDate(iso?: string, locale = "pt-BR"): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "—";
  }
}
