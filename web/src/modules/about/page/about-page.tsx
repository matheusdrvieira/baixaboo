import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/shared/components/baixaboo/LegalPageShell";
import { useTranslations } from "next-intl";

export default function AboutPage() {
  const t = useTranslations("AboutPage");

  return (
    <LegalPageShell
      title={t("title")}
      updatedAt={t("updated")}
      intro={t("intro")}
      eyebrow={t("eyebrow")}
    >
      <LegalSection heading={t("sections.purpose.title")}>
        <p>{t("sections.purpose.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.operation.title")}>
        <p>{t("sections.operation.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.principles.title")}>
        <LegalList
          items={Array.from({ length: 4 }, (_, index) => t(`sections.principles.items.${index}`))}
        />
      </LegalSection>

      <LegalSection heading={t("sections.independence.title")}>
        <p>{t("sections.independence.text")}</p>
      </LegalSection>

      <LegalSection heading={t("sections.funding.title")}>
        <p>{t("sections.funding.text")}</p>
      </LegalSection>
    </LegalPageShell>
  );
}
