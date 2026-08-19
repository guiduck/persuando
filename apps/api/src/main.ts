import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "./modules/config/env-file.js";
import { AppModule } from "./modules/app.module.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { MigrationDatabaseService } from "./modules/database/migration-database.service.js";
import { MigrationRunner } from "./modules/database/migration-runner.js";
import { RealtimeGateway } from "./modules/realtime/realtime.gateway.js";
import { RealtimeService } from "./modules/realtime/realtime.service.js";
import { attachRealtimeWebSocketServer } from "./modules/realtime/realtime-ws-server.js";

export async function bootstrap(): Promise<void> {
  loadLocalEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    credentials: true,
    origin: true
  });

  const database = app.get(MigrationDatabaseService);
  const migrations = app.get(MigrationRunner);
  await migrations.run(database, resolve(dirname(fileURLToPath(import.meta.url)), "../../migrations"));

  attachRealtimeWebSocketServer({
    authService: app.get(AuthService),
    gateway: app.get(RealtimeGateway),
    httpServer: app.getHttpServer(),
    realtimeService: app.get(RealtimeService)
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}

if (process.env.NODE_ENV !== "test" && process.env.PERSUANDO_BOOTSTRAP_API === "true") {
  await bootstrap();
}
