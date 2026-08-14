"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleAlert,
  Clapperboard,
  Download,
  Film,
  FileAudio,
  FileVideo,
  Link2,
  Languages,
  Music2,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  Zap,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useTheme } from "@/shared/contexts/theme";
import { LogoMark } from "@/shared/components/baixaboo/Logo";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import {
  getActiveDownloadId,
  getActiveMediaProcess,
  type DownloadStage,
  type MediaProcessOperation,
} from "@/modules/home/services/media.service";
import { useDownloadMedia, useProcessMedia } from "@/modules/home/services/media.queries";
import {
  getDownloadUrlKind,
  normalizeDownloadUrl,
  validateDownloadUrl,
} from "@/shared/lib/media/format";

type ToolMode = "download" | "extract" | "convert";
type SecondaryToolMode = Exclude<ToolMode, "download">;
type MediaKind = "audio" | "video";
type Locale = "pt" | "en";

const audioFormats = ["MP3", "M4A", "WAV", "FLAC", "AAC", "OGG"];
const videoFormats = ["MP4", "WEBM", "MOV", "MKV"];
const navigationTargets = ["como-funciona", "formatos", "uso-responsavel", "faq"];

const translations = {
  pt: {
    nav: ["Como funciona", "Formatos", "Uso responsável", "Perguntas frequentes"],
    start: "Começar",
    theme: "Alternar tema",
    language: "Mudar para inglês",
    eyebrow: "DOWNLOAD DE VÍDEOS E PLAYLISTS",
    hero: "Baixe vídeos e playlists do YouTube",
    heroAccent: " em Full HD.",
    heroText:
      "Cole o link uma vez. A Baixaboo identifica automaticamente se é um vídeo ou uma playlist e prepara o download.",
    downloadPlaceholder: "Cole o link do vídeo ou da playlist",
    secondaryLabel: "OUTRAS FERRAMENTAS",
    secondaryTitle: "Extraia e converta seus próprios arquivos.",
    secondaryText:
      "Ferramentas secundárias para remover áudio ou mudar o formato de arquivos do seu dispositivo.",
    tabs: [
      ["Baixar", "Vídeo ou playlist"],
      ["Extrair", "Áudio ou vídeo"],
      ["Converter", "Áudio ou vídeo"],
    ],
    videoOption: "Vídeo único",
    playlistOption: "Playlist completa",
    audioFromVideoOption: "Áudio do vídeo",
    videoWithoutAudioOption: "Vídeo sem áudio",
    audioFileOption: "Arquivo de áudio",
    videoFileOption: "Arquivo de vídeo",
    downloadTitle: "Baixe seu vídeo",
    downloadText: "É só colar o link. A gente busca a melhor qualidade até Full HD com áudio.",
    playlistTitle: "Baixe a playlist completa",
    playlistText: "Cole o link da playlist para preparar todos os vídeos em até Full HD.",
    link: "Link do vídeo",
    playlistLink: "Link da playlist",
    best: "Full HD 1080p",
    playlistBest: "Playlist completa",
    direct: "O download usa a melhor opção disponível até Full HD 1080p.",
    playlistDirect: "Todos os vídeos da playlist serão preparados com áudio em até Full HD 1080p.",
    extractTitle: "Extraia o áudio de um vídeo",
    extractText: "Envie seu vídeo e extraia o áudio na melhor qualidade disponível.",
    convertTitle: "Converta o formato do áudio",
    convertText: "Troque a extensão do arquivo preservando a melhor qualidade possível.",
    extractVideoTitle: "Extraia somente o vídeo",
    extractVideoText: "Remova a faixa de áudio e salve apenas a imagem do arquivo original.",
    convertVideoTitle: "Converta o formato do vídeo",
    convertVideoText:
      "Envie seu arquivo, escolha o formato e preserve a melhor qualidade possível.",
    uploadVideo: "Arraste seu vídeo ou clique para escolher",
    uploadAudio: "Arraste seu áudio ou clique para escolher",
    changeFile: "Clique para trocar",
    lockedFile: "Arquivo bloqueado durante o processamento",
    videoFormats: "MP4, MOV, MKV ou WEBM",
    audioFileFormats: "MP3, M4A, WAV, FLAC, AAC ou OGG",
    output: "Formato de saída",
    authorize:
      "Confirmo que tenho direito ou autorização para usar este conteúdo e que o uso será pessoal e não comercial.",
    working: "Preparando arquivo...",
    downloading: "Baixando arquivo...",
    done: "Arquivo pronto",
    error: "Não foi possível processar o arquivo. Verifique a mídia e tente novamente.",
    invalidUrl: "Informe um link público válido começando com http:// ou https://.",
    youtubeUrlWarning:
      "Link não reconhecido. Use youtube.com/watch, youtu.be ou youtube.com/playlist.",
    singleVideoRequired:
      "Este campo aceita somente links de vídeos individuais. Use a opção Playlist completa para esse link.",
    playlistRequired:
      "Este campo aceita somente links de playlists do YouTube com o parâmetro list.",
    downloadCta: "Baixar agora",
    downloadPlaylistCta: "Baixar playlist completa",
    extractCta: "Extrair áudio em",
    convertCta: "Converter para",
    extractVideoCta: "Extrair vídeo em",
    convertVideoCta: "Converter vídeo para",
    legalA: "Ao continuar, você concorda com os",
    terms: "Termos de Uso",
    legalB: "e assume a responsabilidade pelo conteúdo processado.",
    trust: [
      ["Processamento seguro", "Seus arquivos não ficam armazenados"],
      ["Sem etapas desnecessárias", "Cada ferramenta tem um fluxo direto"],
      ["Uso responsável", "Você mantém o controle do conteúdo"],
    ],
    how: "COMO FUNCIONA",
    howTitle: "Escolha o que precisa e resolva em três passos.",
    steps: [
      ["Escolha a ferramenta", "Selecione baixar, extrair ou converter."],
      ["Adicione sua mídia", "Cole o link ou escolha um arquivo do dispositivo."],
      ["Receba o resultado", "Baixe a melhor qualidade ou o formato escolhido."],
    ],
    formats: "FORMATOS COMPATÍVEIS",
    formatsTitle: "Os formatos mais usados, sem complicação.",
    formatsText:
      "Baixe vídeos em até Full HD, remova a faixa de áudio ou converta arquivos para formatos compatíveis com celulares, computadores, players e editores.",
    solutionsLabel: "RECURSOS",
    solutionsTitle: "Ferramentas online para cada etapa do seu arquivo de mídia.",
    solutions: [
      [
        "Baixar vídeos online",
        "Cole um link público e prepare um arquivo com vídeo e áudio na melhor opção disponível até Full HD 1080p.",
      ],
      [
        "Baixar playlists",
        "Envie o link de uma playlist para receber os vídeos organizados em um único arquivo ZIP.",
      ],
      [
        "Extrair áudio de vídeo",
        "Transforme a faixa de áudio em MP3, M4A, WAV, FLAC, AAC ou OGG sem instalar programas.",
      ],
      [
        "Converter áudio e vídeo",
        "Converta seus próprios arquivos entre MP4, WebM, MOV, MKV e os formatos de áudio mais usados.",
      ],
    ],
    responsibleTitle: "Você decide o que processar. A responsabilidade pelo conteúdo é sua.",
    responsibleText:
      "Use a Baixaboo apenas com conteúdo próprio, licenciado, em domínio público ou para o qual você tenha autorização. Não use a ferramenta para redistribuição ou finalidade comercial.",
    guidelines: "Ver diretrizes",
    faqLabel: "PERGUNTAS FREQUENTES",
    faqTitle: "Dúvidas sobre download, extração e conversão de mídia.",
    faqs: [
      [
        "Como baixar um vídeo online?",
        "Cole o link público do vídeo ou da playlist e clique em baixar. A Baixaboo identifica o tipo de link, prepara o arquivo e o libera pelo navegador.",
      ],
      [
        "Qual é a qualidade máxima do vídeo?",
        "A Baixaboo procura a melhor opção disponível até Full HD 1080p com áudio. A resolução final também depende da qualidade oferecida pela fonte.",
      ],
      [
        "Preciso instalar um programa ou criar uma conta?",
        "Não. As ferramentas funcionam diretamente em um navegador moderno e não exigem instalação nem cadastro.",
      ],
      [
        "Quais formatos de áudio e vídeo são aceitos?",
        "Você pode trabalhar com MP3, M4A, WAV, FLAC, AAC e OGG para áudio, além de MP4, WebM, MOV e MKV para vídeo.",
      ],
      [
        "Os arquivos enviados ficam armazenados?",
        "Não mantemos uma biblioteca dos seus arquivos. Eles são usados temporariamente para concluir a tarefa e removidos automaticamente pelo serviço.",
      ],
      [
        "Posso baixar qualquer conteúdo?",
        "Use somente conteúdo próprio, em domínio público, licenciado para download ou autorizado pelo titular. Você é responsável por respeitar direitos autorais e os termos da fonte.",
      ],
    ],
    footerText: "Ferramentas simples para trabalhar com sua própria mídia.",
    privacy: "Privacidade",
    copyright: "Direitos Autorais",
    footerLegal: "Serviço independente, sem vínculo com YouTube ou Google.",
  },
  en: {
    nav: ["How it works", "Formats", "Responsible use", "Frequently asked questions"],
    start: "Get started",
    theme: "Toggle theme",
    language: "Mudar para português",
    eyebrow: "VIDEO AND PLAYLIST DOWNLOADS",
    hero: "Download YouTube videos and playlists",
    heroAccent: " in Full HD.",
    heroText:
      "Paste the link once. Baixaboo automatically detects whether it is a video or playlist and prepares the download.",
    downloadPlaceholder: "Paste the video or playlist link",
    secondaryLabel: "OTHER TOOLS",
    secondaryTitle: "Extract and convert your own files.",
    secondaryText:
      "Secondary tools for removing audio or changing the format of files on your device.",
    tabs: [
      ["Download", "Video or playlist"],
      ["Extract", "Audio or video"],
      ["Convert", "Audio or video"],
    ],
    videoOption: "Single video",
    playlistOption: "Full playlist",
    audioFromVideoOption: "Audio from video",
    videoWithoutAudioOption: "Video without audio",
    audioFileOption: "Audio file",
    videoFileOption: "Video file",
    downloadTitle: "Download your video",
    downloadText:
      "Just paste the link. We fetch the best available quality up to Full HD with audio.",
    playlistTitle: "Download the full playlist",
    playlistText: "Paste the playlist link to prepare every video in up to Full HD.",
    link: "Video link",
    playlistLink: "Playlist link",
    best: "Full HD 1080p",
    playlistBest: "Full playlist",
    direct: "The download uses the best available option up to Full HD 1080p.",
    playlistDirect:
      "Every video in the playlist will be prepared with audio in up to Full HD 1080p.",
    extractTitle: "Extract audio from a video",
    extractText: "Upload your video and extract its audio in the best available quality.",
    convertTitle: "Convert an audio file",
    convertText: "Change the file format while preserving the best possible quality.",
    extractVideoTitle: "Extract the video track",
    extractVideoText:
      "Remove the audio track and save only the visual stream from the original file.",
    convertVideoTitle: "Convert a video file",
    convertVideoText: "Upload your file, choose a format and preserve the best possible quality.",
    uploadVideo: "Drop your video or click to choose",
    uploadAudio: "Drop your audio or click to choose",
    changeFile: "Click to replace",
    lockedFile: "File locked while processing",
    videoFormats: "MP4, MOV, MKV or WEBM",
    audioFileFormats: "MP3, M4A, WAV, FLAC, AAC or OGG",
    output: "Output format",
    authorize:
      "I confirm that I own or have permission to use this content and that my use will be personal and non-commercial.",
    working: "Preparing file...",
    downloading: "Downloading file...",
    done: "File ready",
    error: "The file could not be processed. Check the media and try again.",
    invalidUrl: "Enter a valid public link beginning with http:// or https://.",
    youtubeUrlWarning:
      "Link not recognized. Use youtube.com/watch, youtu.be, or youtube.com/playlist.",
    singleVideoRequired:
      "This field only accepts individual video links. Use Full playlist for this link.",
    playlistRequired:
      "This field only accepts YouTube playlist links containing the list parameter.",
    downloadCta: "Download now",
    downloadPlaylistCta: "Download full playlist",
    extractCta: "Extract audio as",
    convertCta: "Convert to",
    extractVideoCta: "Extract video as",
    convertVideoCta: "Convert video to",
    legalA: "By continuing, you agree to the",
    terms: "Terms of Use",
    legalB: "and accept responsibility for the processed content.",
    trust: [
      ["Secure processing", "Your files are not kept"],
      ["No unnecessary steps", "Every tool has a direct flow"],
      ["Responsible use", "You stay in control of the content"],
    ],
    how: "HOW IT WORKS",
    howTitle: "Choose what you need and finish in three steps.",
    steps: [
      ["Choose a tool", "Select download, extract or convert."],
      ["Add your media", "Paste a link or choose a file from your device."],
      ["Get the result", "Download the best quality or your chosen format."],
    ],
    formats: "SUPPORTED FORMATS",
    formatsTitle: "The formats you use most, without the hassle.",
    formatsText:
      "Download videos in up to Full HD, remove audio tracks, or convert files to formats compatible with phones, computers, players, and editors.",
    solutionsLabel: "FEATURES",
    solutionsTitle: "Online tools for every step of your media workflow.",
    solutions: [
      [
        "Download videos online",
        "Paste a public link and prepare a video with audio in the best available option up to Full HD 1080p.",
      ],
      [
        "Download playlists",
        "Submit a playlist link to receive the videos organized in a single ZIP archive.",
      ],
      [
        "Extract audio from video",
        "Turn an audio track into MP3, M4A, WAV, FLAC, AAC, or OGG without installing software.",
      ],
      [
        "Convert audio and video",
        "Convert your own files between MP4, WebM, MOV, MKV, and widely used audio formats.",
      ],
    ],
    responsibleTitle: "You decide what to process. You are responsible for the content.",
    responsibleText:
      "Use Baixaboo only with your own, licensed, public-domain or otherwise authorized content. Do not use the tool for redistribution or commercial purposes.",
    guidelines: "View guidelines",
    faqLabel: "FREQUENTLY ASKED QUESTIONS",
    faqTitle: "Questions about downloading, extracting, and converting media.",
    faqs: [
      [
        "How do I download an online video?",
        "Paste the public video or playlist link and click download. Baixaboo detects the link type, prepares the file, and releases it through your browser.",
      ],
      [
        "What is the maximum video quality?",
        "Baixaboo looks for the best available option up to Full HD 1080p with audio. The final resolution also depends on the quality provided by the source.",
      ],
      [
        "Do I need to install software or create an account?",
        "No. The tools work directly in a modern browser and require no installation or registration.",
      ],
      [
        "Which audio and video formats are supported?",
        "You can work with MP3, M4A, WAV, FLAC, AAC, and OGG for audio, plus MP4, WebM, MOV, and MKV for video.",
      ],
      [
        "Are uploaded files stored?",
        "We do not keep a library of your files. They are used temporarily to complete the task and are automatically removed by the service.",
      ],
      [
        "Can I download any content?",
        "Only use your own content, public-domain material, content licensed for download, or content authorized by its owner. You are responsible for respecting copyright and source terms.",
      ],
    ],
    footerText: "Simple tools for working with your own media.",
    privacy: "Privacy",
    copyright: "Copyright",
    footerLegal: "Independent service, not affiliated with YouTube or Google.",
  },
} as const;

