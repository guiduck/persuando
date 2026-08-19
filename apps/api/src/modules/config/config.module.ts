import { Module } from "@nestjs/common";

import { ApiConfigService } from "./config.service.js";

@Module({
  providers: [ApiConfigService],
  exports: [ApiConfigService]
})
export class ApiConfigModule {}
