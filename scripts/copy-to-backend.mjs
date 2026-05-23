#!/usr/bin/env node
// Copies frontend/dist-embed/* into backend/web/ for Go embed.
// Run via: bun run build:embed (called automatically after vite build)

import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "../dist-embed");
const dest = resolve(__dirname, "../../backend/web");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log(`✓ Copied ${src} → ${dest}`);
