import { Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth.service.js";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async upsertAuthenticatedUser(user: AuthenticatedUser): Promise<void> {
    await this.database.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        locale: "en"
      },
      update: {
        email: user.email,
        displayName: user.displayName
      }
    });
  }
}
