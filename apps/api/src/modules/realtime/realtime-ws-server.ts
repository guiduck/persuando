import type { Server } from "node:http";
import { HttpException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

import type { AuthenticatedUser } from "../auth/auth.service.js";
import { AuthService } from "../auth/auth.service.js";
import { toSafeProviderError } from "../providers/provider-adapter.js";
import { RealtimeGateway } from "./realtime.gateway.js";
import { RealtimeService, type RealtimeClientType } from "./realtime.service.js";

export interface RealtimeWebSocketServerOptions {
  authService: AuthService;
  gateway: RealtimeGateway;
  httpServer: Server;
  realtimeService: RealtimeService;
}

export interface RealtimeWireMessage {
  type: "realtime.result" | "realtime.event" | "realtime.error" | "realtime.connected";
  payload?: unknown;
  event?: unknown;
  safeMessage?: string;
}

export function attachRealtimeWebSocketServer(options: RealtimeWebSocketServerOptions): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const socketsByClientId = new Map<string, WebSocket>();

  options.httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/realtime") return;

    const user = resolveRealtimeUser(options.authService, request.headers.cookie, url);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const clientType = resolveClientType(url.searchParams.get("clientType"));
    const clientId = url.searchParams.get("clientId") ?? `${clientType}-${randomUUID()}`;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, { clientId, clientType, user });
    });
  });

  wss.on("connection", (socket, context: RealtimeConnectionContext) => {
    options.gateway.connect(context);
    socketsByClientId.set(context.clientId, socket);
    send(socket, { type: "realtime.connected", payload: { clientId: context.clientId, clientType: context.clientType } });

    socket.on("message", async (rawMessage) => {
      try {
        const message = rawMessage.toString("utf8");
        const result = await options.gateway.receiveMessage(context.clientId, message);
        send(socket, { type: "realtime.result", payload: result });
      } catch (error) {
        send(socket, { type: "realtime.error", safeMessage: safeRealtimeError(error) });
      }
    });

    socket.on("close", () => {
      socketsByClientId.delete(context.clientId);
      void options.gateway.disconnect(context.clientId);
    });
  });

  options.realtimeService.onEvent((event) => {
    for (const [clientId, socket] of socketsByClientId) {
      if (socket.readyState !== WebSocket.OPEN || !options.realtimeService.isSubscribed(clientId, event.sessionId)) continue;
      send(socket, { type: "realtime.event", event });
    }
  });

  return wss;
}

interface RealtimeConnectionContext {
  clientId: string;
  clientType: RealtimeClientType;
  user: AuthenticatedUser;
}

function resolveClientType(value: string | null): RealtimeClientType {
  return value === "capture" ? "capture" : "response";
}

function resolveRealtimeUser(authService: AuthService, cookieHeader: string | undefined, url: URL): AuthenticatedUser | undefined {
  const sessionToken = parseCookie(cookieHeader).persuando_user;
  const cookieUser = sessionToken ? authService.verifyUserSessionToken(sessionToken) : undefined;
  if (cookieUser) return cookieUser;

  if (process.env.NODE_ENV !== "production") {
    const localUserId = url.searchParams.get("userId") ?? undefined;
    return authService.localDevUser(localUserId);
  }

  return undefined;
}

function send(socket: WebSocket, message: RealtimeWireMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function parseCookie(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader?.split(";") ?? []) {
    const [key, ...valueParts] = part.trim().split("=");
    if (!key) continue;
    cookies[key] = decodeURIComponent(valueParts.join("="));
  }
  return cookies;
}

function safeRealtimeError(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === "string") return response;
    if (response && typeof response === "object" && "message" in response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.filter((item) => typeof item === "string").join("; ");
    }
  }
  return toSafeProviderError(error).message;
}