function Brand() {
  return (
    <a className="brand" href="#topo" aria-label="Baixaboo — página inicial">
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
  locale,
  disabled = false,
}: {
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
  kind: "video" | "audio";
  locale: Locale;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    if (disabled) {
      event.currentTarget.value = "";
      return;
    }
    onFile(event.target.files?.[0] ?? null);
  }

  const c = translations[locale];

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
              {(file.size / 1024 / 1024).toFixed(1)} MB · {disabled ? c.lockedFile : c.changeFile}
            </small>
          </span>
        ) : (
          <span className="dropzone-copy">
            <strong>{kind === "video" ? c.uploadVideo : c.uploadAudio}</strong>
            <small>{kind === "video" ? c.videoFormats : c.audioFileFormats}</small>
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
  const restoredDownload = useRef(false);
  const currentLocale = useLocale();
  const locale: Locale = currentLocale === "en" ? "en" : "pt";
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const c = translations[locale];
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
          <nav className="desktop-nav" aria-label="Navegação principal">
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
          </div>
        </div>
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
  locale,
  disabled = false,
}: {
  kind: "audio" | "video";
  format: string;
  setFormat: (format: string) => void;
  locale: Locale;
  disabled?: boolean;
}) {
  const c = translations[locale];
  const formats = kind === "audio" ? audioFormats : videoFormats;
  return (
    <div className="format-controls">
      <div>
        <Label className="field-label">{c.output}</Label>
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
