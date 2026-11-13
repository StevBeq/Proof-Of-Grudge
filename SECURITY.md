# Security Policy — Proof-of-Grudge

Proof-of-Grudge is an adversarial dead-man's switch built on **NEAR Testnet** and **Ethereum Sepolia** for NEAR Hackathon 2026.

Although running on Testnet, the contract is architected with Mainnet-grade security standards. Bugs in the game-theoretic escrow or cross-chain authorization are treated with production severity.

---

## 1. Core Threat Model & Security Axioms

The contract operates under a zero-trust model between three actors:

```text
[Owner] ──(heartbeat check_in)──> [Vault Core] <──(bond B claim)── [Heir]
                                         ^
                                         └──(bond B challenge)── [Rival]
```

### What Matters Most
1. **Zero Unauthorized Principal Drain:** Vault principal $A$ must never be transferred to anyone while the Owner is alive and timely.
2. **Symmetrical Bond Deterrence:** Neither Heir nor Rival may initiate or extend a claim without staking bond $B$ exactly.
3. **No Administrative Backdoor:** The contract has no owner admin key, no upgrade mechanism, and no pause function. Once initialized on-chain, code is law.
4. **Deterministic Cross-Chain Release:** The Ethereum Sepolia release must be locked strictly to the pre-initialized Heir ETH address. No application-held EVM private key exists.

---

## 2. Cryptographic Immutability: Zero Access Keys Audit

Contract deployment and `init` were executed atomically in a single batch transaction ([`AkyXh4z9...Ny57B`](https://testnet.nearblocks.io/txns/AkyXh4z9HBYNSYezLWg8cvj8WQLyt5xawZj7UAqNy57B)), after which the account's `FullAccess` key was permanently deleted in transaction [`8itgVeVs...cDCu`](https://testnet.nearblocks.io/txns/8itgVeVsiS42DVpTW5LxzdSUpFj1bZkFEshFh2a5cDCu), leaving zero access keys on-chain.

Verify this live on NEAR Testnet via fastnear RPC:

```bash
curl -s https://test.rpc.fastnear.com -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"view_access_key_list","finality":"final","account_id":"pog-mw835qrr-1c82b2-vault.testnet"}}' \
  | grep -o '"keys":\[\]'
```

**Expected output:**
```json
"keys":[]
```
An empty array (`[]`) proves that no entity—not even the author or deploying machine—can upgrade, alter, or pause the vault contract.

---

## 3. Threat Vectors & Protocol Boundaries

| Vector | Description | Defense in Contract |
| :--- | :--- | :--- |
| **Sybil Collusion** | Heir and Rival operated by the same physical entity with two wallets. | Symmetrical bond requirement ensures any collusion burns capital or remains zero-sum ($B$ staked vs $B$ received). |
| **Speculative Griefing** | Heir claims hoping a living owner forgets to check-in. | Game-theoretic minimum bond constraint ($B \ge A \times (1-q)/q$) ensures expected value is negative for false claims. |
| **Heartbeat Key Leakage** | An attacker steals the Owner's NEAR private key. | `check_in()` only resets the clock; it has zero asset transfer capability. Stolen heartbeat keys cannot drain vault principal. |
| **Irreversible Key Rot** | Heir loses their EVM key after Owner passes away. | Explicit boundary: contract cannot restore lost external keys. Addressed by pre-registering verifiable cold addresses. |
| **Reentrancy & Callback Hijacking** | Malicious contracts intercepting payouts or MPC returns. | Strict pull-payment accounting via private callbacks; failed transfers restore withdrawable credits instead of reverting vault state. |

---

## 4. Reporting a Vulnerability

If you discover a vulnerability or state-machine inconsistency:
1. Please report it privately via GitHub Security Advisories on this repository.
2. Do not open public issues detailing reproducible exploit payloads until a fix or advisory has been published.
3. We commit to acknowledging reports within 24 hours during the NEAR Hackathon evaluation window.
