import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import CopyrightPageModule from "@/modules/copyright/page/copyright-page";
import { createLegalPageStructuredData, StructuredData } from "@/shared/components/structured-data";
import { env } from "@/shared/config/env";
import { routing } from "@/shared/i18n/routing";

type CopyrightPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: CopyrightPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("copyrightTitle"),
    description: t("copyrightDescription"),
    alternates: {
      canonical: `/${locale}/copyright`,
      languages: {
        "pt-BR": "/pt/copyright",
        en: "/en/copyright",
        "x-default": "/pt/copyright",
      },
    },
    openGraph: {
      type: "website",
      siteName: "Baixaboo",
      locale: t("openGraphLocale"),
      alternateLocale: [t("alternateOpenGraphLocale")],
      url: `/${locale}/copyright`,
      title: t("copyrightTitle"),
      description: t("copyrightDescription"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("copyrightTitle"),
      description: t("copyrightDescription"),
    },
  };
}

export default async function CopyrightPage({ params }: CopyrightPageProps) {
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
          path: "copyright",
          name: t("copyrightTitle"),
          description: t("copyrightDescription"),
        })}
      />
      <CopyrightPageModule />
    </>
  );
}
