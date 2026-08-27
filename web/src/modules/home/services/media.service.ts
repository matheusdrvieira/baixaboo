import axios from "axios";
import { normalizeDownloadUrl, validateDownloadUrl } from "@/shared/lib/media/format";
import { MediaApiError, type MediaErrorCode } from "@/shared/lib/media/types";
import { api } from "@/shared/services/http";

export type MediaProcessOperation =
  "extract-audio" | "extract-video" | "convert-audio" | "convert-video";

export type DownloadStage = "preparing" | "downloading";

export type DownloadMediaInput = {
  url?: string;
  jobId?: string;
  playlist?: boolean;
  onProgress?: (progress: number) => void;
  onStage?: (stage: DownloadStage) => void;
};

type PreparedDownloadStatus = {
  id: string;
  status: "processing" | "ready" | "downloading" | "delivered" | "failed";
  progress: number;
  filename: string | null;
  error: MediaErrorCode | null;
};

const ACTIVE_DOWNLOAD_STORAGE_KEY = "baixaboo.active-download";

export type ProcessMediaInput = {
  file?: File;
  operation?: MediaProcessOperation;
  format?: string;
  jobId?: string;
  onProgress?: (progress: number) => void;
  onStage?: (stage: DownloadStage) => void;
};

type ProcessedMediaStatus = {
  id: string;
  status: "processing" | "ready" | "downloading" | "delivered" | "failed";
  progress: number;
  filename: string | null;
  error: MediaErrorCode | null;
  operation: MediaProcessOperation;
  output_format: string;
};

export type ActiveMediaProcess = {
  id: string;
  operation: MediaProcessOperation;
  format: string;
};

export async function downloadMedia({
  url,
  jobId,
  playlist = false,
  onProgress,
  onStage,
}: DownloadMediaInput): Promise<void> {
  let activeJobId = jobId;

  try {
    let job: PreparedDownloadStatus;
    if (activeJobId) {
      const { data } = await api.get<PreparedDownloadStatus>(`/downloads/${activeJobId}`);
      job = data;
    } else {
      const submittedUrl = url ?? "";
      const validation = validateDownloadUrl(submittedUrl, playlist ? "playlist" : "video");
      if (!validation.valid) throw new MediaApiError("invalid_url", validation.reason);
      const normalized = normalizeDownloadUrl(submittedUrl);
      if (!normalized) throw new MediaApiError("invalid_url", "youtubeUrl");
      const { data } = await api.post<PreparedDownloadStatus>("/downloads", {
        url: normalized.url,
        playlist,
      });
      job = data;
      activeJobId = job.id;
      rememberActiveDownload(job.id);
    }

    if (job.status === "delivered") {
      forgetActiveDownload(job.id);
      return;
    }

    onStage?.(job.status === "processing" ? "preparing" : "downloading");
    onProgress?.(job.progress);

    if (job.status === "processing") {
      job = await waitForJobStatus<PreparedDownloadStatus>(
        `/downloads/${job.id}/events`,
        `/downloads/${job.id}`,
        (status) => status.status !== "processing",
        (status) => onProgress?.(status.progress),
      );
    }

    if (job.status === "failed") {
      forgetActiveDownload(job.id);
      throw new MediaApiError(job.error ?? "service_unavailable");
    }
    if (job.status === "ready") {
      const link = document.createElement("a");
      link.href = api.getUri({ url: `/downloads/${job.id}/file` });
      link.download = job.filename ?? "baixaboo-media";
      document.body.appendChild(link);
      link.click();
      link.remove();
      onStage?.("downloading");
    } else if (job.status !== "downloading") {
      throw new MediaApiError("unavailable");
    }

    if (job.status === "ready" || job.status === "downloading") {
      job = await waitForJobStatus<PreparedDownloadStatus>(
        `/downloads/${job.id}/events`,
        `/downloads/${job.id}`,
        (status) => status.status !== "ready" && status.status !== "downloading",
        (status) => onProgress?.(status.progress),
      );
    }

    if (job.status === "failed") {
      forgetActiveDownload(job.id);
      throw new MediaApiError(job.error ?? "service_unavailable");
    }
    if (job.status !== "delivered") {
      throw new MediaApiError("unavailable");
    }
    forgetActiveDownload(job.id);
  } catch (error) {
    if (error instanceof MediaApiError) throw error;
    if (
      activeJobId &&
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || error.response?.status === 404)
    ) {
      forgetActiveDownload(activeJobId);
    }
    throw mediaApiError(error, "service_unavailable");
  }
}

export async function getActiveDownloadId(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    const { data } = await api.get<PreparedDownloadStatus>("/downloads/active");
    rememberActiveDownload(data.id);
    return data.id;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      window.localStorage.removeItem(ACTIVE_DOWNLOAD_STORAGE_KEY);
      return null;
    }
    throw mediaApiError(error, "service_unavailable");
  }
}

