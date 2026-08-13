import { ShieldCheck, Zap, Layers } from "lucide-react";
import { useTranslations } from "next-intl";

const PILLS = [
  { icon: Zap, key: "pills.immediate" },
  { icon: Layers, key: "pills.original" },
  { icon: ShieldCheck, key: "pills.responsible" },
] as const;

export function Hero() {
  const t = useTranslations("Home.Hero");

  return (
    <section className="pt-10 pb-8 text-center sm:pt-16">
      <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
        {t("title")}
        <span className="text-gradient-brand block">{t("highlight")}</span>
      </h1>
      <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-sm leading-relaxed sm:text-base">
        {t("description")}
      </p>
      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {PILLS.map((pill) => (
          <li
            key={pill.key}
            className="border-border/70 bg-card/70 flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium"
          >
            <pill.icon className="text-primary h-3.5 w-3.5" aria-hidden="true" />
            {t(pill.key)}
          </li>
        ))}
      </ul>
    </section>
  );
}
