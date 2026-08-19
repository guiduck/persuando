import assert from "node:assert/strict";
import test from "node:test";

import { getMigrationsDir } from "../dist/src/modules/database/test-database.js";
import { MigrationRunner } from "../dist/src/modules/database/migration-runner.js";

test("MigrationRunner loads SQL migrations in sorted order", async () => {
  const runner = new MigrationRunner();
  const migrations = await runner.loadMigrations(getMigrationsDir(process.cwd()));

  assert.equal(migrations[0]?.name, "0001_initial.sql");
  assert.equal(migrations[1]?.name, "0002_user_settings_capture_models.sql");
  assert.match(migrations[0]?.sql ?? "", /CREATE TABLE users/);
});

test("MigrationRunner applies unapplied migrations transactionally", async () => {
  const queries = [];
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (String(sql).startsWith("SELECT name FROM schema_migrations")) return { rows: [] };
      return { rows: [] };
    }
  };

  const runner = new MigrationRunner();
  const applied = await runner.run(client, getMigrationsDir(process.cwd()));

  assert.deepEqual(applied, ["0001_initial.sql", "0002_user_settings_capture_models.sql"]);
  assert.ok(queries.some((query) => query.sql === "BEGIN"));
  assert.ok(queries.some((query) => query.sql === "COMMIT"));
  assert.ok(queries.some((query) => String(query.sql).includes("INSERT INTO schema_migrations")));
});
