"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import { Logo } from "./Logo";
import { Button } from "@/shared/components/ui/button";

const LINKS: ReadonlyArray<{ key: string; to: string; hash?: string }> = [
  { key: "links.home", to: "/" },
  { key: "links.about", to: "/about" },
  { key: "links.formats", to: "/", hash: "formatos" },
  { key: "links.howItWorks", to: "/", hash: "como-funciona" },
  { key: "links.terms", to: "/terms" },
  { key: "links.privacy", to: "/privacy" },
  { key: "links.copyright", to: "/copyright" },
  { key: "links.removal", to: "/contact", hash: "copyright" },
  { key: "links.contact", to: "/contact" },
];

export function Footer() {
  const t = useTranslations("Footer");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(nextLocale: "pt" | "en") {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <footer className="border-border/70 bg-surface/60 mt-20 border-t">
      <div className="mx-auto w-full max-w-365 px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="min-w-0">
            <Logo withSlogan />
            <p className="text-muted-foreground mt-4 max-w-sm text-sm leading-relaxed">
              {t("description")}
            </p>
          </div>

          <nav aria-label={t("linksLabel")}>
            <ul className="grid grid-cols-2 gap-y-2.5 sm:grid-cols-3">
              {LINKS.map((link) => (
                <li key={link.key + (link.hash ?? "")}>
                  <Link
                    href={link.hash ? `${link.to}#${link.hash}` : link.to}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-border/70 mt-10 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
            {t("independent")}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant={locale === "pt" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => switchLocale("pt")}
            >
              PT-BR
            </Button>
            <Button
              variant={locale === "en" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => switchLocale("en")}
            >
              EN
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          © {new Date().getFullYear()} Baixaboo · {t("legalIdentity")}
        </p>
      </div>
    </footer>
  );
}
