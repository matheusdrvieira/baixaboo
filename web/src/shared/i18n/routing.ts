import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt", "en"],
  defaultLocale: "pt",
  localeDetection: true,
  localeCookie: false,
  alternateLinks: false,
});
