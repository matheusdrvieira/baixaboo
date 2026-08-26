import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/shared/components/baixaboo/LegalPageShell";
import { siteConfig } from "@/shared/config/site";
import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("PrivacyPage");

  return (
    <LegalPageShell title={t("title")} updatedAt={t("updated")} intro={t("intro")}>
      <LegalSection heading={t("sections.data.title")}>
        <LegalList
          items={Array.from({ length: 6 }, (_, index) => t(`sections.data.items.${index}`))}
        />
      </LegalSection>

      <LegalSection heading={t("sections.purposes.title")}>
        <LegalList
          items={Array.from({ length: 5 }, (_, index) => t(`sections.purposes.items.${index}`))}
        />
      </LegalSection>

      <LegalSection heading={t("sections.retention.title")}>
        <p>{t("sections.retention.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.sharing.title")}>
        <p>{t("sections.sharing.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.cookies.title")}>
        <p>{t("sections.cookies.text")}</p>
        <LegalList
          items={Array.from({ length: 4 }, (_, index) => t(`sections.cookies.items.${index}`))}
        />
        <p>
          {t("sections.cookies.choices")}{" "}
          <a href="https://adssettings.google.com/" rel="noreferrer" target="_blank">
            {t("sections.cookies.adsSettings")}
          </a>
          {t("sections.cookies.separator")}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            rel="noreferrer"
            target="_blank"
          >
            {t("sections.cookies.googleData")}
          </a>
          {t("sections.cookies.separator")}
          <a href="https://privacy.microsoft.com/privacystatement" rel="noreferrer" target="_blank">
            {t("sections.cookies.microsoftPrivacy")}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading={t("sections.legalBases.title")}>
        <p>{t("sections.legalBases.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.rights.title")}>
        <LegalList
          items={Array.from({ length: 5 }, (_, index) => t(`sections.rights.items.${index}`))}
        />
        <p>{t("sections.rights.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.security.title")}>
        <p>{t("sections.security.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.transfers.title")}>
        <p>{t("sections.transfers.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.children.title")}>
        <p>{t("sections.children.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.contact.title")}>
        <p>
          {t("sections.contact.text")}{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
