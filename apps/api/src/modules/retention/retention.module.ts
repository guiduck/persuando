import { Module } from "@nestjs/common";

import { RetentionCleanupJob } from "./retention-cleanup.job.js";
import { RetentionService } from "./retention.service.js";

@Module({
  providers: [RetentionService, RetentionCleanupJob],
  exports: [RetentionService, RetentionCleanupJob]
})
export class RetentionModule {}
