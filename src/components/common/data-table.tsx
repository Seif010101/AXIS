"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  filterRows,
  nextSort,
  paginate,
  sortRows,
  type SortState,
  type SortValue,
} from "./data-table-logic";

export interface DataTableColumn<T> {
  /** Unique column id (also the sort key). */
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Value to sort by; omit to make the column unsortable. */
  sortValue?: (row: T) => SortValue;
  /** Text matched by the search box; omit to leave the column out of search. */
  searchValue?: (row: T) => string;
  align?: "start" | "center" | "end";
  className?: string;
  /** Shown as the card title on phones (use for the name column). */
  primary?: boolean;
  /** Leave this column out of the phone card layout. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  data: readonly T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Shows the search box when at least one column has `searchValue` (default true). */
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  initialSort?: SortState;
  /** Buttons/menus for one row, rendered in the last column (or the card footer on phones). */
  rowActions?: (row: T) => ReactNode;
  /** Rendered instead of the table when `data` is empty (e.g. an <EmptyState/>). */
  empty?: ReactNode;
  /** Extra controls next to the search box (filters, "create" button). */
  toolbar?: ReactNode;
  /** Accessible table name. */
  caption?: string;
  className?: string;
}

const ALIGN = { start: "text-start", center: "text-center", end: "text-end" } as const;

/**
 * Typed client-side table: search, sort, pagination, row actions. Below `md` every row
 * becomes a card (primary column as the title, the rest as label/value pairs), so pages
 * never scroll sideways on phones. Data is already loaded; for server-side paging build a
 * dedicated list instead.
 *
 * Must be rendered from a client component (columns contain functions).
 *
 * @example
 * <DataTable data={students} getRowId={(s) => s.id} columns={[
 *   { id: "name", header: t("name"), cell: (s) => s.name, sortValue: (s) => s.name, searchValue: (s) => s.name, primary: true },
 *   { id: "stars", header: t("stars"), cell: (s) => s.stars, sortValue: (s) => s.stars, align: "end" },
 * ]} rowActions={(s) => <Button size="sm" asChild><Link href={`/teacher/classes/students/${s.id}`}>{t("open")}</Link></Button>} />
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchable = true,
  searchPlaceholder,
  pageSize = 10,
  initialSort,
  rowActions,
  empty,
  toolbar,
  caption,
  className,
}: DataTableProps<T>) {
  const t = useTranslations("shell.dataTable");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [page, setPage] = useState(1);

  const collator = useMemo(() => new Intl.Collator(locale, { numeric: true, sensitivity: "base" }), [locale]);
  const searchGetters = useMemo(
    () => columns.flatMap((column) => (column.searchValue ? [column.searchValue] : [])),
    [columns],
  );
  const canSearch = searchable && searchGetters.length > 0;

  const visible = useMemo(() => {
    const filtered = canSearch ? filterRows(data, query, searchGetters) : [...data];
    const sortColumn = sort ? columns.find((column) => column.id === sort.id) : undefined;
    const sorted =
      sort && sortColumn?.sortValue ? sortRows(filtered, sortColumn.sortValue, sort.direction, collator) : filtered;
    return paginate(sorted, page, pageSize);
  }, [data, query, searchGetters, canSearch, sort, columns, collator, page, pageSize]);

  if (data.length === 0 && empty) return <>{empty}</>;

  const primary = columns.find((column) => column.primary) ?? columns[0];
  const mobileColumns = columns.filter((column) => column !== primary && !column.hideOnMobile);

  return (
    <div className={cn("space-y-3", className)}>
      {(canSearch || toolbar) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {canSearch && (
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder ?? t("search")}
                aria-label={searchPlaceholder ?? t("search")}
                className="ps-8"
              />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {/* Desktop and tablet: a real table. */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const sorted = sort?.id === column.id ? sort.direction : null;
                return (
                  <TableHead
                    key={column.id}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    className={cn("h-10 text-xs font-medium text-muted-foreground", ALIGN[column.align ?? "start"], column.className)}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSort((current) => nextSort(current, column.id));
                          setPage(1);
                        }}
                        className="-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {column.header}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
              {rowActions && (
                <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.rows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((column) => (
                  <TableCell key={column.id} className={cn("py-3", ALIGN[column.align ?? "start"], column.className)}>
                    {column.cell(row)}
                  </TableCell>
                ))}
                {rowActions && (
                  <TableCell className="py-2 text-end">
                    <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {visible.rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length + (rowActions ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                  {tCommon("states.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Phones: one card per row. */}
      <ul className="space-y-2 md:hidden" aria-label={caption}>
        {visible.rows.map((row) => (
          <li key={getRowId(row)} className="rounded-xl border bg-card p-4 shadow-xs">
            <div className="font-medium">{primary.cell(row)}</div>
            {mobileColumns.length > 0 && (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {mobileColumns.map((column) => (
                  <div key={column.id} className="contents">
                    <dt className="text-muted-foreground">{column.header}</dt>
                    <dd className="min-w-0 text-end break-words">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {rowActions && <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3">{rowActions(row)}</div>}
          </li>
        ))}
        {visible.rows.length === 0 && (
          <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {tCommon("states.noResults")}
          </li>
        )}
      </ul>

      {visible.total > 0 && visible.pageCount > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm text-muted-foreground" aria-label={t("pagination")}>
          <p className="tabular-nums">{t("showing", { from: visible.from, to: visible.to, total: visible.total })}</p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage(visible.page - 1)}
              disabled={visible.page <= 1}
              aria-label={tCommon("actions.previous")}
            >
              <ChevronLeft className="rtl:rotate-180" aria-hidden />
            </Button>
            <span className="min-w-14 text-center tabular-nums" aria-live="polite">
              {t("page", { page: visible.page, pages: visible.pageCount })}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage(visible.page + 1)}
              disabled={visible.page >= visible.pageCount}
              aria-label={tCommon("actions.next")}
            >
              <ChevronRight className="rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
