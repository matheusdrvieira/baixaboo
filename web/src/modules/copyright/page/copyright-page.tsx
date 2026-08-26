import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/shared/components/baixaboo/LegalPageShell";
import { siteConfig } from "@/shared/config/site";
import { useTranslations } from "next-intl";

export default function CopyrightPage() {
  const t = useTranslations("CopyrightPage");

  return (
    <LegalPageShell title={t("title")} updatedAt={t("updated")} intro={t("intro")}>
      <LegalSection heading={t("allowedTitle")}>
        <LegalList items={Array.from({ length: 5 }, (_, index) => t(`allowed.${index}`))} />
      </LegalSection>

      <LegalSection heading={t("forbiddenTitle")}>
        <LegalList items={Array.from({ length: 4 }, (_, index) => t(`forbidden.${index}`))} />
      </LegalSection>

      <LegalSection heading={t("noticeTitle")}>
        <p>{t("noticeIntro")}</p>
        <LegalList items={Array.from({ length: 5 }, (_, index) => t(`noticeItems.${index}`))} />
        <p>{t("noticeEnd")}</p>
        <p>
          {t("noticeContact")}{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
