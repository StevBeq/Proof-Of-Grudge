import { publicConfig, publicEndpoint } from './nearClient';
/** Optional, read-only utility. Never sends raw transactions or requests a wallet. */
export async function readSepoliaBalance(address: string, signal?: AbortSignal): Promise<bigint> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Invalid public address');
  const request = async (method: string, params: unknown[]) => {
    const response = await fetch(publicEndpoint(publicConfig.sepoliaRpc), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal,
    });
    if (!response.ok) throw new Error('Sepolia RPC unavailable');
    const data = await response.json() as { result?: unknown; error?: unknown };
    if (data.error || typeof data.result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(data.result)) throw new Error('Invalid Sepolia response');
    return data.result;
  };
  if (BigInt(await request('eth_chainId', [])) !== 11155111n) throw new Error('Sepolia required');
  return BigInt(await request('eth_getBalance', [address, 'latest']));
}
