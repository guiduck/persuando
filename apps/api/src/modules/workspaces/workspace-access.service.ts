import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth.service.js";

export interface OwnedWorkspaceLike {
  id: string;
  ownerUserId: string;
  deletedAt?: string;
}

export interface OwnedSessionLike {
  id: string;
  ownerUserId: string;
  workspaceId: string;
  deletedAt?: string;
}

@Injectable()
export class WorkspaceAccessService {
  assertWorkspaceAccess(user: AuthenticatedUser, workspace: OwnedWorkspaceLike | undefined): void {
    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException("Workspace not found");
    }
    if (workspace.ownerUserId !== user.id) {
      throw new ForbiddenException("Workspace belongs to another account");
    }
  }

  assertSessionAccess(user: AuthenticatedUser, session: OwnedSessionLike | undefined): void {
    if (!session || session.deletedAt) {
      throw new NotFoundException("Session not found");
    }
    if (session.ownerUserId !== user.id) {
      throw new ForbiddenException("Session belongs to another account");
    }
  }
}
