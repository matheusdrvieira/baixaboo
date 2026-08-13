// Tipagens compartilhadas da API de mídia da Baixaboo.

export type SourceKind =
  "video-platform" | "social" | "audio-service" | "cloud-storage" | "direct-link" | "other";

export interface DetectedSource {
  id: string;
  label: string;
  kind: SourceKind;
}

export interface VideoOption {
  id: string;
  resolution: string; // "best" | "8k" | "4k" | "1440p" ...
  label: string;
  container: "MP4" | "WebM" | "MKV" | "MOV";
  codec: string;
  fps?: number;
  hasAudio: boolean;
  requiresMux: boolean;
  estimatedBytes: number;
  estimatedSeconds: number;
  compatibility: string;
}

export interface AudioOption {
  id: string;
  format: "MP3" | "M4A" | "AAC" | "WAV" | "FLAC" | "OGG" | "OPUS";
  label: string;
  bitrates: number[];
  lossless: boolean;
  supportsCover: boolean;
  estimatedBytesPerMinute: number;
  compatibility: string;
}

export interface MediaAnalysis {
  id: string;
  title: string;
  author?: string;
  durationSeconds: number;
  thumbnailUrl?: string;
  source: DetectedSource;
  bestResolution: string;
  estimatedBytes: number;
  publishedAt?: string;
  mediaType: string;
  videoOptions: VideoOption[];
  audioOptions: AudioOption[];
}

export type MediaErrorCode =
  | "invalid_url"
  | "unsupported_source"
  | "unavailable"
  | "private_content"
  | "protected_content"
  | "unauthorized_content"
  | "age_restricted"
  | "analysis_failed"
  | "conversion_failed"
  | "file_too_large"
  | "unsupported_format"
  | "rate_limited"
  | "service_unavailable"
  | "timeout"
  | "captcha_required";

export class MediaApiError extends Error {
  code: MediaErrorCode;
  constructor(code: MediaErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "MediaApiError";
  }
}
