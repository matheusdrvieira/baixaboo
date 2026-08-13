import Image from "next/image";
import { cn } from "@/shared/lib/utils";
import { useTranslations } from "next-intl";

/** Marca da Baixaboo: "B" abstrato + seta de download + onda de áudio. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/baixaboo-mark.svg"
      alt=""
      width={48}
      height={48}
      className={cn("rounded-xl", className)}
      aria-hidden="true"
      priority
    />
  );
}

export function Logo({
  className,
  withSlogan = false,
}: {
  className?: string;
  withSlogan?: boolean;
}) {
  const t = useTranslations("Logo");

  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9 shrink-0" />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[1.05rem] font-extrabold tracking-tight">Baixaboo</span>
        {withSlogan && (
          <span className="text-muted-foreground mt-1 text-[0.7rem] font-medium">
            {t("slogan")}
          </span>
        )}
      </span>
    </span>
  );
}
