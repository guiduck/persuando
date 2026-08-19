import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker, type Job, type Processor } from "bullmq";

import { ApiConfigService } from "../config/config.service.js";
import {
  queueNameForJob,
  type PersuandoJobName,
  type PersuandoJobPayloadByName,
  type PersuandoQueueName
} from "./job-contracts.js";

export interface EnqueuedJob {
  id?: string;
  name: PersuandoJobName;
  queueName: PersuandoQueueName;
}

export interface PersuandoJobQueue {
  enqueue<TName extends PersuandoJobName>(name: TName, data: PersuandoJobPayloadByName[TName]): Promise<EnqueuedJob>;
}

@Injectable()
export class BullMqJobQueue implements PersuandoJobQueue, OnModuleDestroy {
  readonly moduleName = "jobs.queue";
  private readonly queues = new Map<PersuandoQueueName, Queue>();
  private readonly workers: Worker[] = [];

  constructor(private readonly config: ApiConfigService) {}

  async enqueue<TName extends PersuandoJobName>(name: TName, data: PersuandoJobPayloadByName[TName]): Promise<EnqueuedJob> {
    const queueName = queueNameForJob(name);
    const job = await this.getQueue(queueName).add(name, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500
    });
    return { id: job.id, name, queueName };
  }

  createWorker<TName extends PersuandoJobName>(name: TName, processor: Processor<PersuandoJobPayloadByName[TName]>): Worker {
    const worker = new Worker(queueNameForJob(name), processor as Processor, {
      connection: redisConnectionFromUrl(this.config.env.redisUrl)
    });
    this.workers.push(worker);
    return worker;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.workers.map((worker) => worker.close()), ...[...this.queues.values()].map((queue) => queue.close())]);
  }

  private getQueue(queueName: PersuandoQueueName): Queue {
    const existing = this.queues.get(queueName);
    if (existing) return existing;
    const queue = new Queue(queueName, { connection: redisConnectionFromUrl(this.config.env.redisUrl) });
    this.queues.set(queueName, queue);
    return queue;
  }
}

export class InMemoryJobQueue implements PersuandoJobQueue {
  readonly jobs: EnqueuedJob[] = [];

  async enqueue<TName extends PersuandoJobName>(name: TName, _data: PersuandoJobPayloadByName[TName]): Promise<EnqueuedJob> {
    const job = { id: String(this.jobs.length + 1), name, queueName: queueNameForJob(name) };
    this.jobs.push(job);
    return job;
  }
}

function redisConnectionFromUrl(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    db: Number(url.pathname.replace("/", "") || 0)
  };
}

export type PersuandoBullMqJob<TName extends PersuandoJobName> = Job<PersuandoJobPayloadByName[TName], unknown, TName>;
