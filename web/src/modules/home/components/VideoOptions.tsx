import { Film, Info } from "lucide-react";
import type { VideoOption } from "@/shared/lib/media/types";
import { formatBytes } from "@/shared/lib/media/format";
import { Button } from "@/shared/components/ui/button";
import { useTranslations } from "next-intl";

export interface VideoSelection {
  option: VideoOption;
}

export function VideoOptions({
  options,
  onSubmit,
}: {
  options: VideoOption[];
  onSubmit: (selection: VideoSelection) => void;
}) {
  const t = useTranslations("Home.VideoOptions");
  const option = options[0];
  if (!option) return null;

  return (
    <div className="space-y-5">
      <div className="border-primary/40 bg-gradient-soft rounded-xl border p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Film className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("best")}
        </div>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {option.container} · {formatBytes(option.estimatedBytes)}
        </p>
      </div>

      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t("description")}
      </p>

      <Button size="lg" className="w-full" onClick={() => onSubmit({ option })}>
        {t("download")}
      </Button>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 rounded-xl border p-3">
      <dt className="text-muted-foreground text-[0.68rem] font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
    </div>
  );
}
