import { Link } from "@/shared/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Gauge,
  AudioLines,
  FileVideo2,
  Timer,
  ClipboardPaste,
  SlidersHorizontal,
  Download,
  Check,
  X,
  ScaleIcon,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";

const BENEFITS = [
  {
    icon: Gauge,
    key: "quality",
  },
  {
    icon: AudioLines,
    key: "audio",
  },
  {
    icon: FileVideo2,
    key: "formats",
  },
  {
    icon: Timer,
    key: "temporary",
  },
] as const;

export function Benefits() {
  const t = useTranslations("Home.Benefits");

  return (
    <section id="formatos" className="mt-16 scroll-mt-24">
      <h2 className="text-xl font-bold sm:text-2xl">{t("title")}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {BENEFITS.map((item) => (
          <article key={item.key} className="surface-card p-5">
            <span className="bg-gradient-soft text-primary flex h-10 w-10 items-center justify-center rounded-xl">
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-3.5 text-sm font-semibold">{t(`items.${item.key}.title`)}</h3>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              {t(`items.${item.key}.text`)}
            </p>
          </article>
        ))}
      </div>

      <div className="surface-card mt-4 p-5">
        <h3 className="text-sm font-semibold">{t("supported")}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-wide uppercase">
              {t("video")}
            </p>
            <p className="mt-1.5 text-sm">MP4 · WebM · MKV · MOV</p>
            <p className="text-muted-foreground mt-1 text-xs">{t("videoDescription")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-wide uppercase">
              {t("audio")}
            </p>
            <p className="mt-1.5 text-sm">MP3 · M4A · AAC · WAV · FLAC · OGG · OPUS</p>
            <p className="text-muted-foreground mt-1 text-xs">{t("audioDescription")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: ClipboardPaste,
    key: "link",
  },
  {
    icon: SlidersHorizontal,
    key: "format",
  },
  {
    icon: Download,
    key: "download",
  },
] as const;

export function HowItWorks() {
  const t = useTranslations("Home.HowItWorks");

  return (
    <section id="como-funciona" className="mt-16 scroll-mt-24">
      <h2 className="text-xl font-bold sm:text-2xl">{t("title")}</h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.key} className="surface-card p-5">
            <div className="flex items-center gap-2.5">
              <span className="bg-gradient-brand text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
                {index + 1}
              </span>
              <step.icon className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
            </div>
            <h3 className="mt-3.5 text-sm font-semibold">{t(`steps.${step.key}.title`)}</h3>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              {t(`steps.${step.key}.text`)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ResponsibleUse() {
  const t = useTranslations("Home.Responsible");
  const allowed = Array.from({ length: 6 }, (_, index) => t(`allowed.${index}`));
  const forbidden = Array.from({ length: 11 }, (_, index) => t(`forbidden.${index}`));

  return (
    <section id="responsabilidade" className="mt-16 scroll-mt-24">
      <div className="bg-gradient-soft border-border/70 rounded-2xl border p-6 sm:p-8">
        <span className="bg-gradient-brand text-primary-foreground flex h-10 w-10 items-center justify-center rounded-xl">
          <ScaleIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-xl font-bold sm:text-2xl">{t("title")}</h2>
        <p className="text-muted-foreground mt-2.5 max-w-2xl text-sm leading-relaxed">
          {t("description")}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">{t("allowedTitle")}</h3>
            <ul className="mt-3 space-y-2">
              {allowed.map((item) => (
                <li key={item} className="text-muted-foreground flex gap-2 text-sm">
                  <Check className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">{t("forbiddenTitle")}</h3>
            <ul className="mt-3 space-y-2">
              {forbidden.map((item) => (
                <li key={item} className="text-muted-foreground flex gap-2 text-sm">
                  <X className="text-destructive mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Button asChild variant="outline" className="mt-6">
          <Link href="/copyright">{t("guidelines")}</Link>
        </Button>
      </div>
    </section>
  );
}

export function Faq() {
  const t = useTranslations("Home.Faq");
  const items = Array.from({ length: 9 }, (_, index) => ({
    question: t(`items.${index}.question`),
    answer: t(`items.${index}.answer`),
  }));

  return (
    <section id="faq" className="mt-16 scroll-mt-24">
      <h2 className="text-xl font-bold sm:text-2xl">{t("title")}</h2>
      <Accordion type="single" collapsible className="surface-card mt-5 px-5">
        {items.map((item, index) => (
          <AccordionItem key={item.question} value={`faq-${index}`}>
            <AccordionTrigger className="text-left text-sm font-semibold">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
