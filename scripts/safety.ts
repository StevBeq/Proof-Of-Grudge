export class SafeError extends Error {}

export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SafeError(message);
}

export function record(value: unknown): Record<string, unknown> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 'Unexpected response object.');
  return value as Record<string, unknown>;
}

export function uint(value: unknown, bits: 64 | 128 = 128): bigint {
  ensure(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && value.length <= 39,
    'Expected a canonical unsigned decimal string.');
  const n = BigInt(value);
  ensure(n < (1n << BigInt(bits)), 'Unsigned integer exceeds the contract range.');
  return n;
}

export function addTime(a: bigint, b: bigint): bigint {
  const n = a + b;
  ensure(n < (1n << 64n), 'Timestamp overflow.');
  return n;
}

export function testnetAccount(value: unknown): string {
  ensure(typeof value === 'string' && value.length >= 2 && value.length <= 64 &&
    /^(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\.)+testnet$/.test(value),
    'A named .testnet account is required. Implicit and mainnet accounts are intentionally unsupported.');
  return value;
}

export function endpoint(value: string): string {
  try {
    const url = new URL(value);
    ensure(url.protocol === 'https:' && !url.username && !url.password && !url.hash,
      'RPC endpoints must use HTTPS without user information or fragments.');
    return url.toString();
  } catch { throw new SafeError('Invalid HTTPS RPC endpoint.'); }
}

export async function bounded<T>(operation: () => Promise<T>, milliseconds = 30_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SafeError(
          'Operation timed out. A submitted transaction may still complete; inspect before retrying.')),
        milliseconds);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

// Never surface external exception messages, causes, RPC bodies, URLs, or stacks.
export function safeMessage(error: unknown): string {
  return error instanceof SafeError ? error.message :
    'Operation failed. Details were suppressed to protect credentials. Inspect public chain state before retrying.';
}

export function output(value: unknown): void {
  console.log(JSON.stringify(value, (_, v: unknown) => typeof v === 'bigint' ? v.toString() : v, 2));
}

export type Command = 'demo' | 'inspect' | 'derive' | 'preview-eth' | 'request-eth' | 'relay-eth' | 'release-eth' | 'deposit' | 'withdraw-payout';
export const scenarios = ['false-alarm', 'busted', 'inherit', 'spite', 'owner-withdraw'] as const;
export type Scenario = typeof scenarios[number];
export interface Options {
  command: Command;
  scenario: Scenario;
  flags: Set<string>;
  values: Map<string, string>;
}
const booleans = new Set(['dry-run', 'execute', 'confirm-testnet', 'read-only', 'broadcast', 'confirm-sepolia', 'write-proofs', 'help']);
const valued = new Set(['scenario', 'vault', 'near-rpc', 'sepolia-rpc', 'public-key', 'to', 'nonce', 'value-wei',
  'max-fee-per-gas', 'max-priority-fee-per-gas', 'gas-limit', 'amount', 'role', 'timeout-seconds']);
const commands = new Set<Command>(['demo', 'inspect', 'derive', 'preview-eth', 'request-eth', 'relay-eth', 'release-eth', 'deposit', 'withdraw-payout']);

export function parseOptions(argv: string[], defaultCommand: Command = 'demo'): Options {
  const args = argv.filter(arg => arg !== '--');
  let command = defaultCommand;
  if (args[0] && !args[0].startsWith('--')) {
    ensure(commands.has(args[0] as Command), 'Unknown command. Use --help.');
    command = args.shift() as Command;
  }
  const flags = new Set<string>();
  const values = new Map<string, string>();
  while (args.length) {
    const token = args.shift()!;
    ensure(token.startsWith('--') && !token.includes('='), 'Use --flag value syntax. Positional arguments are not supported.');
    const name = token.slice(2);
    ensure(!flags.has(name) && !values.has(name), 'Duplicate option.');
    if (booleans.has(name)) flags.add(name);
    else {
      ensure(valued.has(name), 'Unknown option. Use --help.');
      const value = args.shift();
      ensure(value && !value.startsWith('--'), 'Missing option value.');
      values.set(name, value);
    }
  }
  const scenario = values.get('scenario') ?? 'false-alarm';
  ensure(scenarios.includes(scenario as Scenario), 'Unknown demo scenario.');
  ensure(!(flags.has('execute') && (flags.has('dry-run') || flags.has('read-only'))), 'Execution cannot be combined with dry-run or read-only.');
  ensure(!(flags.has('dry-run') && flags.has('read-only')), 'Dry-run cannot enable read-only network access.');
  if (flags.has('execute') || flags.has('read-only')) ensure(flags.has('confirm-testnet'), 'Network access requires --confirm-testnet.');
  if (flags.has('execute')) ensure(!['inspect', 'derive', 'preview-eth'].includes(command), 'This command is read-only; use --read-only, not --execute.');
  if (flags.has('read-only')) ensure(['inspect', 'derive', 'preview-eth'].includes(command), 'This command does not support --read-only.');
  if (flags.has('broadcast') || flags.has('confirm-sepolia')) {
    ensure(flags.has('execute') && flags.has('broadcast') && flags.has('confirm-sepolia') &&
      ['relay-eth', 'release-eth'].includes(command),
    'Broadcast requires relay-eth/release-eth --execute --confirm-testnet --broadcast --confirm-sepolia.');
  }
  if (flags.has('write-proofs')) ensure(flags.has('execute'), 'Proofs can only be written for explicitly executed operations.');
  if (values.has('scenario')) ensure(command === 'demo', '--scenario is only valid for demo.');
  if (values.has('amount')) ensure(command === 'deposit' || (command === 'demo' && scenario === 'owner-withdraw'), '--amount is only valid for deposit or owner-withdraw demo.');
  if (values.has('role')) ensure(command === 'withdraw-payout', '--role is only valid for withdraw-payout.');
  if (values.has('public-key')) ensure(command === 'derive', '--public-key is only valid for derive.');
  if (values.has('value-wei')) ensure(['preview-eth', 'request-eth', 'release-eth'].includes(command), '--value-wei is only valid for preview/request/release. relay-eth always uses the stored value.');
  for (const field of ['to', 'nonce', 'max-fee-per-gas', 'max-priority-fee-per-gas', 'gas-limit']) {
    if (values.has(field)) ensure(command === 'preview-eth', 'Transaction field overrides are only valid for offline preview-eth.');
  }
  return { command, scenario: scenario as Scenario, flags, values };
}

export function waitLimit(options: Options): number {
  const n = Number(options.values.get('timeout-seconds') ?? '600');
  ensure(Number.isInteger(n) && n >= 1 && n <= 3600, 'Timeout must be 1 to 3600 seconds.');
  return n * 1000;
}
