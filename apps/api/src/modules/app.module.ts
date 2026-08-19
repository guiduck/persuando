import { Module } from "@nestjs/common";

import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ApiConfigModule } from "./config/config.module.js";
import { ConsentModule } from "./consent/consent.module.js";
import { CredentialsModule } from "./credentials/credentials.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { LoggingModule } from "./logging/logging.module.js";
import { ProvidersModule } from "./providers/providers.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { RetentionModule } from "./retention/retention.module.js";
import { SessionsModule } from "./sessions/sessions.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { UsersModule } from "./users/users.module.js";
import { WorkspacesModule } from "./workspaces/workspaces.module.js";

@Module({
  imports: [
    ApiConfigModule,
    DatabaseModule,
    LoggingModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    SettingsModule,
    CredentialsModule,
    ConsentModule,
    SessionsModule,
    RealtimeModule,
    ProvidersModule,
    JobsModule,
    RetentionModule,
    AuditModule,
    HealthModule
  ]
})
export class AppModule {}
