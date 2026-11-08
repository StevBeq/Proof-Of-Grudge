import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initArgs, localMain, localPaths, validateLocal, type LocalConfig } from './testnet-local.js';

function fixture(): LocalConfig {
  return { network: 'testnet', nearRpc: 'https://rpc.testnet.near.org',
    sepoliaRpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    accounts: Object.fromEntries(['owner', 'heir', 'rival', 'vault'].map(role =>
      [role, { accountId: `setup-${role}.testnet`, publicKey: 'ed25519:11111111111111111111111111111111' }])) as LocalConfig['accounts'],
    heirEthAddress: '0x1111111111111111111111111111111111111111' };
}

test('profiles are isolated and cannot escape their ignored local directory', () => {
  assert.notEqual(localPaths().local, localPaths('inherit').local);
  for (const name of ['..', '../secrets', 'a/b', 'a\\b', '', 'A', '-profile', 'x'.repeat(33)]) {
    assert.throws(() => localPaths(name));
  }
});
test('local setup rejects other networks and RPC replacements', () => {
  assert.equal(validateLocal(fixture()).network, 'testnet');
  for (const patch of [{ network: 'mainnet' }, { nearRpc: 'https://rpc.mainnet.near.org' }, { sepoliaRpc: 'https://example.com' }]) {
    assert.throws(() => validateLocal({ ...fixture(), ...patch }));
  }
});
test('local setup requires four distinct named testnet accounts', () => {
  const config = fixture();
  config.accounts.vault.accountId = config.accounts.owner.accountId;
  assert.throws(() => validateLocal(config));
  config.accounts.vault.accountId = 'vault.near';
  assert.throws(() => validateLocal(config));
});
test('local setup rejects malformed public keys and zero recipients', () => {
  const config = fixture();
  config.accounts.heir.publicKey = 'secret-not-a-public-key';
  assert.throws(() => validateLocal(config));
  assert.throws(() => validateLocal({ ...fixture(), heirEthAddress: `0x${'0'.repeat(40)}` }));
});
test('deployment initialization locks the generated recipient and leaves safe live windows', () => {
  const config = fixture(), args = initArgs(config);
  assert.equal(args.owner, config.accounts.owner.accountId);
  assert.equal(args.heir, config.accounts.heir.accountId);
  assert.equal(args.rival, config.accounts.rival.accountId);
  assert.deepEqual(args.heir_eth_address, Array(20).fill(17));
  assert.equal(args.required_bond, '1000000000000000000000000');
  assert.ok(BigInt(args.grace_period_ns) >= 90_000_000_000n);
  assert.ok(BigInt(args.challenge_extension_ns) >= BigInt(args.grace_period_ns));
});
test('local network operations reject missing and contradictory gates before any file access', async () => {
  for (const args of [['inspect'], ['faucet'], ['deploy'], ['faucet', '--execute'],
    ['deploy', '--execute', '--confirm-mainnet'], ['inspect', '--execute', '--confirm-testnet'],
    ['deploy', '--execute', '--confirm-testnet', '--delete-key'], ['prepare', '--execute']]) {
    await assert.rejects(localMain(args));
  }
});
test('local wrapper rejects unknown commands and network overrides without execution gates', async () => {
  await assert.rejects(localMain(['submit']));
  await assert.rejects(localMain(['run', 'inspect', '--read-only']));
  await assert.rejects(localMain(['run', 'release-eth', '--broadcast', '--confirm-sepolia']));
});
