import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { ConsentCheckbox } from "./ConsentCheckbox";

export function ConfirmDownloadDialog({
  open,
  onOpenChange,
  onConfirm,
  summary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  summary: string;
}) {
  const t = useTranslations("Home.Confirm");
  const common = useTranslations("Common");
  const [accepted, setAccepted] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setAccepted(false);
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <p className="bg-muted/60 text-muted-foreground rounded-xl p-3 text-sm">{summary}</p>

        <ConsentCheckbox id="confirm-download" checked={accepted} onCheckedChange={setAccepted}>
          {t("consent")}
        </ConsentCheckbox>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {common("cancel")}
          </Button>
          <Button
            disabled={!accepted}
            onClick={() => {
              setAccepted(false);
              onConfirm();
            }}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
