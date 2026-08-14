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
    | "singleVideoRequired"
    | "playlistRequired";
  hostname?: string;
}

export type DownloadUrlKind = "video" | "playlist";

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

  const playlist = isYouTubePlaylistUrl(new URL(raw.trim()));
  if (expectedKind === "video" && playlist) {
    return { ...validation, valid: false, reason: "singleVideoRequired" };
  }
  if (expectedKind === "playlist" && !playlist) {
    return { ...validation, valid: false, reason: "playlistRequired" };
  }
  return validation;
}

function isYouTubePlaylistUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const isYouTube =
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "music.youtube.com" ||
    hostname === "youtu.be";
  return isYouTube && url.searchParams.getAll("list").some((identifier) => identifier.trim());
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
