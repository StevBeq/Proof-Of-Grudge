import { describe, expect, it } from 'vitest';
import { ethAddress, parseProofManifest, parseSnapshot, publicEndpoint, safeProof, toVault } from './nearClient';
const snapshot = {
  owner: 'owner.testnet', heir: 'heir.testnet', rival: 'rival.testnet', heir_eth_address: Array(20).fill(0),
  state: { status: 'Pending', claimed_at_ns: '121000000000', deadline_ns: '181000000000' },
  heartbeat_interval_ns: '120000000000', grace_period_ns: '60000000000', challenge_extension_ns: '60000000000',
  required_bond: '1000000000000000000000000', locked_heir_bond: '1000000000000000000000000', locked_rival_bond: '0', vault_assets: '10000000000000000000000000',
  last_check_in_ns: '0', last_outcome: 'None', credits: { owner: '0', heir: '0', rival: '0' },
  payouts_in_flight: { owner: '0', heir: '0', rival: '0' }, signing_in_flight: false, eth_release: null, observed_at_ns: '122000000000',
};
describe('flat get_vault_state response', () => {
  it('maps the supplied API without Number conversions for amounts and timestamps', () => {
    const parsed = parseSnapshot(snapshot); const vault = toVault(parsed);
    expect(vault.status).toBe('Pending'); expect(vault.deadline).toBe(181000000000n);
    expect(vault.lockedHeir).toBe(1000000000000000000000000n); expect(ethAddress(parsed.heir_eth_address)).toBe(`0x${'00'.repeat(20)}`);
  });
  it('rejects malformed responses rather than presenting guessed state', () => {
    expect(() => parseSnapshot({ ...snapshot, required_bond: 1 })).toThrow();
    expect(() => parseSnapshot({ ...snapshot, state: { status: 'Busted' } })).toThrow();
    expect(() => parseSnapshot({ ...snapshot, heir_eth_address: Array(20).fill(256) })).toThrow();
    expect(() => parseSnapshot({ ...snapshot, credits: { owner: '-1' } })).toThrow();
  });
});
describe('canonical script evidence manifest', () => {
  const nearTxHash = '1'.repeat(44);
  const proof = { label: 'Recorded claim', url: `https://testnet.nearblocks.io/txns/${nearTxHash}`, nearTxHash, createdAt: '2026-11-07T00:00:00.000Z' };
  it('accepts the empty, explicitly unverified testnet manifest', () => {
    expect(parseProofManifest({ network: 'testnet', verified: false, proofs: [] })).toEqual({ network: 'testnet', verified: false, proofs: [], invalid: false });
  });
  it('retains script metadata while deriving the explorer network from the URL', () => {
    const parsed = parseProofManifest({ network: 'testnet', verified: false, proofs: [proof] });
    expect(parsed.verified).toBe(false); expect(parsed.invalid).toBe(false);
    expect(parsed.proofs[0]).toMatchObject({ ...proof, network: 'near-testnet' });
  });
  it('uses the same base58 hash length envelope as the CLI proof writer', () => {
    for (const length of [32, 42, 43, 44]) {
      const hash = '1'.repeat(length);
      const entry = { ...proof, nearTxHash: hash, url: `https://testnet.nearblocks.io/txns/${hash}` };
      const parsed = parseProofManifest({ network: 'testnet', verified: false, proofs: [entry] });
      expect(parsed.invalid).toBe(false); expect(parsed.proofs).toHaveLength(1);
    }
    for (const length of [31, 45]) {
      expect(safeProof({ url: `https://testnet.nearblocks.io/txns/${'1'.repeat(length)}` })).toBeNull();
    }
  });
  it('rejects legacy and non-testnet manifests', () => {
    expect(() => parseProofManifest({ generated_at: null, transactions: [] })).toThrow();
    expect(() => parseProofManifest({ network: 'mainnet', verified: false, proofs: [] })).toThrow();
    expect(() => parseProofManifest({ network: 'testnet', verified: 'true', proofs: [] })).toThrow();
  });
  it('filters unsafe links, mismatched hashes and malformed canonical records', () => {
    const parsed = parseProofManifest({ network: 'testnet', verified: false, proofs: [
      proof, { ...proof, url: 'javascript:alert(1)' }, { ...proof, createdAt: 'not a timestamp' },
      { ...proof, nearTxHash: '2'.repeat(44) }, { ...proof, label: '' },
    ] });
    expect(parsed.invalid).toBe(true); expect(parsed.proofs).toHaveLength(1);
  });
});
describe('public endpoint and evidence boundary', () => {
  it('allows only HTTPS public endpoint configuration without URL credentials or query keys', () => {
    expect(publicEndpoint('https://test.rpc.fastnear.com')).toBe('https://test.rpc.fastnear.com/');
    for (const url of ['http://example.com', 'https://user:secret@example.com', 'https://example.com?key=secret']) expect(() => publicEndpoint(url)).toThrow();
  });
  it('only permits exact allowlisted testnet transaction destinations', () => {
    expect(safeProof({ url: `https://testnet.nearblocks.io/txns/${'1'.repeat(44)}` })?.network).toBe('near-testnet');
    expect(safeProof({ url: `https://sepolia.etherscan.io/tx/0x${'a'.repeat(64)}` })?.network).toBe('sepolia');
    for (const url of ['javascript:alert(1)', 'https://testnet.nearblocks.io.evil.test/txns/abc', 'https://etherscan.io/tx/0x123', 'https://user@testnet.nearblocks.io/txns/abc', `https://sepolia.etherscan.io/tx/0x${'a'.repeat(64)}?redirect=evil`]) expect(safeProof({ url })).toBeNull();
  });
});
