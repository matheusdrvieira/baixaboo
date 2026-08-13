import { Link2, ShieldCheck, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

export function SupportedSources() {
  const t = useTranslations("Home.Sources");

  return (
    <section id="plataformas" className="mt-6 scroll-mt-24">
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{t("description")}</p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        <li className="border-border/70 bg-muted/40 flex items-center gap-2.5 rounded-xl border p-3">
          <Link2 className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 text-xs font-medium">{t("compatible")}</span>
        </li>
        <li className="border-border/70 bg-muted/40 flex items-center gap-2.5 rounded-xl border p-3">
          <Zap className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 text-xs font-medium">{t("immediate")}</span>
        </li>
        <li className="border-border/70 bg-muted/40 flex items-center gap-2.5 rounded-xl border p-3">
          <ShieldCheck className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 text-xs font-medium">{t("noFiles")}</span>
        </li>
      </ul>

      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{t("notice")}</p>
    </section>
  );
}
