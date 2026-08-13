import type { MetadataRoute } from "next";
import { env } from "@/shared/config/env";
import { routing } from "@/shared/i18n/routing";

const pages = [
  { path: "", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/copyright", changeFrequency: "yearly" as const, priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.flatMap((page) => {
    const languages = {
      "pt-BR": `${env.FRONTEND_URL}/pt${page.path}`,
      en: `${env.FRONTEND_URL}/en${page.path}`,
      "x-default": `${env.FRONTEND_URL}/pt${page.path}`,
    };

    return routing.locales.map((locale) => ({
      url: `${env.FRONTEND_URL}/${locale}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    }));
  });
}
