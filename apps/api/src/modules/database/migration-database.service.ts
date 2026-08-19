import { Injectable, OnModuleDestroy } from "@nestjs/common";
import pg from "pg";

import { ApiConfigService } from "../config/config.service.js";

@Injectable()
export class MigrationDatabaseService implements OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor(config: ApiConfigService) {
    this.pool = new pg.Pool({ connectionString: config.env.databaseUrl });
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values: readonly unknown[] = []
  ): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, [...values]);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
