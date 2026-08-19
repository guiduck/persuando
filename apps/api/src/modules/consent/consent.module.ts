import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ConsentController } from "./consent.controller.js";
import { ConsentService } from "./consent.service.js";

@Module({
  imports: [AuditModule, AuthModule, DatabaseModule],
  controllers: [ConsentController],
  providers: [ConsentService],
  exports: [ConsentService]
})
export class ConsentModule {}
