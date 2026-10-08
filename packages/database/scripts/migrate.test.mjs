import { test } from "vitest";
import assert from "node:assert/strict";
import { migrate, migrationDatabaseUrl } from "./migrate.mjs";
const pooled = "postgresql://test:password@ep-test-pooler.c-5.eu-central-1.aws.neon.tech/db?sslmode=require&schema=public";
test("Neon migrations use direct endpoint and allow cold starts", () => {
  const url = new URL(migrationDatabaseUrl({ DATABASE_URL: pooled }));
  assert.equal(url.hostname, "ep-test.c-5.eu-central-1.aws.neon.tech");
  assert.equal(url.searchParams.get("connect_timeout"), "30");
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.searchParams.get("schema"), "public");
});
test("explicit direct URL takes precedence; non-Neon URLs are preserved", () => {
  const direct = "postgresql://test:password@localhost:5432/db";
  assert.equal(migrationDatabaseUrl({ DIRECT_URL: direct, DATABASE_URL: pooled }), direct);
  assert.equal(migrationDatabaseUrl({ DATABASE_URL: direct }), direct);
  assert.throws(() => migrationDatabaseUrl({}));
});
test("retry only connectivity failures and preserve final failure", async () => {
  let attempts = 0;
  const waits = [];
  assert.equal(await migrate({ DATABASE_URL: pooled }, () => ({ status: ++attempts === 3 ? 0 : 1, stderr: "Error: P1001" }), async (ms) => waits.push(ms)), 0);
  assert.equal(attempts, 3); assert.deepEqual(waits, [2000, 4000]);
  attempts = 0;
  assert.equal(await migrate({ DATABASE_URL: pooled }, () => { attempts++; return { status: 1, stderr: "P3018 SQL migration failed" }; }, async () => {}), 1);
  assert.equal(attempts, 1);
  attempts = 0;
  assert.equal(await migrate({ DATABASE_URL: pooled }, () => { attempts++; return { status: 1, stderr: "P1001" }; }, async () => {}), 1);
  assert.equal(attempts, 3);
});
