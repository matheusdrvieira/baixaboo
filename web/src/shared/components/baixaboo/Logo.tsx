import Image from "next/image";
import { cn } from "@/shared/lib/utils";

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
