/**
 * Shared CLI arg parser for scheduler scripts.
 */

export type CliArgs = Record<string, string | boolean>;

export function parseCliArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function cliFlag(args: CliArgs, ...keys: string[]): boolean {
  return keys.some((key) => Boolean(args[key]));
}

export function cliString(args: CliArgs, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function cliNumber(args: CliArgs, fallback: number, ...keys: string[]): number {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) {
      const n = Number(value);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return fallback;
}
