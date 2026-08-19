import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AppModule } from "./modules/app.module.js";
import { loadLocalEnv } from "./modules/config/env-file.js";
import { MigrationDatabaseService } from "./modules/database/migration-database.service.js";
import { MigrationRunner } from "./modules/database/migration-runner.js";
import { JobWorkerFactoryService } from "./modules/jobs/job-worker-factory.service.js";

export async function bootstrapWorker(): Promise<void> {
  loadLocalEnv();
  const app = await NestFactory.createApplicationContext(AppModule);
  const database = app.get(MigrationDatabaseService);
  const migrations = app.get(MigrationRunner);
  await migrations.run(database, resolve(dirname(fileURLToPath(import.meta.url)), "../../migrations"));

  app.get(JobWorkerFactoryService).createWorkers();
}

if (process.env.NODE_ENV !== "test" && process.env.PERSUANDO_BOOTSTRAP_WORKER === "true") {
  await bootstrapWorker();
}
