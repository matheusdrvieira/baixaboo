import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import HomePageModule from "@/modules/home/page/home-page";
import { StructuredData } from "@/shared/components/structured-data";
import { env } from "@/shared/config/env";
import { routing } from "@/shared/i18n/routing";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
      languages: { "pt-BR": "/pt", en: "/en", "x-default": "/pt" },
    },
    openGraph: {
      type: "website",
      siteName: "Baixaboo",
      locale: t("openGraphLocale"),
      alternateLocale: [t("alternateOpenGraphLocale")],
      url: `/${locale}`,
      title: t("title"),
      description: t("description"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });
  const pageUrl = `${env.FRONTEND_URL}/${locale}`;
  const description = t("structuredData.description");
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${env.FRONTEND_URL}/#website`,
        url: env.FRONTEND_URL,
        name: "Baixaboo",
        alternateName: "Baixaboo Media Tools",
        inLanguage: ["pt-BR", "en"],
      },
      {
        "@type": "Organization",
        "@id": `${env.FRONTEND_URL}/#organization`,
        name: "Baixaboo",
        url: env.FRONTEND_URL,
        logo: `${env.FRONTEND_URL}/icon.svg`,
      },
      {
        "@type": "WebApplication",
        "@id": `${pageUrl}/#application`,
        name: "Baixaboo",
        url: pageUrl,
        description,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires a modern web browser with JavaScript enabled.",
        isAccessibleForFree: true,
        inLanguage: t("languageTag"),
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: t("currency"),
        },
        featureList: [
          t("structuredData.features.videoDownload"),
          t("structuredData.features.playlistDownload"),
          t("structuredData.features.audioExtraction"),
          t("structuredData.features.mediaConversion"),
        ],
        publisher: { "@id": `${env.FRONTEND_URL}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}/#webpage`,
        url: pageUrl,
        name: t("structuredData.pageTitle"),
        description,
        isPartOf: { "@id": `${env.FRONTEND_URL}/#website` },
        about: { "@id": `${pageUrl}/#application` },
        inLanguage: t("languageTag"),
      },
    ],
  };

  return (
    <>
      <StructuredData data={structuredData} />
      <HomePageModule />
    </>
  );
}
