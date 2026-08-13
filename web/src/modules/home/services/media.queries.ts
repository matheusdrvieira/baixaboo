"use client";

import { useMutation } from "@tanstack/react-query";
import { MediaApiError, type MediaAnalysis } from "@/shared/lib/media/types";
import {
  analyzeMedia,
  downloadMedia,
  processMediaFile,
  type DownloadMediaInput,
  type ProcessMediaInput,
} from "./media.service";

export function useAnalyzeMedia() {
  return useMutation<MediaAnalysis, MediaApiError, string>({
    mutationKey: ["media", "analyze"],
    mutationFn: analyzeMedia,
  });
}

export function useDownloadMedia() {
  return useMutation<void, MediaApiError, DownloadMediaInput>({
    mutationKey: ["media", "download"],
    mutationFn: downloadMedia,
  });
}

export function useProcessMedia() {
  return useMutation<void, MediaApiError, ProcessMediaInput>({
    mutationKey: ["media", "process"],
    mutationFn: processMediaFile,
  });
}
