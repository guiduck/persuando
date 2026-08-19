import { Inject, Injectable, Optional } from "@nestjs/common";
import { parseEnv, type PersuandoEnv } from "@persuando/config";

@Injectable()
export class ApiConfigService {
  readonly env: PersuandoEnv;

  constructor(@Optional() @Inject("PERSUANDO_ENV_SOURCE") source: Record<string, string | undefined> = process.env) {
    this.env = parseEnv(source);
    this.validateRuntimeRequirements(source.NODE_ENV);
  }

  private validateRuntimeRequirements(nodeEnv: string | undefined): void {
    if (nodeEnv === "production" || nodeEnv === "staging") {
      if (!this.env.googleClientId || !this.env.googleClientSecret) {
        throw new Error("Google auth credentials are required outside local/test environments");
      }
    }
  }
}
