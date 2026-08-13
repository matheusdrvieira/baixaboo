import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import PrivacyPageModule from "@/modules/privacy/page/privacy-page";
import { createLegalPageStructuredData, StructuredData } from "@/shared/components/structured-data";
import { env } from "@/shared/config/env";
import { routing } from "@/shared/i18n/routing";

type PrivacyPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("privacyTitle"),
    description: t("privacyDescription"),
    alternates: {
      canonical: `/${locale}/privacy`,
      languages: {
        "pt-BR": "/pt/privacy",
        en: "/en/privacy",
        "x-default": "/pt/privacy",
      },
    },
    openGraph: {
      type: "website",
      siteName: "Baixaboo",
      locale: t("openGraphLocale"),
      alternateLocale: [t("alternateOpenGraphLocale")],
      url: `/${locale}/privacy`,
      title: t("privacyTitle"),
      description: t("privacyDescription"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("privacyTitle"),
      description: t("privacyDescription"),
    },
  };
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
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
          path: "privacy",
          name: t("privacyTitle"),
          description: t("privacyDescription"),
        })}
      />
      <PrivacyPageModule />
    </>
  );
}
