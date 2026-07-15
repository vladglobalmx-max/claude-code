import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // "server-only" throws unconditionally unless resolved under Next's
      // "react-server" export condition. Vitest runs plain Node, so point it
      // at the package's own no-op build instead of Next's bundler alias.
      "server-only": path.resolve(dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
