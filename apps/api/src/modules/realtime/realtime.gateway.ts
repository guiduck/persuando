import { Injectable } from "@nestjs/common";
import type { PersuandoWebSocketEvent } from "@persuando/contracts";

import type { AuthenticatedUser } from "../auth/auth.service.js";
import { RealtimeService, type RealtimeClient, type RealtimeClientType, type RealtimeHandleResult } from "./realtime.service.js";

@Injectable()
export class RealtimeGateway {
  readonly gatewayName = "native-websocket";

  constructor(private readonly realtimeService: RealtimeService) {}

  connect(input: { clientId: string; user?: AuthenticatedUser; clientType: RealtimeClientType }): RealtimeClient {
    return this.realtimeService.connectClient(input);
  }

  async receiveMessage(clientId: string, message: string | PersuandoWebSocketEvent): Promise<RealtimeHandleResult> {
    const event = typeof message === "string" ? JSON.parse(message) : message;
    return this.realtimeService.handleClientEvent(clientId, event);
  }

  publish(event: Omit<PersuandoWebSocketEvent, "sequence">): PersuandoWebSocketEvent {
    return this.realtimeService.publishServerEvent(event);
  }

  async disconnect(clientId: string): Promise<void> {
    await this.realtimeService.disconnectClient(clientId);
  }
}
