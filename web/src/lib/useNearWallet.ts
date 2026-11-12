import { useCallback, useEffect, useRef, useState } from 'react';
import { NearConnector } from '@hot-labs/near-connect';
import type { NearWalletBase } from '@hot-labs/near-connect';
import { getAccountBalanceYocto, isValidTestnetAccount } from './nearClient';

export interface WalletState {
  accountId: string | null;
  walletName: string | null;
  balanceYocto: bigint | null;
  isConnecting: boolean;
  isSending: boolean;
  txHash: string | null;
  txError: string | null;
}

export interface SendTxParams {
  contractId: string;
  methodName: string;
  args?: Record<string, unknown>;
  gasTgas?: number;
  depositYocto?: bigint | string;
}

export interface SendTxResult {
  ok: boolean;
  txHash?: string;
  error?: string;
}

let connectorInstance: NearConnector | null = null;

function getConnector(): NearConnector | null {
  if (typeof window === 'undefined') return null;
  if (!connectorInstance) {
    connectorInstance = new NearConnector({
      network: 'testnet',
    });
  }
  return connectorInstance;
}

export function useNearWallet() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [balanceYocto, setBalanceYocto] = useState<bigint | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const walletRef = useRef<NearWalletBase | null>(null);

  const refreshBalance = useCallback(async (targetAccount?: string) => {
    const acc = (targetAccount ?? accountId)?.trim();
    if (!acc || !isValidTestnetAccount(acc)) {
      setBalanceYocto(null);
      return;
    }
    try {
      const bal = await getAccountBalanceYocto(acc);
      setBalanceYocto(bal);
    } catch {
      // Ignore balance lookup errors on testnet RPC hiccups
    }
  }, [accountId]);

  // Check for existing connection on idle to avoid blocking critical page render
  useEffect(() => {
    let mounted = true;
    let cleanupEvents: (() => void) | null = null;

    const scheduleInit = () => {
      if (!mounted) return;
      const connector = getConnector();
      if (!connector) return;

      const restoreSession = async () => {
        try {
          const connected = await connector.getConnectedWallet();
          if (connected?.wallet && connected.accounts?.length) {
            const acc = connected.accounts[0].accountId;
            if (mounted) {
              walletRef.current = connected.wallet;
              setAccountId(acc);
              setWalletName(connected.wallet.manifest.name || 'NEAR Wallet');
              void refreshBalance(acc);
            }
          }
        } catch {
          // No connected wallet initially, which is expected
        }
      };

      void restoreSession();

      const handleSignIn = (payload: { wallet: NearWalletBase; accounts: { accountId: string }[] }) => {
        if (!mounted) return;
        walletRef.current = payload.wallet;
        const acc = payload.accounts[0]?.accountId ?? null;
        setAccountId(acc);
        setWalletName(payload.wallet.manifest.name || 'NEAR Wallet');
        if (acc) void refreshBalance(acc);
      };

      const handleSignOut = () => {
        if (!mounted) return;
        walletRef.current = null;
        setAccountId(null);
        setWalletName(null);
        setBalanceYocto(null);
      };

      connector.on('wallet:signIn', handleSignIn);
      connector.on('wallet:signOut', handleSignOut);

      cleanupEvents = () => {
        connector.off('wallet:signIn', handleSignIn);
        connector.off('wallet:signOut', handleSignOut);
      };
    };

    const win = typeof window !== 'undefined' ? window : null;
    if (win && 'requestIdleCallback' in win) {
      const id = (win as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => number }).requestIdleCallback(scheduleInit, { timeout: 1800 });
      return () => {
        mounted = false;
        if (cleanupEvents) cleanupEvents();
        if ('cancelIdleCallback' in win) {
          (win as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
        }
      };
    } else {
      const timer = setTimeout(scheduleInit, 1000);
      return () => {
        mounted = false;
        if (cleanupEvents) cleanupEvents();
        clearTimeout(timer);
      };
    }
  }, [refreshBalance]);

  const connectWallet = useCallback(async () => {
    const connector = getConnector();
    if (!connector) return;
    setIsConnecting(true);
    setTxError(null);
    try {
      const wallet = await connector.connect();
      walletRef.current = wallet;
      const accounts = await wallet.getAccounts({ network: 'testnet' });
      if (accounts.length > 0) {
        const acc = accounts[0].accountId;
        setAccountId(acc);
        setWalletName(wallet.manifest.name || 'NEAR Wallet');
        void refreshBalance(acc);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Wallet connection cancelled or failed';
      setTxError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalance]);

  const disconnectWallet = useCallback(async () => {
    const connector = getConnector();
    if (!connector) return;
    try {
      if (walletRef.current) {
        await connector.disconnect(walletRef.current);
      } else {
        await connector.disconnect();
      }
    } catch {
      // Disconnect fallback
    } finally {
      walletRef.current = null;
      setAccountId(null);
      setWalletName(null);
      setBalanceYocto(null);
      setTxHash(null);
      setTxError(null);
    }
  }, []);

  const sendContractTransaction = useCallback(async ({
    contractId,
    methodName,
    args = {},
    gasTgas = 30,
    depositYocto = 0n,
  }: SendTxParams): Promise<SendTxResult> => {
    const wallet = walletRef.current;
    if (!wallet || !accountId) {
      const err = 'No NEAR wallet connected. Please connect your wallet first.';
      setTxError(err);
      return { ok: false, error: err };
    }

    setIsSending(true);
    setTxError(null);
    setTxHash(null);

    try {
      const gas = (BigInt(gasTgas) * 1_000_000_000_000n).toString();
      const deposit = typeof depositYocto === 'bigint' ? depositYocto.toString() : depositYocto;

      const outcome = await wallet.signAndSendTransaction({
        network: 'testnet',
        signerId: accountId,
        receiverId: contractId,
        actions: [
          {
            type: 'FunctionCall',
            params: {
              methodName,
              args,
              gas,
              deposit,
            },
          },
        ],
      });

      // Extract transaction hash from outcome
      const outcomeAny = outcome as unknown as {
        transaction?: { hash?: string };
        transaction_outcome?: { id?: string };
      };
      const hash = outcomeAny?.transaction?.hash ?? outcomeAny?.transaction_outcome?.id ?? 'tx-confirmed';

      setTxHash(hash);
      void refreshBalance();
      return { ok: true, txHash: hash };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction was rejected or failed on NEAR Testnet';
      setTxError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsSending(false);
    }
  }, [accountId, refreshBalance]);

  return {
    accountId,
    walletName,
    balanceYocto,
    isConnecting,
    isSending,
    txHash,
    txError,
    connectWallet,
    disconnectWallet,
    refreshBalance,
    sendContractTransaction,
    clearTxStatus: useCallback(() => {
      setTxHash(null);
      setTxError(null);
    }, []),
  };
}
