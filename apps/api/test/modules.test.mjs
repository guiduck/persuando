import assert from "node:assert/strict";
import test from "node:test";

import { AppModule } from "../dist/src/index.js";

test("AppModule is available for NestJS bootstrap", () => {
  assert.equal(typeof AppModule, "function");
});

test("backend module scaffold includes the expected module names", async () => {
  const modules = [
    "audit",
    "auth",
    "consent",
    "credentials",
    "health",
    "jobs",
    "providers",
    "realtime",
    "retention",
    "sessions",
    "settings",
    "users",
    "workspaces"
  ];

  for (const moduleName of modules) {
    const imported = await import(`../dist/src/modules/${moduleName}/${moduleName}.module.js`);
    const exportName = `${moduleName[0].toUpperCase()}${moduleName.slice(1)}Module`;
    assert.equal(typeof imported[exportName], "function", `${exportName} should be exported`);
  }
});
