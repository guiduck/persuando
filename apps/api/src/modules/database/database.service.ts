import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { ApiConfigService } from "../config/config.service.js";

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ApiConfigService) {
    super({
      adapter: new PrismaPg(config.env.databaseUrl)
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
