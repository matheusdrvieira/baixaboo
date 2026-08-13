import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/shared/components/baixaboo/LegalPageShell";
import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("PrivacyPage");

  return (
    <LegalPageShell title={t("title")} updatedAt={t("updated")} intro={t("intro")}>
      <LegalSection heading={t("sections.data.title")}>
        <LegalList
          items={Array.from({ length: 4 }, (_, index) => t(`sections.data.items.${index}`))}
        />
      </LegalSection>

      <LegalSection heading={t("sections.purposes.title")}>
        <LegalList
          items={Array.from({ length: 3 }, (_, index) => t(`sections.purposes.items.${index}`))}
        />
      </LegalSection>

      <LegalSection heading={t("sections.retention.title")}>
        <p>{t("sections.retention.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.sharing.title")}>
        <p>{t("sections.sharing.text")}</p>
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
    </LegalPageShell>
  );
}
