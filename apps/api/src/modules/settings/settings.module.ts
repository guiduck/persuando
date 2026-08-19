import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { CredentialsModule } from "../credentials/credentials.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";

@Module({
  imports: [AuthModule, CredentialsModule, DatabaseModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService]
})
export class SettingsModule {}
