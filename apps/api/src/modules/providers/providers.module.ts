import { Module } from "@nestjs/common";

import { ApiConfigModule } from "../config/config.module.js";
import { ProvidersService } from "./providers.service.js";

@Module({
  imports: [ApiConfigModule],
  providers: [ProvidersService],
  exports: [ProvidersService]
})
export class ProvidersModule {}
