import { Calendar, Clock, Radio, User, Film, HardDrive, Gauge, Info } from "lucide-react";
import type { MediaAnalysis } from "@/shared/lib/media/types";
import { formatBytes, formatDate, formatDuration } from "@/shared/lib/media/format";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useLocale, useTranslations } from "next-intl";

export function AnalysisSkeleton() {
  const t = useTranslations("Home.Analysis");

  return (
    <div className="mt-6 space-y-4" aria-busy="true" aria-label={t("analyzing")}>
      <div className="flex gap-4">
        <Skeleton className="h-24 w-40 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </div>
  );
}

export function AnalysisSummary({ analysis }: { analysis: MediaAnalysis }) {
  const t = useTranslations("Home.Analysis");
  const common = useTranslations("Common");
  const locale = useLocale();
  const items = [
    { icon: Radio, label: t("source"), value: analysis.source.label },
    { icon: Gauge, label: t("resolution"), value: analysis.bestResolution },
    { icon: HardDrive, label: t("size"), value: formatBytes(analysis.estimatedBytes) },
    { icon: Clock, label: t("duration"), value: formatDuration(analysis.durationSeconds) },
    { icon: Calendar, label: t("published"), value: formatDate(analysis.publishedAt, locale) },
    {
      icon: Film,
      label: t("mediaType"),
      value: analysis.videoOptions.length ? common("video") : common("audio"),
    },
  ];

  return (
    <div className="mt-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="bg-gradient-soft border-border/70 flex aspect-video items-center justify-center rounded-xl border">
          {analysis.thumbnailUrl ? (
            <img
              src={analysis.thumbnailUrl}
              alt={t("thumbnail", { title: analysis.title })}
              loading="lazy"
              className="h-full w-full rounded-xl object-cover"
            />
          ) : (
            <Film className="text-primary/60 h-7 w-7" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{analysis.source.label}</Badge>
          </div>
          <h3 className="mt-2 text-base font-semibold break-words">{analysis.title}</h3>
          {analysis.author && (
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {analysis.author}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="border-border/70 rounded-xl border p-3">
            <dt className="text-muted-foreground flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-wide uppercase">
              <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {item.label}
            </dt>
            <dd className="mt-1 text-sm font-medium break-words">{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-muted-foreground mt-4 flex items-start gap-2 text-xs leading-relaxed">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t("delivery")}
      </p>
    </div>
  );
}
