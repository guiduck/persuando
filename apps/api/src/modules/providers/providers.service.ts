import { Injectable } from "@nestjs/common";

import { ApiConfigService } from "../config/config.service.js";
import { MockProviderAdapter } from "./mock-provider.adapter.js";
import { OpenAiCompatibleProviderAdapter } from "./openai-compatible-provider.adapter.js";
import type {
  ProviderAdapter,
  ProviderGenerationInput,
  ProviderGenerationOutput,
  ProviderTranscriptionInput,
  ProviderTranscriptionOutput
} from "./provider-adapter.js";

@Injectable()
export class ProvidersService {
  readonly moduleName = "providers";

  constructor(private readonly config: ApiConfigService) {}

  getAdapter(): ProviderAdapter {
    if (this.config.env.providerAdapter === "openai-compatible") {
      return new OpenAiCompatibleProviderAdapter(this.config.env.openAiCompatibleBaseUrl);
    }
    return new MockProviderAdapter();
  }

  getActiveAdapterName(): ProviderAdapter["name"] {
    return this.getAdapter().name;
  }

  generate(input: ProviderGenerationInput): Promise<ProviderGenerationOutput> {
    return this.getAdapter().generate(input);
  }

  transcribe(input: ProviderTranscriptionInput): Promise<ProviderTranscriptionOutput> {
    return this.getAdapter().transcribe(input);
  }
}
