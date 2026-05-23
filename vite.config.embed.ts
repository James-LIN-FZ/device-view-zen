import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";

// Standalone CSR (client-side-only) Vite config for embedding into the Go binary.
// Build with: bun run build:embed
// The output lands in dist-embed/ and is then copied to backend/web/.
export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    outDir: "dist-embed",
    emptyOutDir: true,
  },
});
