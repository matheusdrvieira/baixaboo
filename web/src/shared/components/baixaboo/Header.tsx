"use client";

import { Globe, Moon, Sun, Menu } from "lucide-react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "@/shared/contexts/theme";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import { Logo } from "./Logo";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";

const NAV = [
  { key: "nav.home", hash: "topo" },
  { key: "nav.howItWorks", hash: "como-funciona" },
  { key: "nav.formats", hash: "formatos" },
  { key: "nav.platforms", hash: "plataformas" },
  { key: "nav.faq", hash: "faq" },
] as const;

export function Header() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const onHome = pathname === "/";

  function switchLocale(nextLocale: "pt" | "en") {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <header className="bg-background/85 border-border/70 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-365 items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="min-w-0 shrink-0" aria-label={t("homeLabel")}>
          <Logo />
        </Link>

        <nav
          className="ml-auto hidden items-center gap-1 lg:flex"
          aria-label={t("primaryNavigation")}
        >
          {NAV.map((item) =>
            onHome ? (
              <a
                key={item.hash}
                href={`#${item.hash}`}
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {t(item.key)}
              </a>
            ) : (
              <Link
                key={item.hash}
                href={`/#${item.hash}`}
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {t(item.key)}
              </Link>
            ),
          )}
        </nav>

        <div className={cn("flex items-center gap-1", !onHome && "ml-auto lg:ml-0")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2" aria-label={t("language")}>
                <Globe className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase">{locale}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => switchLocale("pt")}>Português (BR)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchLocale("en")}>English</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label={t("toggleTheme")}
          >
            <Sun className="hidden h-4 w-4 dark:block" />
            <Moon className="h-4 w-4 dark:hidden" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t("openMenu")}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <nav
          className="border-border/70 bg-background border-t px-4 py-3 lg:hidden"
          aria-label={t("mobileNavigation")}
        >
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.hash}>
                <Link
                  href={`/#${item.hash}`}
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground block rounded-lg px-2 py-2 text-sm font-medium"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
