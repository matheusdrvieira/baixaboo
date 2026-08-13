import { AudioLines, Info } from "lucide-react";
import type { AudioOption } from "@/shared/lib/media/types";
import { Button } from "@/shared/components/ui/button";
import { useTranslations } from "next-intl";

export interface AudioSelection {
  option: AudioOption;
}

export function AudioOptions({
  options,
  onSubmit,
}: {
  options: AudioOption[];
  durationSeconds: number;
  onSubmit: (selection: AudioSelection) => void;
}) {
  const t = useTranslations("Home.AudioOptions");
  const option = options[0];
  if (!option) return null;

  return (
    <div className="space-y-5">
      <div className="border-primary/40 bg-gradient-soft rounded-xl border p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AudioLines className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("best")}
        </div>
        <p className="text-muted-foreground mt-1.5 text-sm">{t("original")}</p>
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
