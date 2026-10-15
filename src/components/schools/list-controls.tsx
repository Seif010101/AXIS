"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export interface FilterSelect {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Search box and filter selects kept in the URL (?q=&role=…), so lists render on the server
 * and filtered views can be shared or reloaded. Changing a filter returns to page 1.
 */
export function ListFilters({ searchPlaceholder, selects = [] }: { searchPlaceholder?: string; selects?: FilterSelect[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  // Debounced search.
  useEffect(() => {
    if (query === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => update({ q: query.trim() || null }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text drives this
  }, [query]);

  return (
    <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:flex-wrap sm:items-center">
      {searchPlaceholder !== undefined && (
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>{pending ? <Spinner /> : <Search aria-hidden />}</InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            maxLength={100}
          />
        </InputGroup>
      )}
      {selects.map((select) => (
        <Select
          key={select.param}
          value={params.get(select.param) ?? select.options[0]?.value}
          onValueChange={(value) => update({ [select.param]: value === select.options[0]?.value ? null : value })}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label={select.label}>
            <SelectValue placeholder={select.label} />
          </SelectTrigger>
          <SelectContent>
            {select.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}

/** Previous / next links that keep the current filters. */
export function PaginationBar({ page, pageCount }: { page: number; pageCount: number }) {
  const t = useTranslations("schools.pagination");
  const pathname = usePathname();
  const params = useSearchParams();
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const next = new URLSearchParams(params.toString());
    if (target > 1) next.set("page", String(target));
    else next.delete("page");
    return `${pathname}${next.size ? `?${next}` : ""}`;
  };
  return (
    <nav className="flex items-center justify-between gap-2 pt-4" aria-label={t("label")}>
      <Button variant="outline" size="sm" asChild disabled={page <= 1}>
        {page > 1 ? (
          <Link href={href(page - 1)}>
            <ChevronLeft className="rtl:rotate-180" aria-hidden />
            {t("previous")}
          </Link>
        ) : (
          <span aria-disabled>{t("previous")}</span>
        )}
      </Button>
      <span className="text-sm text-muted-foreground">{t("pageOf", { page, count: pageCount })}</span>
      <Button variant="outline" size="sm" asChild disabled={page >= pageCount}>
        {page < pageCount ? (
          <Link href={href(page + 1)}>
            {t("next")}
            <ChevronRight className="rtl:rotate-180" aria-hidden />
          </Link>
        ) : (
          <span aria-disabled>{t("next")}</span>
        )}
      </Button>
    </nav>
  );
}

/** Turns a base64 file returned by an action into a download. */
export function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  downloadBlob(new Blob([bytes], { type: mimeType }), fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
