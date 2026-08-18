"use client";

import { useDownloadMedia, useProcessMedia } from "@/modules/home/services/media.queries";
import {
  getActiveDownloadId,
  getActiveMediaProcess,
  type DownloadStage,
  type MediaProcessOperation,
} from "@/modules/home/services/media.service";
import { LogoMark } from "@/shared/components/baixaboo/Logo";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useTheme } from "@/shared/contexts/theme";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import {
  getDownloadUrlKind,
  normalizeDownloadUrl,
  validateDownloadUrl,
} from "@/shared/lib/media/format";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleAlert,
  Clapperboard,
  Download,
  FileAudio,
  FileVideo,
  Film,
  Languages,
  Link2,
  Menu,
  Moon,
  Music2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ChangeEvent, useEffect, useRef, useState } from "react";

type ToolMode = "download" | "extract" | "convert";
type SecondaryToolMode = Exclude<ToolMode, "download">;
type MediaKind = "audio" | "video";
type Locale = "pt" | "en";

const audioFormats = ["MP3", "M4A", "WAV", "FLAC", "AAC", "OGG"];
const videoFormats = ["MP4", "WEBM", "MOV", "MKV"];
const navigationTargets = ["como-funciona", "formatos", "uso-responsavel", "faq"];

function Brand() {
  return (
    <a className="brand" href="#topo" aria-label="Baixaboo">
      <LogoMark className="brand-logo-mark" />
      <span>Baixaboo</span>
    </a>
  );
}

function FilePicker({
  accept,
  file,
  onFile,
  kind,
  disabled = false,
}: {
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
  kind: "video" | "audio";
  locale?: Locale;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const t = useTranslations("HomePage");

  function pick(event: ChangeEvent<HTMLInputElement>) {
    if (disabled) {
      event.currentTarget.value = "";
      return;
    }
    onFile(event.target.files?.[0] ?? null);
  }

  return (
    <>
      <input ref={input} type="file" accept={accept} onChange={pick} disabled={disabled} hidden />
      <Button
        className="dropzone"
        variant="outline"
        type="button"
        disabled={disabled}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) input.current?.click();
        }}
      >
        <span className="dropzone-icon">
          {kind === "video" ? <FileVideo size={24} /> : <FileAudio size={24} />}
        </span>
        {file ? (
          <span className="dropzone-copy">
            <strong>{file.name}</strong>
            <small>
              {(file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
              {disabled ? t("lockedFile") : t("changeFile")}
            </small>
          </span>
        ) : (
          <span className="dropzone-copy">
            <strong>{kind === "video" ? t("uploadVideo") : t("uploadAudio")}</strong>
            <small>{kind === "video" ? t("videoFormats") : t("audioFileFormats")}</small>
          </span>
        )}
        <UploadCloud size={20} className="dropzone-upload" />
      </Button>
    </>
  );
}

