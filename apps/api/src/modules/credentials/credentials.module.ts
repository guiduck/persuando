import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { ApiConfigModule } from "../config/config.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { CredentialsController } from "./credentials.controller.js";
import { CredentialsService } from "./credentials.service.js";

@Module({
  imports: [ApiConfigModule, AuthModule, AuditModule, DatabaseModule],
  controllers: [CredentialsController],
  providers: [CredentialsService],
  exports: [CredentialsService]
})
export class CredentialsModule {}
