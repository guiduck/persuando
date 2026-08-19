export function createFakeDatabase() {
  const users = new Map();
  const credentials = new Map();
  const consentGrants = new Map();
  const settings = new Map();
  const workspaces = new Map();
  const sessions = new Map();
  const captureEvents = new Map();
  const transcriptSegments = new Map();
  const summaries = new Map();
  const insights = new Map();
  const suggestions = new Map();
  const codeCopilotContexts = new Map();
  const auditEvents = new Map();

  return {
    user: {
      async upsert({ where, create, update }) {
        const existing = users.get(where.id);
        const next = existing ? { ...existing, ...update } : { createdAt: new Date(), ...create };
        users.set(where.id, next);
        return next;
      }
    },
    providerCredential: {
      async create({ data }) {
        const record = { createdAt: new Date(), deletedAt: null, lastCheckedAt: null, ...data };
        credentials.set(record.id, record);
        return record;
      },
      async findFirst({ where }) {
        return Array.from(credentials.values()).find((record) => matches(record, where)) ?? null;
      },
      async update({ where, data }) {
        const existing = credentials.get(where.id);
        const updated = { ...existing, ...data };
        credentials.set(where.id, updated);
        return updated;
      }
    },
    consentGrant: {
      async create({ data }) {
        const record = {
          createdAt: new Date(),
          grantedAt: null,
          revokedAt: null,
          expiresAt: null,
          sessionId: null,
          ...data
        };
        consentGrants.set(record.id, record);
        return record;
      },
      async findMany({ where = {} } = {}) {
        return Array.from(consentGrants.values()).filter((record) => matches(record, where));
      },
      async findFirst({ where }) {
        return Array.from(consentGrants.values()).find((record) => matches(record, where)) ?? null;
      },
      async update({ where, data }) {
        const existing = consentGrants.get(where.id);
        const updated = { ...existing, ...data };
        consentGrants.set(where.id, updated);
        return updated;
      }
    },
    userSettings: {
      async upsert({ where, create, update }) {
        const existing = settings.get(where.userId);
        const next = existing
          ? { ...existing, ...update }
          : { providerCredentialId: null, updatedAt: new Date(), ...create };
        settings.set(where.userId, next);
        return next;
      }
    },
    workspace: {
      async findFirst({ where }) {
        return Array.from(workspaces.values()).find((record) => matches(record, where)) ?? null;
      },
      async create({ data }) {
        const record = { createdAt: new Date(), deletedAt: null, archivedAt: null, ...data };
        workspaces.set(record.id, record);
        return record;
      }
    },
    session: {
      async create({ data }) {
        const record = {
          createdAt: new Date(),
          startedAt: null,
          endedAt: null,
          deletedAt: null,
          activeCaptureClientId: null,
          ...data
        };
        sessions.set(record.id, record);
        return record;
      },
      async findUnique({ where }) {
        return sessions.get(where.id) ?? null;
      },
      async findMany({ where = {} } = {}) {
        return Array.from(sessions.values()).filter((record) => matches(record, where));
      },
      async update({ where, data }) {
        const existing = sessions.get(where.id);
        const updated = { ...existing, ...data };
        sessions.set(where.id, updated);
        return updated;
      }
    },
    captureEvent: {
      async create({ data }) {
        const record = { ...data };
        captureEvents.set(record.id, record);
        return record;
      },
      async findFirst({ where = {}, orderBy } = {}) {
        const records = Array.from(captureEvents.values()).filter((record) => matches(record, where));
        if (orderBy?.sequence === "desc") {
          records.sort((left, right) => Number(right.sequence) - Number(left.sequence));
        }
        return records[0] ?? null;
      },
      async count({ where = {} } = {}) {
        return Array.from(captureEvents.values()).filter((record) => matches(record, where)).length;
      }
    },
    transcriptSegment: {
      async create({ data }) {
        const record = { createdAt: new Date(), ...data };
        transcriptSegments.set(record.id, record);
        return record;
      },
      async findMany({ where = {}, orderBy, take } = {}) {
        const records = Array.from(transcriptSegments.values()).filter((record) => matches(record, where));
        if (orderBy?.startMs === "desc") {
          records.sort((left, right) => Number(right.startMs) - Number(left.startMs));
        }
        if (orderBy?.startMs === "asc") {
          records.sort((left, right) => Number(left.startMs) - Number(right.startMs));
        }
        return typeof take === "number" ? records.slice(0, take) : records;
      }
    },
    summary: {
      async create({ data }) {
        const record = { ...data };
        summaries.set(record.id, record);
        return record;
      },
      async findMany({ where = {}, orderBy } = {}) {
        return orderedByGeneratedAt(Array.from(summaries.values()).filter((record) => matches(record, where)), orderBy);
      }
    },
    insight: {
      async create({ data }) {
        const record = { ...data };
        insights.set(record.id, record);
        return record;
      },
      async findMany({ where = {}, orderBy } = {}) {
        return orderedByGeneratedAt(Array.from(insights.values()).filter((record) => matches(record, where)), orderBy);
      }
    },
    suggestion: {
      async create({ data }) {
        const record = { ...data };
        suggestions.set(record.id, record);
        return record;
      },
      async findMany({ where = {}, orderBy } = {}) {
        return orderedByGeneratedAt(Array.from(suggestions.values()).filter((record) => matches(record, where)), orderBy);
      }
    },
    codeCopilotContext: {
      async create({ data }) {
        const record = { createdAt: new Date(), generatedGuidance: null, ...data };
        codeCopilotContexts.set(record.id, record);
        return record;
      },
      async update({ where, data }) {
        const existing = codeCopilotContexts.get(where.id);
        const updated = { ...existing, ...data };
        codeCopilotContexts.set(where.id, updated);
        return updated;
      },
      async findFirst({ where }) {
        return Array.from(codeCopilotContexts.values()).find((record) => matches(record, where)) ?? null;
      }
    },
    auditEvent: {
      async create({ data }) {
        const record = { createdAt: new Date(), ...data };
        auditEvents.set(record.id, record);
        return record;
      }
    }
  };
}

function matches(record, where) {
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (record[key] !== value) return false;
  }
  return true;
}

function orderedByGeneratedAt(records, orderBy) {
  if (orderBy?.generatedAt === "asc") {
    records.sort((left, right) => Date.parse(left.generatedAt) - Date.parse(right.generatedAt));
  }
  if (orderBy?.generatedAt === "desc") {
    records.sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt));
  }
  return records;
}
