import { Inject, Injectable } from "@nestjs/common";

import {
  persuandoJobNames,
  type ProviderCredentialValidationJob,
  type RetentionCleanupJobPayload,
  type SessionAssistanceGenerationJob
} from "./job-contracts.js";
import { BullMqJobQueue, type EnqueuedJob, type PersuandoJobQueue } from "./job-queue.js";

export const PERSUANDO_JOB_QUEUE = Symbol("PERSUANDO_JOB_QUEUE");

@Injectable()
export class JobsService {
  readonly moduleName = "jobs";

  constructor(@Inject(PERSUANDO_JOB_QUEUE) private readonly queue: PersuandoJobQueue) {}

  enqueueProviderCredentialValidation(input: ProviderCredentialValidationJob): Promise<EnqueuedJob> {
    return this.queue.enqueue(persuandoJobNames.validateProviderCredential, input);
  }

  enqueueSessionAssistanceGeneration(input: SessionAssistanceGenerationJob): Promise<EnqueuedJob> {
    return this.queue.enqueue(persuandoJobNames.generateSessionAssistance, input);
  }

  enqueueRetentionCleanup(input: RetentionCleanupJobPayload = { requestedAt: new Date().toISOString() }): Promise<EnqueuedJob> {
    return this.queue.enqueue(persuandoJobNames.cleanupRetention, input);
  }
}

export const jobQueueProvider = {
  provide: PERSUANDO_JOB_QUEUE,
  useExisting: BullMqJobQueue
};
