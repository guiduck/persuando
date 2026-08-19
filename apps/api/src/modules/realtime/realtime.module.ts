import { Module } from "@nestjs/common";

import { ConsentModule } from "../consent/consent.module.js";
import { CredentialsModule } from "../credentials/credentials.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ProvidersModule } from "../providers/providers.module.js";
import { SessionsModule } from "../sessions/sessions.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { WorkspacesModule } from "../workspaces/workspaces.module.js";
import { RealtimeGateway } from "./realtime.gateway.js";
import { RealtimeService } from "./realtime.service.js";

@Module({
  imports: [ConsentModule, CredentialsModule, DatabaseModule, ProvidersModule, SessionsModule, SettingsModule, WorkspacesModule],
  providers: [RealtimeService, RealtimeGateway],
  exports: [RealtimeService, RealtimeGateway]
})
export class RealtimeModule {}
