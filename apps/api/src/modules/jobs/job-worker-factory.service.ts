import { Injectable } from "@nestjs/common";
import type { Worker } from "bullmq";

import { BullMqJobQueue } from "./job-queue.js";
import { persuandoJobNames } from "./job-contracts.js";
import { JobWorkerHandlersService } from "./job-worker-handlers.service.js";

@Injectable()
export class JobWorkerFactoryService {
  readonly moduleName = "jobs.worker_factory";

  constructor(
    private readonly queue: BullMqJobQueue,
    private readonly handlers: JobWorkerHandlersService
  ) {}

  createWorkers(): Worker[] {
    return [
      this.queue.createWorker(persuandoJobNames.validateProviderCredential, (job) =>
        this.handlers.handleProviderCredentialValidation(job.data)
      ),
      this.queue.createWorker(persuandoJobNames.generateSessionAssistance, (job) =>
        this.handlers.handleSessionAssistanceGeneration(job.data)
      ),
      this.queue.createWorker(persuandoJobNames.cleanupRetention, (job) => this.handlers.handleRetentionCleanup(job.data))
    ];
  }
}
