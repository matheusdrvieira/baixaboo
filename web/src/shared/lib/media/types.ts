export type MediaErrorCode =
  | "invalid_url"
  | "invalid_file"
  | "unsupported_source"
  | "unavailable"
  | "unauthorized_content"
  | "conversion_failed"
  | "file_too_large"
  | "unsupported_format"
  | "rate_limited"
  | "service_misconfigured"
  | "service_unavailable"
  | "timeout";

export class MediaApiError extends Error {
  code: MediaErrorCode;
  constructor(code: MediaErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "MediaApiError";
  }
}
