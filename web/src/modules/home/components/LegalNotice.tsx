import { Link } from "@/shared/i18n/navigation";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

/** Aviso legal permanente exibido abaixo do conversor. */
export function LegalNotice() {
  const t = useTranslations("Home.LegalNotice");

  return (
    <section className="surface-card bg-muted/40 mt-8 flex items-start gap-3 p-5">
      <ShieldCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{t("description")}</p>
        <Link
          href="/terms"
          className="text-primary mt-2 inline-block text-sm font-medium hover:underline"
        >
          {t("link")}
        </Link>
      </div>
    </section>
  );
}
