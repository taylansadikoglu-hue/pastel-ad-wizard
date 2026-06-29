#!/usr/bin/env npx tsx
/**
 * Weekly AdLibrary advertiser discovery (all top categories).
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, argBool } from "./lib/parseArgs.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = argBool(args, "dryRun");
  const extra = dryRun ? ["--dry-run"] : [];

  await runScript(join(__dirname, "adlibrary-discover-advertisers.ts"), [
    "--all",
    "--limit",
    "50",
    ...extra,
  ]);
}

function runScript(script: string, scriptArgs: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", script, ...scriptArgs], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Script failed: ${script} (${code})`));
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
