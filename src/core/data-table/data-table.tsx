"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
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
};

const ALL = "__all__";

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
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.search);

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
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 max-w-xs"
        />
        {filters.map((filter) => (
          <Select
            key={filter.id}
            value={query.filters[filter.id] ?? ALL}
            onValueChange={(value) =>
              pushParams({
                [filter.id]: value === ALL ? undefined : value,
                page: "1",
              })
            }
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All {filter.label.toLowerCase()}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      <div
        className={cn(
          "rounded-md border transition-opacity",
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
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
            size="sm"
            disabled={query.page <= 1 || isPending}
            onClick={() => pushParams({ page: String(query.page - 1) })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page >= totalPages || isPending}
            onClick={() => pushParams({ page: String(query.page + 1) })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
