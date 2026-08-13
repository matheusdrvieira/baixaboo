import type { MediaErrorCode } from "./types";

export const ERROR_MESSAGES: Record<MediaErrorCode, { title: string; description: string }> = {
  invalid_url: {
    title: "Link inválido",
    description: "Verifique se o endereço está completo e começa com http:// ou https://.",
  },
  unsupported_source: {
    title: "Fonte não compatível",
    description: "Esta fonte não está entre as compatíveis no momento.",
  },
  unavailable: {
    title: "Conteúdo indisponível",
    description: "O conteúdo pode ter sido removido ou não está acessível publicamente.",
  },
  private_content: {
    title: "Conteúdo privado",
    description: "Conteúdos privados não podem ser processados pela Baixaboo.",
  },
  protected_content: {
    title: "Conteúdo protegido",
    description:
      "O conteúdo possui proteção técnica. A Baixaboo não contorna DRM ou restrições de acesso.",
  },
  unauthorized_content: {
    title: "Conteúdo não autorizado",
    description: "Não identificamos base legal ou autorização para processar este conteúdo.",
  },
  age_restricted: {
    title: "Conteúdo com restrição de idade",
    description: "A fonte exige verificação de idade e o processamento foi interrompido.",
  },
  analysis_failed: {
    title: "Falha na análise",
    description: "Não foi possível ler as informações da mídia. Tente novamente em instantes.",
  },
  conversion_failed: {
    title: "Falha na conversão",
    description: "O processamento foi interrompido. Você pode tentar novamente.",
  },
  file_too_large: {
    title: "Arquivo muito grande",
    description: "O arquivo excede o limite de tamanho permitido para processamento.",
  },
  unsupported_format: {
    title: "Formato incompatível",
    description: "O formato solicitado não é compatível com esta mídia.",
  },
  rate_limited: {
    title: "Limite de requisições",
    description: "Muitas solicitações em pouco tempo. Aguarde alguns instantes.",
  },
  service_unavailable: {
    title: "Serviço temporariamente indisponível",
    description: "O serviço de processamento está indisponível. Tente novamente mais tarde.",
  },
  timeout: {
    title: "Tempo de processamento excedido",
    description: "A tarefa demorou mais que o limite permitido e foi encerrada.",
  },
  captcha_required: {
    title: "Verificação necessária",
    description: "Detectamos comportamento incomum. Conclua a verificação para continuar.",
  },
};

export const STAGE_LABELS: Record<string, string> = {
  queued: "Na fila",
  analyzing: "Analisando mídia",
  preparing: "Preparando arquivo",
  extracting: "Extraindo conteúdo",
  muxing: "Unindo vídeo e áudio",
  converting: "Convertendo formato",
  finalizing: "Finalizando",
  ready: "Pronto para download",
  failed: "Falha no processamento",
  canceled: "Tarefa cancelada",
};
