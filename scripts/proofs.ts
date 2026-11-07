import { readFile, open, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ensure, record, SafeError } from './safety.js';

export interface Proof {
  label: string;
  nearTxHash?: string;
  sepoliaTxHash?: string;
  url: string;
  createdAt: string;
}
export interface ProofFile { network: 'testnet'; verified: false; proofs: Proof[] }
export const proofPath = fileURLToPath(new URL('../web/public/proofs.json', import.meta.url));
export function proof(label: string, hash: string, chain: 'near' | 'sepolia'): Proof {
  ensure(/^[a-zA-Z0-9 _:-]{1,100}$/.test(label), 'Invalid proof label.');
  ensure(chain === 'near' ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hash) : /^0x[0-9a-fA-F]{64}$/.test(hash), 'Invalid transaction hash.');
  return { label, ...(chain === 'near' ? { nearTxHash: hash } : { sepoliaTxHash: hash }),
    url: chain === 'near' ? `https://testnet.nearblocks.io/txns/${hash}` : `https://sepolia.etherscan.io/tx/${hash}`,
    createdAt: new Date().toISOString() };
}
export function parseProofFile(value: unknown): ProofFile {
  const r = record(value);
  ensure(r.network === 'testnet' && r.verified === false && Array.isArray(r.proofs), 'Existing proofs file has an incompatible schema; it was not overwritten.');
  const proofs = r.proofs.map(item => {
    const p = record(item);
    ensure(typeof p.label === 'string' && typeof p.createdAt === 'string' && Number.isFinite(Date.parse(p.createdAt)), 'Invalid existing proof entry.');
    ensure((typeof p.nearTxHash === 'string') !== (typeof p.sepoliaTxHash === 'string'), 'Proof must identify exactly one chain.');
    const clean = proof(p.label, (p.nearTxHash ?? p.sepoliaTxHash) as string, p.nearTxHash ? 'near' : 'sepolia');
    ensure(p.url === clean.url, 'Existing proof URL does not match its testnet transaction.');
    return { ...clean, createdAt: p.createdAt };
  });
  return { network: 'testnet', verified: false, proofs };
}
export async function appendProof(entry: Proof): Promise<void> {
  // Fixed destination, exclusive lock, and atomic replacement. Never erase another
  // schema or manufacture evidence for offline rehearsals. Parent must exist.
  const lockPath = `${proofPath}.lock`, temporary = `${proofPath}.${process.pid}.tmp`;
  let lock;
  try { lock = await open(lockPath, 'wx'); }
  catch { throw new SafeError('Could not lock web/public/proofs.json. Ensure its directory exists and no other proof writer is active.'); }
  try {
    let data: ProofFile = { network: 'testnet', verified: false, proofs: [] };
    try { data = parseProofFile(JSON.parse(await readFile(proofPath, 'utf8'))); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw new SafeError('Existing proofs file could not be safely read; it was not overwritten.');
    }
    if (!data.proofs.some(p => p.nearTxHash === entry.nearTxHash && p.sepoliaTxHash === entry.sepoliaTxHash)) data.proofs.push(entry);
    const file = await open(temporary, 'wx');
    try { await file.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf8'); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, proofPath);
  } catch { throw new SafeError('Proof write failed. The transaction may already be complete; retain the printed explorer link and do not replay it.'); }
  finally { await unlink(temporary).catch(() => {}); await lock.close(); await unlink(lockPath).catch(() => {}); }
}
