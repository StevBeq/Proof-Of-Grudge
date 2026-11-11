import { useCallback, useEffect, useRef, useState } from 'react';
import { getProofs, getVaultState, publicConfig } from './nearClient';
import type { LiveSnapshot, Proof } from './nearClient';

export function useLiveVault(enabled: boolean, customContractId?: string) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proofError, setProofError] = useState(false);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const refreshRef = useRef<() => void>(() => {});

  const targetId = (customContractId || publicConfig.contractId).trim();

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let busy = false;
    const controller = new AbortController();

    const load = async () => {
      if (busy || document.hidden || !targetId) return;
      busy = true;
      setLoading(true);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const data = await Promise.race([
          getVaultState(targetId),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Read timed out')), 12000);
          }),
        ]);
        if (alive) {
          setSnapshot(data);
          setReceivedAt(Date.now());
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (alive) setLoading(false);
      }
    };

    const loadProofs = () => {
      void getProofs(controller.signal)
        .then(result => {
          if (alive) {
            setProofs(result.proofs);
            setProofError(result.invalid);
          }
        })
        .catch(() => {
          if (alive && !controller.signal.aborted) setProofError(true);
        });
    };

    const refresh = () => {
      void load();
      loadProofs();
    };
    refreshRef.current = refresh;
    refresh();

    const timer = setInterval(() => {
      void load();
    }, 5000);

    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', visible);

    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      refreshRef.current = () => {};
    };
  }, [enabled, targetId]);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { snapshot, receivedAt, error, loading, proofs, proofError, refresh };
}
