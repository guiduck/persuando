import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import { Injectable } from "@nestjs/common";

export interface MigrationClient {
  query(sql: string, values?: readonly unknown[]): Promise<unknown>;
}

export interface AppliedMigration {
  name: string;
  sql: string;
}

@Injectable()
export class MigrationRunner {
  async loadMigrations(migrationsDir: string): Promise<AppliedMigration[]> {
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
    return Promise.all(
      files.map(async (file) => ({
        name: basename(file),
        sql: await readFile(join(migrationsDir, file), "utf8")
      }))
    );
  }

  async run(client: MigrationClient, migrationsDir: string): Promise<string[]> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied: string[] = [];
    for (const migration of await this.loadMigrations(migrationsDir)) {
      const exists = await client.query("SELECT name FROM schema_migrations WHERE name = $1", [migration.name]);
      if (hasRows(exists)) continue;
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migration.name]);
        await client.query("COMMIT");
        applied.push(migration.name);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return applied;
  }
}

function hasRows(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      "rows" in value &&
      Array.isArray((value as { rows: unknown[] }).rows) &&
      (value as { rows: unknown[] }).rows.length > 0
  );
}
