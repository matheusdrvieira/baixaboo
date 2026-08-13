import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import TermsPageModule from "@/modules/terms/page/terms-page";
import { createLegalPageStructuredData, StructuredData } from "@/shared/components/structured-data";
import { env } from "@/shared/config/env";
import { routing } from "@/shared/i18n/routing";

type TermsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("termsTitle"),
    description: t("termsDescription"),
    alternates: {
      canonical: `/${locale}/terms`,
      languages: {
        "pt-BR": "/pt/terms",
        en: "/en/terms",
        "x-default": "/pt/terms",
      },
    },
    openGraph: {
      type: "website",
      siteName: "Baixaboo",
      locale: t("openGraphLocale"),
      alternateLocale: [t("alternateOpenGraphLocale")],
      url: `/${locale}/terms`,
      title: t("termsTitle"),
      description: t("termsDescription"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("termsTitle"),
      description: t("termsDescription"),
    },
  };
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });

  return (
    <>
      <StructuredData
        data={createLegalPageStructuredData({
          frontendUrl: env.FRONTEND_URL,
          locale,
          language: t("languageTag"),
          homeName: t("homeLabel"),
          path: "terms",
          name: t("termsTitle"),
          description: t("termsDescription"),
        })}
      />
      <TermsPageModule />
    </>
  );
}
