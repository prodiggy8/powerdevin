import { describe, expect, it } from "vitest";

import { assertTestDatabase } from "../integration/env";

describe("assertTestDatabase", () => {
  it("accepts a database whose name ends in _test", () => {
    expect(() =>
      assertTestDatabase("postgres://u:p@localhost:5432/powerdevin_test"),
    ).not.toThrow();
  });

  it("refuses any other database name", () => {
    for (const url of [
      "postgres://u:p@localhost:5432/powerdevin",
      "postgres://u:p@localhost:5432/powerdevin_test_old",
      "postgres://u:p@localhost:5432/test",
      "postgres://u:p@localhost:5432/",
    ]) {
      expect(() => assertTestDatabase(url)).toThrow(/must end in _test/);
    }
  });
});
