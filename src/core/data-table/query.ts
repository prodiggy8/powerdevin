export type SortOrder = "asc" | "desc";

export type DataTableQuery = {
  page: number;
  pageSize: number;
  sort?: string;
  order: SortOrder;
  search: string;
  filters: Record<string, string>;
};

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses the URL search params the DataTable writes back into a query the
 * server can turn into limit/offset/order-by/where clauses.
 */
export function parseDataTableQuery(
  params: RawSearchParams,
  options: { sortableColumns?: string[]; filterColumns?: string[] } = {},
): DataTableQuery {
  const page = Math.max(1, Number.parseInt(first(params.page) ?? "1", 10) || 1);
  const rawPageSize =
    Number.parseInt(first(params.pageSize) ?? "", 10) || DEFAULT_PAGE_SIZE;
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize)
    ? rawPageSize
    : DEFAULT_PAGE_SIZE;

  const requestedSort = first(params.sort);
  const sort =
    requestedSort && options.sortableColumns?.includes(requestedSort)
      ? requestedSort
      : undefined;

  const order: SortOrder = first(params.order) === "asc" ? "asc" : "desc";

  const filters: Record<string, string> = {};
  for (const column of options.filterColumns ?? []) {
    const value = first(params[column]);
    if (value) filters[column] = value;
  }

  return {
    page,
    pageSize,
    sort,
    order,
    search: first(params.search)?.trim() ?? "",
    filters,
  };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