function ToolChoice({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="tool-choice" role="group" aria-label={label}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "secondary" : "ghost"}
          className={value === option.value ? "tool-choice-button selected" : "tool-choice-button"}
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<ToolMode>("download");
  const [secondaryMode, setSecondaryMode] = useState<SecondaryToolMode>("extract");
  const [extractKind, setExtractKind] = useState<MediaKind>("audio");
  const [convertKind, setConvertKind] = useState<MediaKind>("audio");
  const [url, setUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoTrackFile, setVideoTrackFile] = useState<File | null>(null);
  const [videoConvertFile, setVideoConvertFile] = useState<File | null>(null);
  const [format, setFormat] = useState("MP3");
  const [videoFormat, setVideoFormat] = useState("MP4");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [processProgress, setProcessProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState<DownloadStage>("preparing");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [checkingActiveDownload, setCheckingActiveDownload] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const restoredDownload = useRef(false);
  const currentLocale = useLocale();
  const locale: Locale = currentLocale === "en" ? "en" : "pt";
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("HomePage");
  const c = {
    nav: t.raw("nav") as string[],
    start: t("start"),
    theme: t("theme"),
    language: t("language"),
    navigation: t("navigation"),
    openMenu: t("openMenu"),
    closeMenu: t("closeMenu"),
    eyebrow: t("eyebrow"),
    hero: t("hero"),
    heroAccent: t("heroAccent"),
    heroText: t("heroText"),
    downloadPlaceholder: t("downloadPlaceholder"),
    secondaryLabel: t("secondaryLabel"),
    secondaryTitle: t("secondaryTitle"),
    secondaryText: t("secondaryText"),
    tabs: t.raw("tabs") as readonly [
      readonly [string, string],
      readonly [string, string],
      readonly [string, string],
    ],
    videoOption: t("videoOption"),
    playlistOption: t("playlistOption"),
    audioFromVideoOption: t("audioFromVideoOption"),
    videoWithoutAudioOption: t("videoWithoutAudioOption"),
    audioFileOption: t("audioFileOption"),
    videoFileOption: t("videoFileOption"),
    downloadTitle: t("downloadTitle"),
    downloadText: t("downloadText"),
    playlistTitle: t("playlistTitle"),
    playlistText: t("playlistText"),
    link: t("link"),
    playlistLink: t("playlistLink"),
    best: t("best"),
    playlistBest: t("playlistBest"),
    direct: t("direct"),
    playlistDirect: t("playlistDirect"),
    extractTitle: t("extractTitle"),
    extractText: t("extractText"),
    convertTitle: t("convertTitle"),
    convertText: t("convertText"),
    extractVideoTitle: t("extractVideoTitle"),
    extractVideoText: t("extractVideoText"),
    convertVideoTitle: t("convertVideoTitle"),
    convertVideoText: t("convertVideoText"),
    uploadVideo: t("uploadVideo"),
    uploadAudio: t("uploadAudio"),
    changeFile: t("changeFile"),
    lockedFile: t("lockedFile"),
    videoFormats: t("videoFormats"),
    audioFileFormats: t("audioFileFormats"),
    output: t("output"),
    authorize: t("authorize"),
    working: t("working"),
    downloading: t("downloading"),
    done: t("done"),
    error: t("error"),
    invalidUrl: t("invalidUrl"),
    youtubeUrlWarning: t("youtubeUrlWarning"),
    singleVideoRequired: t("singleVideoRequired"),
    playlistRequired: t("playlistRequired"),
    downloadCta: t("downloadCta"),
    downloadPlaylistCta: t("downloadPlaylistCta"),
    extractCta: t("extractCta"),
    convertCta: t("convertCta"),
    extractVideoCta: t("extractVideoCta"),
    convertVideoCta: t("convertVideoCta"),
    legalA: t("legalA"),
    terms: t("terms"),
    legalB: t("legalB"),
    trust: t.raw("trust") as readonly [
      readonly [string, string],
      readonly [string, string],
      readonly [string, string],
    ],
    how: t("how"),
    howTitle: t("howTitle"),
    steps: t.raw("steps") as readonly [
      readonly [string, string],
      readonly [string, string],
      readonly [string, string],
    ],
    formats: t("formats"),
    formatsTitle: t("formatsTitle"),
    formatsText: t("formatsText"),
    solutionsLabel: t("solutionsLabel"),
    solutionsTitle: t("solutionsTitle"),
    solutions: t.raw("solutions") as readonly (readonly [string, string])[],
    responsibleTitle: t("responsibleTitle"),
    responsibleText: t("responsibleText"),
    guidelines: t("guidelines"),
    faqLabel: t("faqLabel"),
    faqTitle: t("faqTitle"),
    faqs: t.raw("faqs") as readonly (readonly [string, string])[],
    footerText: t("footerText"),
    privacy: t("privacy"),
    copyright: t("copyright"),
    footerLegal: t("footerLegal"),
  };
  const downloadMedia = useDownloadMedia();
  const processMedia = useProcessMedia();
  const busy =
    checkingActiveDownload ||
    status === "working" ||
    downloadMedia.isPending ||
    processMedia.isPending;

  useEffect(() => {
    if (restoredDownload.current) return;
    restoredDownload.current = true;

    void (async () => {
      try {
        const jobId = await getActiveDownloadId();
        if (!jobId) {
          const activeProcess = await getActiveMediaProcess();
          if (!activeProcess) {
            setCheckingActiveDownload(false);
            return;
          }

          const [nextMode, nextKind] = activeProcess.operation.split("-") as [
            "extract" | "convert",
            MediaKind,
          ];
          setMode(nextMode);
          setSecondaryMode(nextMode);
          if (nextMode === "extract") setExtractKind(nextKind);
          else setConvertKind(nextKind);
          if (nextKind === "audio") setFormat(activeProcess.format);
          else setVideoFormat(activeProcess.format);
          setStatus("working");
          setCheckingActiveDownload(false);
          setProcessProgress(20);
          setDownloadStage("preparing");
          await processMedia.mutateAsync({
            jobId: activeProcess.id,
            onProgress: setProcessProgress,
            onStage: setDownloadStage,
          });
          setStatus("done");
          window.setTimeout(() => setStatus("idle"), 1500);
          return;
        }

        setMode("download");
        setStatus("working");
        setCheckingActiveDownload(false);
        setDownloadProgress(0);
        setDownloadStage("preparing");
        await downloadMedia.mutateAsync({
          jobId,
          onProgress: setDownloadProgress,
          onStage: setDownloadStage,
        });
        setStatus("done");
        window.setTimeout(() => setStatus("idle"), 1500);
      } catch {
        setCheckingActiveDownload(false);
        setStatus("error");
      }
    })();
  }, [downloadMedia, processMedia]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }

    window.addEventListener("keydown", closeMenuOnEscape);
    return () => window.removeEventListener("keydown", closeMenuOnEscape);
  }, [mobileNavOpen]);

  function toggleTheme() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }

  function toggleLocale() {
    const next = locale === "pt" ? "en" : "pt";
    router.replace(pathname, { locale: next });
  }

  const secondaryTabs = [
    { id: "extract" as const, label: c.tabs[1][0], description: c.tabs[1][1], icon: Music2 },
    { id: "convert" as const, label: c.tabs[2][0], description: c.tabs[2][1], icon: RefreshCw },
  ];

  function changeMode(next: SecondaryToolMode) {
    if (busy) return;
    setMode(next);
    setSecondaryMode(next);
    setStatus("idle");
    setProcessProgress(0);
  }

  const downloadKind = getDownloadUrlKind(url);
  const downloadUrlValidation = validateDownloadUrl(url, downloadKind);
  const validDownloadUrl = downloadUrlValidation.valid;
  const downloadUrlError =
    downloadUrlValidation.reason === "youtubeUrl" ? c.youtubeUrlWarning : c.invalidUrl;
  const processHasInput =
    (secondaryMode === "extract" &&
      (extractKind === "audio" ? Boolean(videoFile) : Boolean(videoTrackFile))) ||
    (secondaryMode === "convert" &&
      (convertKind === "audio" ? Boolean(audioFile) : Boolean(videoConvertFile)));

  async function startDownload() {
    if (!validDownloadUrl || busy) return;
    const normalized = normalizeDownloadUrl(url);
    if (!normalized) return;
    setMode("download");
    setStatus("working");
    const submittedUrl = normalized.url;
    setUrl("");
    setDownloadProgress(0);
    setDownloadStage("preparing");
    try {
      await downloadMedia.mutateAsync({
        url: submittedUrl,
        playlist: downloadKind === "playlist",
        onProgress: setDownloadProgress,
        onStage: setDownloadStage,
      });
      setStatus("done");
      window.setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }

  async function startProcess() {
    if (!processHasInput || busy) return;
    setMode(secondaryMode);
    setStatus("working");

    let file: File | null = null;
    let operation: MediaProcessOperation;
    let outputFormat: string;

    if (secondaryMode === "extract") {
      file = extractKind === "audio" ? videoFile : videoTrackFile;
      operation = extractKind === "audio" ? "extract-audio" : "extract-video";
      outputFormat = extractKind === "audio" ? format : videoFormat;
    } else {
      file = convertKind === "audio" ? audioFile : videoConvertFile;
      operation = convertKind === "audio" ? "convert-audio" : "convert-video";
      outputFormat = convertKind === "audio" ? format : videoFormat;
    }

    if (!file) {
      setStatus("error");
      return;
    }

    try {
      setProcessProgress(0);
      setDownloadStage("preparing");
      await processMedia.mutateAsync({
        file,
        operation,
        format: outputFormat,
        onProgress: setProcessProgress,
        onStage: setDownloadStage,
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="site-shell" id="topo">
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label={c.navigation}>
            {c.nav.map((label, index) => (
              <a key={navigationTargets[index]} href={`#${navigationTargets[index]}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="header-control"
              type="button"
              onClick={toggleLocale}
              aria-label={c.language}
              title={c.language}
            >
              <Languages size={17} />
              <span>{locale.toUpperCase()}</span>
            </button>
            <button
              className="header-control icon-only"
              type="button"
              onClick={toggleTheme}
              aria-label={c.theme}
              title={c.theme}
            >
              <Sun size={17} className="hidden dark:block" />
              <Moon size={17} className="dark:hidden" />
            </button>
            <button
              className="header-control icon-only mobile-menu-toggle"
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-controls="mobile-navigation"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? c.closeMenu : c.openMenu}
              title={mobileNavOpen ? c.closeMenu : c.openMenu}
            >
              {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav id="mobile-navigation" className="mobile-nav" aria-label={c.navigation}>
            {c.nav.map((label, index) => (
              <a
                key={navigationTargets[index]}
                href={`#${navigationTargets[index]}`}
                onClick={() => setMobileNavOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <section className="hero">
        <div className="eyebrow">
          <Sparkles size={14} /> {c.eyebrow}
        </div>
        <h1>
          {c.hero}
          <span>{c.heroAccent}</span>
        </h1>
        <p>{c.heroText}</p>

        <form
          className="download-form"
          aria-label={c.tabs[0][0]}
          onSubmit={(event) => {
            event.preventDefault();
            void startDownload();
          }}
        >
          <div className="download-input-row">
            <div
              className="download-url-field"
              data-invalid={url.trim().length > 0 && !validDownloadUrl ? "true" : undefined}
            >
              <Link2 size={21} aria-hidden="true" />
              <Input
                className="media-url-input"
                id="media-url"
                value={url}
                disabled={busy}
                data-clarity-unmask="true"
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (mode === "download") setStatus("idle");
                }}
                placeholder={c.downloadPlaceholder}
                inputMode="url"
                autoComplete="url"
                aria-label={c.downloadPlaceholder}
                aria-invalid={url.trim().length > 0 && !validDownloadUrl}
                aria-describedby={
                  url.trim().length > 0 && !validDownloadUrl ? "download-url-warning" : undefined
                }
              />
            </div>
            <Button className="download-button" type="submit" disabled={!validDownloadUrl || busy}>
              {mode === "download" && status === "working" ? (
                <>
                  <RefreshCw size={19} className="spin" />
                  <span>
                    {downloadStage === "downloading" ? c.downloading : c.working}
                    {downloadStage === "preparing" && ` ${downloadProgress}%`}
                  </span>
                </>
              ) : mode === "download" && status === "done" ? (
                <>
                  <Check size={20} /> <span>{c.done}</span>
                </>
              ) : (
                <>
                  <Download size={20} /> <span>{c.downloadCta}</span>
                </>
              )}
            </Button>
          </div>

          {mode === "download" && status === "error" && <p className="process-error">{c.error}</p>}
          {url.trim().length > 0 && !validDownloadUrl && (
            <p className="download-url-warning" id="download-url-warning">
              <CircleAlert size={15} aria-hidden="true" />
              <span>{downloadUrlError}</span>
            </p>
          )}

          <p className="legal-line">
            {c.legalA} <Link href="/terms">{c.terms}</Link> {c.legalB}
          </p>
        </form>
      </section>

      <div className="workspace" id="ferramentas">
        <main className="main-column">
          <div className="trust-row">
            <div>
              <ShieldCheck size={20} />
              <span>
                <strong>{c.trust[0][0]}</strong>
                <small>{c.trust[0][1]}</small>
              </span>
            </div>
            <div>
              <Zap size={20} />
              <span>
                <strong>{c.trust[1][0]}</strong>
                <small>{c.trust[1][1]}</small>
              </span>
            </div>
            <div>
              <BadgeCheck size={20} />
              <span>
                <strong>{c.trust[2][0]}</strong>
                <small>{c.trust[2][1]}</small>
              </span>
            </div>
          </div>

          <section className="secondary-tools" aria-labelledby="secondary-tools-title">
            <div className="section-heading secondary-heading">
              <span>{c.secondaryLabel}</span>
              <h2 id="secondary-tools-title">{c.secondaryTitle}</h2>
              <p>{c.secondaryText}</p>
            </div>

            <Card className="tool-card secondary-tool-card" aria-label={c.secondaryLabel}>
              <Tabs
                value={secondaryMode}
                onValueChange={(value) => changeMode(value as SecondaryToolMode)}
              >
                <TabsList className="tabs secondary-tabs" aria-label={c.secondaryLabel}>
                  {secondaryTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = secondaryMode === tab.id;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className={active ? "tab active" : "tab"}
                        disabled={busy}
                      >
                        <span className="tab-icon">
                          <Icon size={19} />
                        </span>
                        <span>
                          <strong>{tab.label}</strong>
                          <small>{tab.description}</small>
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <div className="tool-body">
                  {secondaryMode === "extract" && (
                    <div className="tool-panel" role="tabpanel">
                      <ToolChoice
                        label={c.tabs[1][0]}
                        value={extractKind}
                        disabled={busy}
                        options={[
                          { value: "audio", label: c.audioFromVideoOption },
                          { value: "video", label: c.videoWithoutAudioOption },
                        ]}
                        onChange={(value) => {
                          setExtractKind(value as MediaKind);
                          setStatus("idle");
                        }}
                      />
                      <div className="panel-heading">
                        <span
                          className={extractKind === "audio" ? "panel-icon" : "panel-icon video"}
                        >
                          {extractKind === "audio" ? <Music2 size={23} /> : <Film size={23} />}
                        </span>
                        <div>
                          <h2>{extractKind === "audio" ? c.extractTitle : c.extractVideoTitle}</h2>
                          <p>{extractKind === "audio" ? c.extractText : c.extractVideoText}</p>
                        </div>
                      </div>
                      {extractKind === "audio" ? (
                        <>
                          <FilePicker
                            key="extract-audio"
                            accept="video/*,.mkv,.webm"
                            file={videoFile}
                            onFile={(file) => {
                              setVideoFile(file);
                              setStatus("idle");
                            }}
                            kind="video"
                            locale={locale}
                            disabled={busy}
                          />
                          <FormatControls
                            kind="audio"
                            format={format}
                            setFormat={setFormat}
                            locale={locale}
                            disabled={busy}
                          />
                        </>
                      ) : (
                        <>
                          <FilePicker
                            key="extract-video"
                            accept="video/*,.mkv,.webm"
                            file={videoTrackFile}
                            onFile={(file) => {
                              setVideoTrackFile(file);
                              setStatus("idle");
                            }}
                            kind="video"
                            locale={locale}
                            disabled={busy}
                          />
                          <FormatControls
                            kind="video"
                            format={videoFormat}
                            setFormat={setVideoFormat}
                            locale={locale}
                            disabled={busy}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {secondaryMode === "convert" && (
                    <div className="tool-panel" role="tabpanel">
                      <ToolChoice
                        label={c.tabs[2][0]}
                        value={convertKind}
                        disabled={busy}
                        options={[
                          { value: "audio", label: c.audioFileOption },
                          { value: "video", label: c.videoFileOption },
                        ]}
                        onChange={(value) => {
                          setConvertKind(value as MediaKind);
                          setStatus("idle");
                        }}
                      />
                      <div className="panel-heading">
                        <span
                          className={convertKind === "audio" ? "panel-icon" : "panel-icon video"}
                        >
                          {convertKind === "audio" ? (
                            <RefreshCw size={22} />
                          ) : (
                            <Clapperboard size={23} />
                          )}
                        </span>
                        <div>
                          <h2>{convertKind === "audio" ? c.convertTitle : c.convertVideoTitle}</h2>
                          <p>{convertKind === "audio" ? c.convertText : c.convertVideoText}</p>
                        </div>
                      </div>
                      {convertKind === "audio" ? (
                        <>
                          <FilePicker
                            key="convert-audio"
                            accept="audio/*,.flac,.ogg,.m4a"
                            file={audioFile}
                            onFile={(file) => {
                              setAudioFile(file);
                              setStatus("idle");
                            }}
                            kind="audio"
                            locale={locale}
                            disabled={busy}
                          />
                          <FormatControls
                            kind="audio"
                            format={format}
                            setFormat={setFormat}
                            locale={locale}
                            disabled={busy}
                          />
                        </>
                      ) : (
                        <>
                          <FilePicker
                            key="convert-video"
                            accept="video/*,.mkv,.webm"
                            file={videoConvertFile}
                            onFile={(file) => {
                              setVideoConvertFile(file);
                              setStatus("idle");
                            }}
                            kind="video"
                            locale={locale}
                            disabled={busy}
                          />
                          <FormatControls
                            kind="video"
                            format={videoFormat}
                            setFormat={setVideoFormat}
                            locale={locale}
                            disabled={busy}
                          />
                        </>
                      )}
                    </div>
                  )}

                  <Button
                    className="primary-button"
                    type="button"
                    disabled={!processHasInput || busy}
                    onClick={() => void startProcess()}
                  >
                    {mode === secondaryMode && status === "working" ? (
                      <>
                        <RefreshCw size={19} className="spin" />{" "}
                        {downloadStage === "downloading" ? c.downloading : c.working}
                        {downloadStage === "preparing" && ` ${processProgress}%`}
                      </>
                    ) : mode === secondaryMode && status === "done" ? (
                      <>
                        <Check size={20} /> {c.done}
                      </>
                    ) : secondaryMode === "extract" ? (
                      extractKind === "audio" ? (
                        <>
                          <Music2 size={20} /> {c.extractCta} {format}
                        </>
                      ) : (
                        <>
                          <Film size={20} /> {c.extractVideoCta} {videoFormat}
                        </>
                      )
                    ) : convertKind === "video" ? (
                      <>
                        <Clapperboard size={20} /> {c.convertVideoCta} {videoFormat}
                      </>
                    ) : (
                      <>
                        <RefreshCw size={20} /> {c.convertCta} {format}
                      </>
                    )}
                  </Button>

                  {mode === secondaryMode && status === "error" && (
                    <p className="process-error">{c.error}</p>
                  )}

                  <p className="legal-line">
                    {c.legalA} <Link href="/terms">{c.terms}</Link> {c.legalB}
                  </p>
                </div>
              </Tabs>
            </Card>
          </section>

          <section className="info-section" id="como-funciona">
            <div className="section-heading">
              <span>{c.how}</span>
              <h2>{c.howTitle}</h2>
            </div>
            <div className="steps-grid">
              {c.steps.map((step, index) => (
                <article key={step[0]}>
                  <span>0{index + 1}</span>
                  <h3>{step[0]}</h3>
                  <p>{step[1]}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="info-section solutions-section" aria-labelledby="solutions-title">
            <div className="section-heading">
              <span>{c.solutionsLabel}</span>
              <h2 id="solutions-title">{c.solutionsTitle}</h2>
              <p>{c.formatsText}</p>
            </div>
            <div className="solutions-grid">
              {c.solutions.map((solution, index) => (
                <article key={solution[0]}>
                  <span>0{index + 1}</span>
                  <div>
                    <h3>{solution[0]}</h3>
                    <p>{solution[1]}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="format-section" id="formatos" aria-labelledby="formats-title">
            <div>
              <span className="section-kicker">{c.formats}</span>
              <h2 id="formats-title">{c.formatsTitle}</h2>
              <p>{c.formatsText}</p>
            </div>
            <div className="format-cloud" aria-label={c.formatsTitle}>
              {[...videoFormats, ...audioFormats].map((supportedFormat) => (
                <span key={supportedFormat}>{supportedFormat}</span>
              ))}
            </div>
          </section>

          <section
            className="responsible-section"
            id="uso-responsavel"
            aria-labelledby="responsible-title"
          >
            <ShieldCheck size={28} aria-hidden="true" />
            <div>
              <h2 id="responsible-title">{c.responsibleTitle}</h2>
              <p>{c.responsibleText}</p>
            </div>
            <Link href="/copyright">
              {c.guidelines} <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </section>

          <section className="info-section faq-section" id="faq" aria-labelledby="faq-title">
            <div className="section-heading">
              <span>{c.faqLabel}</span>
              <h2 id="faq-title">{c.faqTitle}</h2>
            </div>
            <div className="faq-list">
              {c.faqs.map((faq) => (
                <details key={faq[0]}>
                  <summary>{faq[0]}</summary>
                  <p>{faq[1]}</p>
                </details>
              ))}
            </div>
          </section>
        </main>
      </div>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <Brand />
            <p>{c.footerText}</p>
          </div>
          <nav aria-label="Links legais">
            <Link href="/terms">{c.terms}</Link>
            <Link href="/privacy">{c.privacy}</Link>
            <Link href="/copyright">{c.copyright}</Link>
          </nav>
          <small>
            © {new Date().getFullYear()} Baixaboo. {c.footerLegal}
          </small>
        </div>
      </footer>
    </div>
  );
}

function FormatControls({
  kind,
  format,
  setFormat,
  disabled = false,
}: {
  kind: "audio" | "video";
  format: string;
  setFormat: (format: string) => void;
  locale?: Locale;
  disabled?: boolean;
}) {
  const t = useTranslations("HomePage");
  const formats = kind === "audio" ? audioFormats : videoFormats;
  return (
    <div className="format-controls">
      <div>
        <Label className="field-label">{t("output")}</Label>
        <div className="format-options">
          {formats.map((item) => (
            <Button
              key={item}
              type="button"
              variant={format === item ? "secondary" : "outline"}
              className={format === item ? "selected" : ""}
              disabled={disabled}
              onClick={() => setFormat(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
