import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));

// __APP_VERSION__ / __BUILD_DATE__ alimentan el panel discreto de ?beta=true
// (ver src/main.js) — nunca se muestran en la experiencia normal.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: "es2018",
  },
});
