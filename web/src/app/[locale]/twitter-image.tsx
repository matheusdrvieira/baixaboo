import { getTranslations } from "next-intl/server";
import { createSocialImage, socialImageSize } from "@/shared/lib/social-image";

export const alt = "Baixaboo";
export const size = socialImageSize;
export const contentType = "image/png";

export default async function TwitterImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.socialImage" });

  return createSocialImage({
    title: t("title"),
    description: t("description"),
  });
}
