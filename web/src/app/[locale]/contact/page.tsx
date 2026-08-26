import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import ContactPageModule from "@/modules/contact/page/contact-page";
import { routing } from "@/shared/i18n/routing";

type ContactPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("contactTitle"),
    description: t("contactDescription"),
    alternates: {
      canonical: `/${locale}/contact`,
      languages: { "pt-BR": "/pt/contact", en: "/en/contact", "x-default": "/pt/contact" },
    },
    openGraph: {
      type: "website",
      siteName: "Baixaboo",
      locale: t("openGraphLocale"),
      alternateLocale: [t("alternateOpenGraphLocale")],
      url: `/${locale}/contact`,
      title: t("contactTitle"),
      description: t("contactDescription"),
    },
  };
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <ContactPageModule />;
}
