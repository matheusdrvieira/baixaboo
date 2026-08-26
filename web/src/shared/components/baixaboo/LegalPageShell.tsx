"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Languages, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "@/shared/contexts/theme";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import { LogoMark } from "./Logo";

export function LegalPageShell({
  title,
  updatedAt,
  intro,
  eyebrow,
  children,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  const t = useTranslations("LegalShell");
  const currentLocale = useLocale();
  const locale = currentLocale === "en" ? "en" : "pt";
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  function toggleLocale() {
    router.replace(pathname, { locale: locale === "pt" ? "en" : "pt" });
  }

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link className="brand" href="/" aria-label={t("homeLabel")}>
            <LogoMark className="brand-logo-mark" />
            <span>Baixaboo</span>
          </Link>

          <div className="legal-header-actions">
            <button
              className="header-control"
              type="button"
              onClick={toggleLocale}
              aria-label={t("language")}
              title={t("language")}
            >
              <Languages size={17} />
              <span>{locale.toUpperCase()}</span>
            </button>
            <button
              className="header-control icon-only"
              type="button"
              onClick={toggleTheme}
              aria-label={t("theme")}
              title={t("theme")}
            >
              {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link className="back-link" href="/">
              <ArrowLeft size={16} /> {t("back")}
            </Link>
          </div>
        </div>
      </header>

      <main className="legal-layout">
        <aside className="legal-title">
          <span>{eyebrow ?? t("eyebrow")}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <small>{t("lastUpdated", { date: updatedAt })}</small>
        </aside>

        <article className="legal-content">
          {children}
          <footer className="legal-footer">
            <span>© {new Date().getFullYear()} Baixaboo</span>
            <nav aria-label={t("legalLinksLabel")}>
              <Link href="/terms">{t("terms")}</Link>
              <Link href="/privacy">{t("privacy")}</Link>
              <Link href="/copyright">{t("copyright")}</Link>
              <Link href="/about">{t("about")}</Link>
              <Link href="/contact">{t("contact")}</Link>
            </nav>
          </footer>
        </article>
      </main>
    </div>
  );
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id?: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section id={id}>
      <h2>{heading}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
