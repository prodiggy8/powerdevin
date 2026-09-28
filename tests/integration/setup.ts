import { afterAll, beforeEach } from "vitest";

import { closeTestDb, truncateAll } from "./db";

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeTestDb();
});
