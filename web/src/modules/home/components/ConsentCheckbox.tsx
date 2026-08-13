import { Checkbox } from "@/shared/components/ui/checkbox";
import { cn } from "@/shared/lib/utils";
import type { ReactNode } from "react";

/** Checkbox de responsabilidade legal reutilizável, acessível por teclado. */
export function ConsentCheckbox({
  id,
  checked,
  onCheckedChange,
  children,
  className,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted/50 border-border/70 flex items-start gap-3 rounded-xl border p-3.5",
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5 shrink-0"
      />
      <label htmlFor={id} className="text-muted-foreground cursor-pointer text-sm leading-relaxed">
        {children}
      </label>
    </div>
  );
}
