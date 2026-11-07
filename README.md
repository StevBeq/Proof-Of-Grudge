# Proof-of-Grudge: Adversarial Cross-Chain Inheritance on NEAR

> **Track:** `open` (Track 13 — Open Innovation)  
> **One-Line Pitch:** A cross-chain dead-man's switch (NEAR + Ethereum Sepolia via Chain Signatures) that replaces benevolent guardians with an adversarial rival who stakes a financial bond to challenge inheritance claims.

---

## 1. Why This Idea Might Fail (Self-Critique)
*(Prompt requirement for Open Innovation Track)*

Before building Proof-of-Grudge, we must argue against its core premise: **relying on human animosity as a cryptographic security primitive**.

### Which Objections Our Design Answers (and Which Remain Explicit Boundaries):

1. **No Permanent Veto-Griefing (Enforced in Contract):** Unlike traditional guardian veto vaults where a watcher can freeze funds indefinitely at zero personal cost, a Rival in Proof-of-Grudge can only challenge once per claim window, and must stake real capital ($R = B$). If the Owner is deceased, challenging is strictly negative expected value ($EV < 0$) and burns the Rival's bond directly to the Heir.
2. **No Free-Riding Watcher (Enforced in Contract):** If the Heir submits a premature claim and the Owner cancels it without a challenge, the Owner pockets the Heir's bond ($H = B$). The Rival only profits ($H + R = 2B$) if they actively staked their own bond to catch the Heir red-handed and buy the Owner extra time.
3. **Living Owner Escape Hatch & Separate Bond Accounting (Enforced in Contract):** Because full-access keys are removed on production vaults, living owners need an unblockable exit. While the vault is in the `Idle` state, the Owner can call `owner_withdraw_near` at any time. Bond accounting is strictly segregated in dedicated storage fields rather than computed from raw contract balance.
4. **Cross-Chain Balance Blindness (Enforced in Contract):** Because a NEAR contract cannot directly inspect EVM balances or nonces on Ethereum Sepolia, once `Finalized`, the contract acts as a **Destination-Locked EIP-1559 Transactor**. The contract hardcodes `chain_id = 11155111` and `to = heir_eth_address` into the transaction RLP before hashing and requesting a signature from the NEAR MPC network (`v1.signer-prod.testnet`). Even if invoked repeatedly, the vault's derived Ethereum address can cryptographically only ever send ETH to the designated Heir.
5. **Sybil Collusion (Explicit Social Assumption):** The smart contract enforces `owner != heir && owner != rival && heir != rival` at the account ID level. However, if a single malicious actor controls both the Heir and Rival private keys, the bond circular loop has zero economic friction. This remains an acknowledged boundary of any smart contract system unable to verify physical social relations.

### Comparison with Sampled Hackathon Vaults
*(Based on the sample of public submissions inspected, such as `Aegis`, `Handover`, and `near-policy-vault`)*

| Mechanism | Timelock Vaults (e.g., Aegis) | Guardian Veto Vaults (e.g., near-policy-vault) | **Proof-of-Grudge (Ours)** |
|---|---|---|---|
| **Premature Claim Defense** | Passive timer only | Free guardian veto | **Rival stakes $B$ bond to challenge & extend timer** |
| **Hostile Watcher Griefing** | N/A | Watcher can veto without staking capital | **Slashed: Challenging a valid claim forfeits bond to Heir** |
| **Watcher Incentive** | Pure altruism | Pure altruism | **Bounty: Rival wins $2B$ (`Busted!`) when Owner checks in** |
| **Cross-Chain Signing** | Multi-chain MPC | NEAR only | **Destination-locked EIP-1559 RLP via NEAR Chain Signatures** |

---

## 2. The Payoff Matrix & Bond Sizing Math

Let $B$ be the symmetric `required_bond` ($H = R = B$), $A$ be the total Vault Value, and $p = P(\text{Owner calls check\_in before deadline})$.

