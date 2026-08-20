import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_oitzuhavwbaqnfthwhyg",
  dirs: ["./src/trigger"],
  maxDuration: 60, // segundos máximos por run; save-call-transcript é rápida, isso é margem de sobra
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
