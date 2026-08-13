import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/shared/components/baixaboo/LegalPageShell";
import { useTranslations } from "next-intl";

export default function TermsPage() {
  const t = useTranslations("TermsPage");

  return (
    <LegalPageShell title={t("title")} updatedAt={t("updated")} intro={t("intro")}>
      <LegalSection heading={t("sections.service.title")}>
        <p>{t("sections.service.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.responsibility.title")}>
        <p>{t("sections.responsibility.text")}</p>
        <LegalList
          items={Array.from({ length: 4 }, (_, index) =>
            t(`sections.responsibility.items.${index}`),
          )}
        />
      </LegalSection>

      <LegalSection heading={t("sections.forbidden.title")}>
        <LegalList
          items={Array.from({ length: 6 }, (_, index) => t(`sections.forbidden.items.${index}`))}
        />
      </LegalSection>

      <LegalSection heading={t("sections.availability.title")}>
        <p>{t("sections.availability.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.liability.title")}>
        <p>{t("sections.liability.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.thirdParties.title")}>
        <p>{t("sections.thirdParties.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.suspension.title")}>
        <p>{t("sections.suspension.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.changes.title")}>
        <p>{t("sections.changes.text")}</p>
      </LegalSection>
    </LegalPageShell>
  );
}