- **Rival's Expected Value for Challenging (risk-neutral):**
  $$EV(\text{Challenge}) = p \cdot (+B) + (1 - p) \cdot (-B) = (2p - 1) \cdot B \implies \text{Challenge iff } p > 0.5$$

- **Recommended Bond Size ($B$) to Deter Premature Claims when $P(\text{Owner returns}) \ge q$:**
  $$B \ge A \cdot \frac{1 - q}{q}$$
  *(e.g., If $q = 0.90$, then $B \ge 0.111 \cdot A$ or ~11.1% of vault value; if $q = 0.50$, then $B \ge A$).*

### The 4 Payoff Branches

| Branch | Rival Challenged? | Owner Checked In (`now < deadline`)? | Vault Assets | Bond Payout |
|---|:---:|:---:|---|---|
| **1. False Alarm** | No | Yes | Stay with Owner | **Owner** gets $B$ |
| **2. Busted!** | Yes (Staked $B$) | Yes | Stay with Owner | **Rival** gets $2B$ |
| **3. Uncontested** | No | No (Expired $\to$ `Finalized`) | Released to Heir | **Heir** gets $B$ back |
| **4. Spite Backfired** | Yes (Staked $B$) | No (Expired $\to$ `Finalized`) | Released to Heir | **Heir** gets $2B$ |

---

## 3. Quick Verification for Judges & AI Agents ("Do X → See Y")

### A. Run Local Unit & RLP Golden-Vector Tests (Zero Network Setup)

1. **Do X:**
   ```bash
   cd contract
   cargo test -- --nocapture
   ```
2. **See Y:** All unit tests pass, verifying the 4 payoff branches, `check_in` boundary rejection at `now >= deadline_ns` and after `Finalized`, `owner_withdraw_near` in `Idle`, distinct account assertions, and byte-for-byte EIP-1559 RLP encoding against viem golden vectors.

### B. Verify Live Testnet Deployment & On-Chain Proofs

- **Deployed Vault Contract (NEAR Testnet):** `[grudge-vault.testnet]` *(Updated upon testnet deployment)*
- **Derived Ethereum Sepolia Vault Address:** `[0x...]` *(Derived via Chain Signatures MPC)*
- **Proof 1 — "Busted!" Scenario Tx:** `[Link to Nearblocks Testnet Tx]`
- **Proof 2 — Valid Inheritance + ETH Sepolia Release Tx:** `[Link to Nearblocks Testnet & Sepolia Etherscan Tx]`

### C. Run the End-to-End Testnet CLI Demo

1. **Do X:**
   ```bash
   cd scripts
   npm install
   npm run demo -- --dry-run
   ```
2. **See Y:** Verifies contract state, derives the Ethereum Sepolia address controlled by the vault via Chain Signatures, and validates RLP payload construction. (With `.env` testnet keys configured, run `npm run demo -- --scenario busted` or `--scenario inherit`).

---

## 4. Threat Model & Failure Cases

- **Lost Guardian / Rival Key:** If the Rival loses their private key, the vault does not brick; it operates as a standard timelock dead-man's switch (Branch 1 and Branch 3).
- **Lost Heir Key:** If the Heir loses their private key after the Owner has passed away, assets will remain permanently locked in the vault. This is documented as an acknowledged boundary of dead-man's switches without centralized key escrows.
- **Hostile Rival:** A Rival can never receive vault assets and cannot cancel claims; challenging when the Owner is dead simply forfeits the Rival's bond ($B$) to the Heir.
- **Owner Alive but Offline:** Mitigated by configurable timers plus the Rival's financial incentive to buy the Owner extra time (`challenge_extension`) whenever the Rival believes $p > 0.5$.

---

## 5. Disclosure of Libraries, Templates & AI Tooling (Rule Q-005)

- **Smart Contract:** Rust with `near-sdk` v5.
- **Cross-Chain Signing:** NEAR Chain Signatures MPC (`v1.signer-prod.testnet`).
- **Frontend & Scripts:** React, Vite, TypeScript, `near-api-js`, `viem`.
- **AI Assistance:** Architecture refinement, unit test scaffolding, and documentation assisted by Claude & Gemini.
