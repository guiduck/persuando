import { forwardRef, Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { SessionsModule } from "../sessions/sessions.module.js";
import { WorkspaceAccessService } from "./workspace-access.service.js";
import { WorkspacesController } from "./workspaces.controller.js";
import { WorkspacesService } from "./workspaces.service.js";

@Module({
  imports: [AuthModule, DatabaseModule, forwardRef(() => SessionsModule)],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceAccessService],
  exports: [WorkspacesService, WorkspaceAccessService]
})
export class WorkspacesModule {}
