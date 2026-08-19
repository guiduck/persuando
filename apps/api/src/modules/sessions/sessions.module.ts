import { forwardRef, Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { ConsentModule } from "../consent/consent.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { RetentionModule } from "../retention/retention.module.js";
import { WorkspacesModule } from "../workspaces/workspaces.module.js";
import { SessionsController } from "./sessions.controller.js";
import { SessionsService } from "./sessions.service.js";

@Module({
  imports: [AuthModule, ConsentModule, DatabaseModule, RetentionModule, forwardRef(() => WorkspacesModule)],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService]
})
export class SessionsModule {}
