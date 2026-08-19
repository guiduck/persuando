import { Module } from "@nestjs/common";

import { ApiConfigModule } from "../config/config.module.js";
import { CredentialsModule } from "../credentials/credentials.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ProvidersModule } from "../providers/providers.module.js";
import { SessionsModule } from "../sessions/sessions.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { BullMqJobQueue } from "./job-queue.js";
import { JobWorkerFactoryService } from "./job-worker-factory.service.js";
import { JobWorkerHandlersService } from "./job-worker-handlers.service.js";
import { jobQueueProvider, JobsService } from "./jobs.service.js";

@Module({
  imports: [ApiConfigModule, CredentialsModule, DatabaseModule, ProvidersModule, SessionsModule, SettingsModule],
  providers: [BullMqJobQueue, jobQueueProvider, JobsService, JobWorkerHandlersService, JobWorkerFactoryService],
  exports: [JobsService, JobWorkerHandlersService, JobWorkerFactoryService]
})
export class JobsModule {}
