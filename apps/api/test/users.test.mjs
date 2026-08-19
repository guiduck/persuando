import assert from "node:assert/strict";
import test from "node:test";

import { UsersService } from "../dist/src/modules/users/users.service.js";

test("UsersService upserts authenticated users through Prisma", async () => {
  const calls = [];
  const service = new UsersService({
    user: {
      upsert: async (input) => {
        calls.push(input);
      }
    }
  });

  await service.upsertAuthenticatedUser({
    id: "google:user-123",
    email: "person@example.com",
    displayName: "Person Example",
    provider: "google"
  });

  assert.deepEqual(calls, [
    {
      where: { id: "google:user-123" },
      create: {
        id: "google:user-123",
        email: "person@example.com",
        displayName: "Person Example",
        locale: "en"
      },
      update: {
        email: "person@example.com",
        displayName: "Person Example"
      }
    }
  ]);
});
