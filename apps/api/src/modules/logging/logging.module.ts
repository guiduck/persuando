import { Module } from "@nestjs/common";

import { LoggingRedactionService } from "./logging-redaction.service.js";

@Module({
  providers: [LoggingRedactionService],
  exports: [LoggingRedactionService]
})
export class LoggingModule {}
