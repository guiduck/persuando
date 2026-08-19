export const persuandoJobQueues = {
  providerValidation: "persuando-provider-validation",
  providerGeneration: "persuando-provider-generation",
  retentionCleanup: "persuando-retention-cleanup"
} as const;

export const persuandoJobNames = {
  validateProviderCredential: "provider.credential.validate",
  generateSessionAssistance: "provider.session_assistance.generate",
  cleanupRetention: "retention.cleanup"
} as const;

export type PersuandoJobName = (typeof persuandoJobNames)[keyof typeof persuandoJobNames];
export type PersuandoQueueName = (typeof persuandoJobQueues)[keyof typeof persuandoJobQueues];

export interface ProviderCredentialValidationJob {
  userId: string;
  credentialId: string;
}

export interface SessionAssistanceGenerationJob {
  userId: string;
  sessionId: string;
}

export interface RetentionCleanupJobPayload {
  requestedAt: string;
}

export type PersuandoJobPayloadByName = {
  [persuandoJobNames.validateProviderCredential]: ProviderCredentialValidationJob;
  [persuandoJobNames.generateSessionAssistance]: SessionAssistanceGenerationJob;
  [persuandoJobNames.cleanupRetention]: RetentionCleanupJobPayload;
};

export function queueNameForJob(jobName: PersuandoJobName): PersuandoQueueName {
  if (jobName === persuandoJobNames.validateProviderCredential) return persuandoJobQueues.providerValidation;
  if (jobName === persuandoJobNames.generateSessionAssistance) return persuandoJobQueues.providerGeneration;
  return persuandoJobQueues.retentionCleanup;
}
