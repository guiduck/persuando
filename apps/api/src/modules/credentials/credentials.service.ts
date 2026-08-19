import { Injectable, NotFoundException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { maskProviderCredential, type ProviderCredentialId, type ProviderCredentialMetadata, type UserId } from "@persuando/contracts";

import { ApiConfigService } from "../config/config.service.js";
import { DatabaseService } from "../database/database.service.js";

export interface CreateProviderCredentialInput {
  userId: string;
  providerName: string;
  secret: string;
}

@Injectable()
export class CredentialsService {
  readonly moduleName = "credentials";

  constructor(
    private readonly config: ApiConfigService,
    private readonly database: DatabaseService
  ) {}

  async createCredential(input: CreateProviderCredentialInput): Promise<ProviderCredentialMetadata> {
    const id = randomUUID() as ProviderCredentialId;
    const metadata: ProviderCredentialMetadata = {
      id,
      userId: input.userId as UserId,
      providerName: input.providerName,
      maskedDisplayValue: maskProviderCredential(input.secret),
      encryptionVersion: this.config.env.credentialEncryptionKeyVersion,
      validationStatus: "unverified"
    };

    await ensureUser(this.database, input.userId);
    await this.database.providerCredential.create({
      data: {
        id,
        userId: input.userId,
        providerName: input.providerName,
        encryptedCiphertext: encryptSecret(input.secret, this.config.env.credentialEncryptionKey),
        encryptionVersion: metadata.encryptionVersion,
        maskedDisplayValue: metadata.maskedDisplayValue,
        validationStatus: metadata.validationStatus
      }
    });

    return metadata;
  }

  async getCredentialMetadata(userId: string, credentialId: string): Promise<ProviderCredentialMetadata> {
    return toCredentialMetadata(await this.getUserCredential(userId, credentialId));
  }

  async markInvalid(userId: string, credentialId: string): Promise<ProviderCredentialMetadata> {
    const credential = await this.getUserCredential(userId, credentialId);
    const updated = await this.database.providerCredential.update({
      where: { id: credential.id },
      data: {
        validationStatus: "invalid",
        lastCheckedAt: new Date()
      }
    });
    return toCredentialMetadata(updated);
  }

  async validateCredential(
    userId: string,
    credentialId: string
  ): Promise<{ credential: ProviderCredentialMetadata; ok: boolean; safeMessage: string }> {
    const credential = await this.getUserCredential(userId, credentialId);
    const secret = decryptSecret(credential.encryptedCiphertext, this.config.env.credentialEncryptionKey);
    const ok = secret.trim().length >= 8 && !secret.toLowerCase().includes("invalid");
    const updated = await this.database.providerCredential.update({
      where: { id: credential.id },
      data: {
        validationStatus: ok ? "valid" : "invalid",
        lastCheckedAt: new Date()
      }
    });

    return {
      credential: toCredentialMetadata(updated),
      ok,
      safeMessage: ok ? "Provider credential validated." : "Provider credential could not be validated."
    };
  }

  async deleteCredential(userId: string, credentialId: string): Promise<ProviderCredentialMetadata> {
    const credential = await this.getUserCredential(userId, credentialId);
    const updated = await this.database.providerCredential.update({
      where: { id: credential.id },
      data: {
        validationStatus: "deleted",
        deletedAt: new Date()
      }
    });
    return toCredentialMetadata(updated);
  }

  async decryptForProviderCall(userId: string, credentialId: string): Promise<string> {
    const credential = await this.getUserCredential(userId, credentialId);
    if (credential.validationStatus === "deleted" || credential.validationStatus === "revoked" || credential.deletedAt) {
      throw new NotFoundException("Provider credential is not available");
    }

    return decryptSecret(credential.encryptedCiphertext, this.config.env.credentialEncryptionKey);
  }

  private async getUserCredential(userId: string, credentialId: string): Promise<ProviderCredentialRecord> {
    const credential = await this.database.providerCredential.findFirst({
      where: {
        id: credentialId,
        userId
      }
    });
    if (!credential) {
      throw new NotFoundException("Provider credential not found");
    }
    return credential;
  }
}

interface ProviderCredentialRecord {
  id: string;
  userId: string;
  providerName: string;
  encryptedCiphertext: string;
  encryptionVersion: string;
  maskedDisplayValue: string;
  validationStatus: string;
  lastCheckedAt: Date | string | null;
  deletedAt?: Date | string | null;
}

function toCredentialMetadata(record: ProviderCredentialRecord): ProviderCredentialMetadata {
  return {
    id: record.id as ProviderCredentialId,
    userId: record.userId as UserId,
    providerName: record.providerName,
    maskedDisplayValue: record.maskedDisplayValue,
    encryptionVersion: record.encryptionVersion,
    validationStatus: record.validationStatus as ProviderCredentialMetadata["validationStatus"],
    lastCheckedAt: toIso(record.lastCheckedAt)
  };
}

async function ensureUser(database: DatabaseService, userId: string): Promise<void> {
  await database.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: `${userId.replaceAll(":", "_")}@local.persuando.dev`,
      displayName: userId,
      locale: "en"
    },
    update: {}
  });
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function encryptSecret(secret: string, keyMaterial: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", normalizeKey(keyMaterial), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptSecret(encryptedCiphertext: string, keyMaterial: string): string {
  const [ivValue, tagValue, ciphertextValue] = encryptedCiphertext.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid encrypted credential payload");
  }

  const decipher = createDecipheriv("aes-256-gcm", normalizeKey(keyMaterial), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function normalizeKey(keyMaterial: string): Buffer {
  const decoded = Buffer.from(keyMaterial, "base64");
  if (decoded.length === 32) return decoded;
  return createHash("sha256").update(keyMaterial).digest();
}
