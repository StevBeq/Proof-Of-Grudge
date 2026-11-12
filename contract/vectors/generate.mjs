import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { serializeTransaction } from 'viem';

const require = createRequire(import.meta.url);
const pinnedVersion = '2.38.5';
const installedVersion = require('viem/package.json').version;
assert.equal(installedVersion, pinnedVersion, 'Install the exact pinned viem version');
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 && process.argv[2] === '--check'),
  'Usage: node vectors/generate.mjs [--check]',
);
const checkOnly = process.argv[2] === '--check';
const inputUrl = new URL('./eip1559.inputs.json', import.meta.url);
const outputUrl = new URL('./eip1559.generated.json', import.meta.url);
const inputs = JSON.parse(await readFile(inputUrl, 'utf8'));
assert.equal(inputs.schema_version, 1);
assert.equal(inputs.chain_id, 11155111);
assert.equal(inputs.data, '0x');
assert.deepEqual(inputs.access_list, []);
assert.equal(inputs.cases.length, 3);

function decimal(value, bits, label) {
  assert.equal(typeof value, 'string', `${label} must be a decimal string`);
  assert.match(value, /^(0|[1-9][0-9]*)$/, `${label} must be canonical decimal`);
  const number = BigInt(value);
  assert.ok(number < (1n << BigInt(bits)), `${label} exceeds u${bits}`);
  return number;
}

const names = new Set();
const vectors = inputs.cases.map((input) => {
  assert.equal(typeof input.name, 'string');
  assert.ok(input.name.length > 0 && !names.has(input.name), 'Unique case names required');
  names.add(input.name);
  assert.match(input.to, /^0x[0-9a-f]{40}$/, 'Destination must be 20 lowercase hex bytes');
  const nonce = decimal(input.nonce, 64, 'nonce');
  // viem's nonce API is a JavaScript number; never silently round a fixture.
  assert.ok(nonce <= BigInt(Number.MAX_SAFE_INTEGER), 'Fixture nonce exceeds viem safe integer range');
  const value = decimal(input.value_wei, 128, 'value_wei');
  const maxFeePerGas = decimal(input.max_fee_per_gas, 128, 'max_fee_per_gas');
  const maxPriorityFeePerGas = decimal(input.max_priority_fee_per_gas, 128, 'max_priority_fee_per_gas');
  const gas = decimal(input.gas_limit, 64, 'gas_limit');
  assert.ok(maxFeePerGas > 0n && maxPriorityFeePerGas > 0n, 'Fees must be positive');
  assert.ok(maxPriorityFeePerGas <= maxFeePerGas, 'Priority fee exceeds maximum fee');
  assert.ok(gas >= 21000n, 'Gas below ETH-transfer intrinsic minimum');

  return {
    name: input.name,
    unsigned_serialized: serializeTransaction({
      type: 'eip1559',
      chainId: 11155111,
      nonce: Number(nonce),
      maxPriorityFeePerGas,
      maxFeePerGas,
      gas,
      to: input.to,
      value,
      data: '0x',
      accessList: [],
    }),
  };
});

// No timestamp or machine-specific paths: generation is deterministic and local.
const result = {
  schema_version: 1,
  provenance: {
    library: 'viem',
    version: installedVersion,
    serializer: 'serializeTransaction',
    generator: 'vectors/generate.mjs',
  },
  inputs,
  vectors,
};
const expected = `${JSON.stringify(result, null, 2)}\n`;
if (checkOnly) {
  let existing;
  try {
    existing = await readFile(outputUrl, 'utf8');
  } catch (error) {
    throw new Error('Missing generated fixture. From contract/: npm install && npm run vectors', { cause: error });
  }
  assert.equal(existing.replace(/\r\n/g, '\n'), expected, 'Fixture is stale or modified. Run npm run vectors and commit the result');
  console.log('eip1559.generated.json matches pinned viem serialization');
} else {
  await writeFile(outputUrl, expected, 'utf8');
  console.log('Wrote vectors/eip1559.generated.json using viem ' + installedVersion);
}
