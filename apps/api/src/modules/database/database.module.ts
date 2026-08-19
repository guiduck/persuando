import { Module } from "@nestjs/common";

import { ApiConfigModule } from "../config/config.module.js";
import { DatabaseService } from "./database.service.js";
import { MigrationDatabaseService } from "./migration-database.service.js";
import { MigrationRunner } from "./migration-runner.js";

@Module({
  imports: [ApiConfigModule],
  providers: [DatabaseService, MigrationDatabaseService, MigrationRunner],
  exports: [DatabaseService, MigrationDatabaseService, MigrationRunner]
})
export class DatabaseModule {}
