"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Search,
  Settings2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DataTableFacetedFilter } from "./faceted-filter";
import { PAGE_SIZE_OPTIONS, type DataTableQuery } from "./query";

export type DataTableFilter = {
  /** Search-param key, also used as the column id. */
  id: string;
  label: string;
  options: { label: string; value: string }[];
};

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Total rows matching the query, before pagination. */
  total: number;
  query: DataTableQuery;
  /** Column ids the server is able to sort by. */
  sortableColumns?: string[];
  filters?: DataTableFilter[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  /** Makes each row a link: clickable, focusable, and opened with Enter. */
  rowHref?: (row: TData) => string;
};

const INTERACTIVE = "a, button, input, select, textarea, [role='checkbox']";

/**
 * Generic table wired for server-side pagination, sorting and filtering: all
 * state lives in the URL and every change re-runs the server component.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  total,
  query,
  sortableColumns = [],
  filters = [],
  searchPlaceholder = "Search…",
  emptyMessage = "No results.",
  emptyDescription,
  rowHref,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.search);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  useEffect(() => setSearch(query.search), [query.search]);

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  const pushParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (search === query.search) return;
    const timer = setTimeout(
      () => pushParams({ search: search || undefined, page: "1" }),
      300,
    );
    return () => clearTimeout(timer);
  }, [search, query.search, pushParams]);

  const toggleSort = (columnId: string) => {
    const order =
      query.sort === columnId && query.order === "asc" ? "desc" : "asc";
    pushParams({ sort: columnId, order, page: "1" });
  };

  const table = useReactTable({
    data,
    columns,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: totalPages,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasActiveFilters =
    Boolean(query.search) ||
    filters.some((filter) => Boolean(query.filters[filter.id]));

  const resetFilters = () => {
    setSearch("");
    pushParams({
      search: undefined,
      page: "1",
      ...Object.fromEntries(filters.map((filter) => [filter.id, undefined])),
    });
  };

  const visibleColumnCount = table.getVisibleLeafColumns().length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 pl-8"
          />
        </div>
        {filters.map((filter) => (
          <DataTableFacetedFilter
            key={filter.id}
            label={filter.label}
            options={filter.options}
            value={query.filters[filter.id]}
            onChange={(value) => pushParams({ [filter.id]: value, page: "1" })}
          />
        ))}
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={resetFilters}
          >
            Reset
            <X className="size-4" />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto h-9">
              <Settings2 className="size-4" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) =>
                    column.toggleVisibility(Boolean(checked))
                  }
                >
                  {typeof column.columnDef.header === "string"
                    ? column.columnDef.header
                    : column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-sm border transition-opacity",
          isPending && "opacity-60",
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  const sortable = sortableColumns.includes(columnId);
                  const active = query.sort === columnId;
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(columnId)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {active ? (
                            query.order === "asc" ? (
                              <ArrowUp className="size-3.5" />
                            ) : (
                              <ArrowDown className="size-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-1 text-center">
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    {emptyDescription ? (
                      <p className="text-sm text-muted-foreground">
                        {emptyDescription}
                      </p>
                    ) : null}
                    {hasActiveFilters ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={resetFilters}
                      >
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const href = rowHref?.(row.original);
                return (
                  <TableRow
                    key={row.id}
                    tabIndex={href ? 0 : undefined}
                    className={
                      href
                        ? "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                        : undefined
                    }
                    onClick={
                      href
                        ? (event) => {
                            const target = event.target as HTMLElement;
                            if (target.closest(INTERACTIVE)) return;
                            router.push(href);
                          }
                        : undefined
                    }
                    onKeyDown={
                      href
                        ? (event) => {
                            if (event.key !== "Enter") return;
                            if (event.target !== event.currentTarget) return;
                            event.preventDefault();
                            router.push(href);
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total} {total === 1 ? "row" : "rows"}
        </span>
        <div className="flex items-center gap-2">
          <Select
            value={String(query.pageSize)}
            onValueChange={(value) => pushParams({ pageSize: value, page: "1" })}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>
            Page {query.page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="First page"
            disabled={query.page <= 1 || isPending}
            onClick={() => pushParams({ page: "1" })}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous page"
            disabled={query.page <= 1 || isPending}
            onClick={() => pushParams({ page: String(query.page - 1) })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next page"
            disabled={query.page >= totalPages || isPending}
            onClick={() => pushParams({ page: String(query.page + 1) })}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Last page"
            disabled={query.page >= totalPages || isPending}
            onClick={() => pushParams({ page: String(totalPages) })}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
