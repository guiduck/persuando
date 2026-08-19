import { join } from "node:path";

export function getMigrationsDir(rootDir = process.cwd()): string {
  return join(rootDir, "apps", "api", "migrations");
}

export function createTestDatabaseName(prefix = "persuando_test"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
