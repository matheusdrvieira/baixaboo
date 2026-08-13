import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";
import en from "./messages/en.json";
import pt from "./messages/pt.json";
import { routing } from "./routing";

const messages = { pt, en };

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const paramValue = await rootParams.locale();
    if (!hasLocale(routing.locales, paramValue)) {
      notFound();
    }
    locale = paramValue;
  }

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return {
    locale,
    messages: messages[locale],
  };
});