function rememberActiveDownload(jobId: string): void {
  window.localStorage.setItem(ACTIVE_DOWNLOAD_STORAGE_KEY, jobId);
}

function forgetActiveDownload(jobId: string): void {
  if (window.localStorage.getItem(ACTIVE_DOWNLOAD_STORAGE_KEY) === jobId) {
    window.localStorage.removeItem(ACTIVE_DOWNLOAD_STORAGE_KEY);
  }
}

function waitForJobStatus<TStatus>(
  eventsPath: string,
  statusPath: string,
  shouldStop: (status: TStatus) => boolean,
  onStatus: (status: TStatus) => void,
): Promise<TStatus> {
  return new Promise((resolve, reject) => {
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let settled = false;

    function close() {
      source?.close();
      source = null;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    }

    function finish(status: TStatus) {
      if (settled) return;
      settled = true;
      close();
      resolve(status);
    }

    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      close();
      reject(mediaApiError(error, "service_unavailable"));
    }

    function receive(status: TStatus) {
      onStatus(status);
      if (shouldStop(status)) finish(status);
    }

    function connect() {
      if (settled) return;
      source = new EventSource(api.getUri({ url: eventsPath }), {
        withCredentials: true,
      });
      source.onmessage = (event) => {
        try {
          receive(JSON.parse(event.data) as TStatus);
        } catch (error) {
          fail(error);
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        void api
          .get<TStatus>(statusPath)
          .then(({ data }) => {
            receive(data);
            if (!settled) retryTimer = window.setTimeout(connect, 1_000);
          })
          .catch(fail);
      };
    }

    connect();
  });
}

export async function processMediaFile({
  file,
  operation,
  format,
  jobId,
  onProgress,
  onStage,
}: ProcessMediaInput): Promise<void> {
  try {
    onStage?.("preparing");
    let job: ProcessedMediaStatus;
    if (jobId) {
      const { data } = await api.get<ProcessedMediaStatus>(`/process/${jobId}`);
      job = data;
    } else {
      if (!file || !operation || !format) throw new MediaApiError("conversion_failed");
      const { data } = await api.post<ProcessedMediaStatus>("/process", file, {
        params: { operation, format: format.toLowerCase() },
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        timeout: 0,
        onUploadProgress: ({ loaded, total }) => {
          if (total && total > 0) {
            onProgress?.(Math.min(20, Math.round((loaded * 20) / total)));
          }
        },
      });
      job = data;
    }
    onProgress?.(job.progress);

    if (job.status === "processing") {
      job = await waitForJobStatus<ProcessedMediaStatus>(
        `/process/${job.id}/events`,
        `/process/${job.id}`,
        (status) => status.status !== "processing",
        (status) => onProgress?.(status.progress),
      );
    }

    if (job.status === "failed") {
      throw new MediaApiError(job.error ?? "conversion_failed");
    }
    if (job.status === "delivered") {
      onProgress?.(100);
      return;
    }
    if (job.status !== "ready" && job.status !== "downloading") {
      throw new MediaApiError("unavailable");
    }

    if (job.status === "ready") {
      onStage?.("downloading");
      const link = document.createElement("a");
      link.href = api.getUri({ url: `/process/${job.id}/file` });
      link.download = job.filename ?? `baixaboo.${job.output_format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      onStage?.("downloading");
    }

    if (job.status === "ready" || job.status === "downloading") {
      job = await waitForJobStatus<ProcessedMediaStatus>(
        `/process/${job.id}/events`,
        `/process/${job.id}`,
        (status) => status.status !== "ready" && status.status !== "downloading",
        (status) => onProgress?.(status.progress),
      );
    }
    if (job.status !== "delivered") {
      throw new MediaApiError(job.error ?? "unavailable");
    }
    onProgress?.(100);
  } catch (error) {
    if (error instanceof MediaApiError) throw error;
    throw mediaApiError(error, "conversion_failed");
  }
}

export async function getActiveMediaProcess(): Promise<ActiveMediaProcess | null> {
  try {
    const { data } = await api.get<ProcessedMediaStatus>("/process/active/current");
    return {
      id: data.id,
      operation: data.operation,
      format: data.output_format.toUpperCase(),
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw mediaApiError(error, "service_unavailable");
  }
}

function mediaApiError(error: unknown, fallback: MediaErrorCode): MediaApiError {
  if (!axios.isAxiosError(error)) return new MediaApiError(fallback);
  const code = error.response?.data?.code as MediaErrorCode | undefined;
  return new MediaApiError(code ?? errorCodeFromStatus(error.response?.status));
}

function errorCodeFromStatus(status?: number): MediaErrorCode {
  if (status === 429) return "rate_limited";
  if (status === 404) return "unavailable";
  if (status === 403) return "unauthorized_content";
  if (status === 408 || status === 504) return "timeout";
  return "service_unavailable";
}
