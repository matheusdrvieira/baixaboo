import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/shared/components/baixaboo/LegalPageShell";
import { siteConfig } from "@/shared/config/site";
import { useTranslations } from "next-intl";

export default function ContactPage() {
  const t = useTranslations("ContactPage");

  return (
    <LegalPageShell
      title={t("title")}
      updatedAt={t("updated")}
      intro={t("intro")}
      eyebrow={t("eyebrow")}
    >
      <LegalSection heading={t("sections.general.title")}>
        <p>
          {t("sections.general.text")}{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection id="copyright" heading={t("sections.copyright.title")}>
        <p>{t("sections.copyright.text")}</p>
        <LegalList
          items={Array.from({ length: 5 }, (_, index) => t(`sections.copyright.items.${index}`))}
        />
        <p>
          {t("sections.copyright.sendTo")}{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection heading={t("sections.privacy.title")}>
        <p>
          {t("sections.privacy.text")}{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection heading={t("sections.response.title")}>
        <p>{t("sections.response.text")}</p>
      </LegalSection>
    </LegalPageShell>
  );
}
