export type ParsedArgs = Record<string, string | boolean | number>;

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      const asNum = Number(next);
      out[key] = Number.isFinite(asNum) && next.trim() !== "" ? asNum : next;
      i++;
    }
  }
  return out;
}

export function argString(args: ParsedArgs, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

export function argNumber(args: ParsedArgs, key: string, fallback: number): number {
  const v = args[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function argBool(args: ParsedArgs, key: string): boolean {
  return args[key] === true;
}
