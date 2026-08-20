process.env.PERSUANDO_BOOTSTRAP_WORKER = "true";
await import("../apps/api/dist/src/worker.js");
