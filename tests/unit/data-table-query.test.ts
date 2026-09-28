import { describe, expect, it } from "vitest";

import {
  clampPage,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE,
  pageCount,
  parseDataTableQuery,
} from "@/core/data-table/query";

describe("parseDataTableQuery", () => {
  it("falls back to sane defaults", () => {
    expect(parseDataTableQuery({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: undefined,
      order: "desc",
      search: "",
      filters: {},
    });
  });

  it("clamps hostile page values", () => {
    expect(parseDataTableQuery({ page: "-3" }).page).toBe(1);
    expect(parseDataTableQuery({ page: "abc" }).page).toBe(1);
    expect(parseDataTableQuery({ page: "99999999999" }).page).toBe(MAX_PAGE);
  });

  it("only accepts whitelisted page sizes", () => {
    expect(parseDataTableQuery({ pageSize: "50" }).pageSize).toBe(50);
    expect(parseDataTableQuery({ pageSize: "5000" }).pageSize).toBe(
      DEFAULT_PAGE_SIZE,
    );
  });

  it("ignores sort columns the server cannot sort by", () => {
    const options = { sortableColumns: ["email"] };
    expect(parseDataTableQuery({ sort: "email" }, options).sort).toBe("email");
    expect(parseDataTableQuery({ sort: "password" }, options).sort).toBe(
      undefined,
    );
  });

  it("keeps only declared filter columns and trims the search", () => {
    const query = parseDataTableQuery(
      { role: "admin", secret: "x", search: "  ada  " },
      { filterColumns: ["role"] },
    );
    expect(query.filters).toEqual({ role: "admin" });
    expect(query.search).toBe("ada");
  });

  it("takes the first value of repeated params", () => {
    expect(parseDataTableQuery({ page: ["3", "9"] }).page).toBe(3);
  });
});

describe("clampPage", () => {
  it("pulls a page beyond the last one back into range", () => {
    const query = parseDataTableQuery({ page: "500", pageSize: "10" });
    expect(clampPage(query, 25).page).toBe(3);
  });

  it("leaves a valid page untouched", () => {
    const query = parseDataTableQuery({ page: "2", pageSize: "10" });
    expect(clampPage(query, 25)).toBe(query);
  });

  it("keeps page 1 when there are no rows", () => {
    const query = parseDataTableQuery({ page: "4" });
    expect(clampPage(query, 0).page).toBe(1);
    expect(pageCount(0, 20)).toBe(1);
  });
});
