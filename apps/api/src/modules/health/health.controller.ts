import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): { ok: true; service: "persuando-api" } {
    return { ok: true, service: "persuando-api" };
  }
}
