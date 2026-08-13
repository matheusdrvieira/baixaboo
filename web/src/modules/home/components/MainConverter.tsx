"use client";

import { useState } from "react";
import { AlertCircle, ClipboardPaste, Link2, Loader2, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/shared/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { ConsentCheckbox } from "./ConsentCheckbox";
import { SupportedSources } from "./SupportedSources";
import { AnalysisSkeleton, AnalysisSummary } from "./AnalysisSummary";
import { VideoOptions, type VideoSelection } from "./VideoOptions";
import { AudioOptions, type AudioSelection } from "./AudioOptions";
import { ConfirmDownloadDialog } from "./ConfirmDownloadDialog";
import { validateMediaUrl } from "@/shared/lib/media/format";
import { MediaApiError } from "@/shared/lib/media/types";
import { useAnalyzeMedia, useDownloadMedia } from "@/modules/home/services/media.queries";
import { useSubmitGuard } from "@/shared/hooks/use-submit-guard";
import { cn } from "@/shared/lib/utils";

export function MainConverter() {
  const t = useTranslations("Home.Converter");
  const common = useTranslations("Common");
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [pending, setPending] = useState<{ summary: string } | null>(null);

  const analyze = useAnalyzeMedia();
  const download = useDownloadMedia();
  const { blocked, guard } = useSubmitGuard();

  const validation = validateMediaUrl(url);
  const touched = url.trim().length > 0;
  const source =
    validation.valid && validation.hostname ? validation.hostname.replace(/^www\./, "") : null;
  const analysis = analyze.data;

  const canAnalyze = validation.valid && authorized && !analyze.isPending && !blocked;

  const analyzeErrorCode =
    analyze.error instanceof MediaApiError
      ? analyze.error.code
      : analyze.error
        ? "analysis_failed"
        : null;

  function handleAnalyze() {
    if (!canAnalyze) return;
    guard(() => {
      analyze.mutate(url);
    });
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
    } catch {
      toast.error(t("pasteError"));
    }
  }

  function requestVideo(_selection: VideoSelection) {
    if (!analysis) return;
    setPending({
      summary: t("videoSummary"),
    });
  }

  function requestAudio(_selection: AudioSelection) {
    if (!analysis) return;
    setPending({
      summary: t("audioSummary"),
    });
  }

  function confirmDownload() {
    if (!pending) return;
    setPending(null);
    download.mutate({ url }, { onSuccess: () => toast.success(t("downloadStarted")) });
  }

  return (
    <section id="conversor" className="scroll-mt-24">
      <div className="surface-card shadow-card p-5 sm:p-7">
        <div>
          <Label htmlFor="media-url" className="text-sm font-semibold">
            {t("label")}
          </Label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Link2
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                id="media-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleAnalyze()}
                placeholder={t("placeholder")}
                inputMode="url"
                autoComplete="off"
                aria-invalid={touched && !validation.valid}
                aria-describedby="media-url-help"
                className={cn(
                  "h-12 pr-11 pl-9 text-base",
                  touched && !validation.valid && "border-destructive",
                  touched && validation.valid && "border-success",
                )}
              />
              <button
                type="button"
                onClick={handlePaste}
                aria-label={t("paste")}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <p id="media-url-help" className="mt-2 min-h-5 text-xs">
            {touched && !validation.valid ? (
              <span className="text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {validation.reason ? t(`validation.${validation.reason}`) : null}
              </span>
            ) : touched && source ? (
              <span className="text-success flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t("sourceIdentified", { source })}
              </span>
            ) : (
              <span className="text-muted-foreground">{t("helper")}</span>
            )}
          </p>
        </div>

        <ConsentCheckbox
          id="authorize-analysis"
          checked={authorized}
          onCheckedChange={setAuthorized}
          className="mt-4"
        >
          {t("consent")}
        </ConsentCheckbox>

        <Button
          size="lg"
          className="mt-4 h-12 w-full text-base"
          disabled={!canAnalyze}
          onClick={handleAnalyze}
        >
          {analyze.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              {t("analyzing")}
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("analyze")}
            </>
          )}
        </Button>

        <p className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
          {t("agreementBefore")}{" "}
          <Link href="/terms" className="text-primary font-medium hover:underline">
            {t("terms")}
          </Link>{" "}
          {t("agreementAfter")}
        </p>

        {analyzeErrorCode && (
          <div className="border-destructive/40 bg-destructive/5 mt-5 rounded-xl border p-4">
            <p className="text-destructive flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t(`errors.${analyzeErrorCode}.title`)}
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {t(`errors.${analyzeErrorCode}.description`)}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={handleAnalyze}>
              {t("retry")}
            </Button>
          </div>
        )}

        {analyze.isPending && <AnalysisSkeleton />}

        {analysis && !analyze.isPending && (
          <>
            <AnalysisSummary analysis={analysis} />

            <Tabs defaultValue={analysis.videoOptions.length ? "video" : "audio"} className="mt-6">
              <TabsList className="w-full">
                {analysis.videoOptions.length > 0 && (
                  <TabsTrigger value="video" className="flex-1">
                    {common("video")}
                  </TabsTrigger>
                )}
                {analysis.audioOptions.length > 0 && (
                  <TabsTrigger value="audio" className="flex-1">
                    {common("audio")}
                  </TabsTrigger>
                )}
              </TabsList>
              {analysis.videoOptions.length > 0 && (
                <TabsContent value="video" className="mt-5">
                  <VideoOptions options={analysis.videoOptions} onSubmit={requestVideo} />
                </TabsContent>
              )}
              {analysis.audioOptions.length > 0 && (
                <TabsContent value="audio" className="mt-5">
                  <AudioOptions
                    options={analysis.audioOptions}
                    durationSeconds={analysis.durationSeconds}
                    onSubmit={requestAudio}
                  />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}

        <SupportedSources />
      </div>

      <ConfirmDownloadDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        onConfirm={confirmDownload}
        summary={pending?.summary ?? ""}
      />
    </section>
  );
}
