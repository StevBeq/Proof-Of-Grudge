# Proof-of-Grudge

**Don't trust saints. Arm their rival.**

An adversarial inheritance vault on **NEAR Testnet**, with destination-locked ETH releases on **Ethereum Sepolia** through NEAR Chain Signatures. An heir stakes a bond to claim after a missed heartbeat. A rival must stake the same bond to challenge. Only the owner's timely check-in cancels a claim.

**NEAR Hackathon 2026 · Open Innovation (`open`)**

> **Implementation only, not yet validated.** Source, test suites and integrations have been authored. No application tests, dependency installs, builds, deployment or chain transactions have been run for this implementation, at the user's request. There are no deployed addresses or successful transaction claims here. See [the validation handoff](IMPLEMENTATION_STATUS.md).

## What NEAR does

The Rust contract enforces the claim clock, exact deposits, four payoff branches and separate asset/bond/payout accounting. After Finalized, it constructs a fixed-destination Sepolia EIP-1559 payload and requests a signature from `v1.signer-prod.testnet`. A separate explicit CLI action verifies the recovered signer and relays it to Sepolia. The browser is a keyless simulator and read-only live inspector, not a custodian or signer.

No central server, Bitcoin, custom tokens, multi-heir logic or AI-controlled funds. The optional NEAR AI advisor is **not implemented** and no TEE/privacy attestation is claimed.

## Mechanism

Let **B** be each actor's required bond. A challenge extends the original deadline once; it cannot veto or cancel a claim.

| Outcome | Rival challenged? | Owner checked in before deadline? | Accounted vault assets | Bond credit |
| --- | --- | --- | --- | --- |
| False alarm | No | Yes | Remain Owner's | B to Owner |
| Busted | Yes | Yes | Remain Owner's | 2B to Rival |
| Uncontested | No | No | Credited to Heir | B returned to Heir |
| Spite backfired | Yes | No | Credited to Heir | 2B to Heir |

State is exactly `Idle`, `Pending`, `Challenged`, or `Finalized`. False alarm and Busted return to Idle and reset the heartbeat; outcomes are separate readouts. Claim eligibility is strictly after the heartbeat. At the exact claim deadline, check-in/challenge fail and finalization succeeds.

**Credits are not completed transfers.** Actors call `withdraw_payout` to receive native NEAR; a failed transfer's private callback restores the credit. Owner can move accounted NEAR assets to their credit only while Idle. Locked bonds never come from a calculation of raw account balance.

## Try it: do X, see Y

All results in this section are **expected behavior for the next authorized tester**, not observed passes. First-time dependency installation needs internet. After installation, the local simulator and offline CLI scenarios require no wallet, secrets or chain access.

### 1. Install reviewed dependencies

Prerequisites: Node **22.15.1 or compatible newer version**, Rust **1.99.1**, target `wasm32-unknown-unknown`, and **cargo-near 0.23.0**. Native Rust unit tests also need a working host linker/C++ build toolchain. The installed npm `near` CLI is not used by the implementation.

```sh
npm install
```

Do this -> resolve pinned direct npm dependencies for `contract/`, `scripts/`, and `web/`. Review and retain the generated root `package-lock.json`. There is no fabricated lockfile. Cargo separately fetches near-sdk and the official MPC interface Git dependency on its first invocation.

### 2. Open the bilingual local cockpit

```sh
npm run dev
```

Do this -> open the Vite URL printed by the command. English is default; **EN / ID** switches all interface copy to Indonesian and persists the choice. Big Shoulders Display, Instrument Sans and IBM Plex Mono are self-hosted from Fontsource packages.

In **Local simulation**, advance to the missed heartbeat, act as Heir to initiate a claim, then try Rival's challenge and Owner's check-in. Or advance to the claim deadline and finalize. Inspect the separate state/outcome, bond ledgers, pull-payment credits and simulated failed-transfer restoration. The badge explicitly says this is off-chain simulation. A simulated ETH release does not pretend to sign or transfer assets.

Use `?renderer=svg` for the procedural SVG fallback. Reduced-motion users receive the fallback automatically. No external font requests, wallet or WebGL are required to operate the simulator after loading its assets.

### 3. Rehearse the CLI without a network

```sh
npm run demo -- --dry-run
npm run demo -- --scenario busted
npm run demo -- --scenario inherit
npm run demo -- --scenario spite
npm run demo -- --scenario owner-withdraw --amount 1000000000000000000000000
npm run cli -- --help
```

Do this -> see English, explicitly simulated call transcripts and credit checks. **Omitting `--dry-run` still defaults to offline.** These paths do not read account credentials, sign, send RPC requests or write proof files. CLI fixtures use 5 NEAR; the web uses 10 NEAR, with B = 1 NEAR in each.

### 4. Generate genuine viem reference bytes

```sh
npm run vectors
npm run vectors:check
```

Do this -> generate `contract/vectors/eip1559.generated.json` with pinned viem `serializeTransaction`, then check deterministic byte-for-byte fixture agreement. Inputs include nonce zero, value zero and large u128 amounts. This generator has **not** been executed, so the generated fixture is currently absent. The Rust golden test fails with setup instructions until it exists; no reference bytes are falsely attributed to viem. See [vector provenance](contract/vectors/README.md).

### 5. Execute authored tests and builds when authorized

```sh
npm run test:contract
npm run test:cli
npm run test:web
npm run typecheck
npm run build:contract
npm run build:web
```

Do this -> check contract branches/boundaries/authorization/ledger/callback mocks, shared Rust/TypeScript scenarios, CLI guardrails and RLP references, then compile WASM and the web bundle. After vectors are generated, `npm test` checks the fixture before all three test suites. WASM size must be measured from the actual successful build; it is not known yet.

The Rust build uses `cargo near build non-reproducible-wasm`, preserving ABI generation and wasm optimization. Do not treat direct `testing_env!` unit tests as proof of real gas, storage, private extern wrappers, rollback, cross-contract execution or transfer delivery. Sandbox and testnet verification remain required.

## Live setup (not performed)

A human/operator must first create and fund distinct Owner, Heir and Rival **testnet** accounts, choose the Heir's real EVM address, and create a clean vault account. Initialization must lock the exact actor accounts, 20-byte destination, timers and bond. Initial deployment funding is **operating/storage liquidity**, not automatically inheritable assets. A live contract has not been created or initialized.

For an irrevocable final vault, deploy and init must be batched before removing FullAccess keys, **only after a separately approved review and successful testing**. No deploy or key-deletion command is automated here. Do not remove a key while the implementation remains unverified.

### Public browser configuration

`web/.env.example` documents public settings. Set `VITE_VAULT_CONTRACT_ID` to an actual deployed testnet vault through local Vite configuration. Use trusted, keyless public endpoints. **Never put any secret in `VITE_*`**, as Vite exposes it to browsers.

Select **Live inspector** -> read actual finalized `get_vault_state` snapshots and evidence links every five seconds, with stale/error timestamps on RPC failure. No real vault is configured by default; it shows setup instructions rather than invented data. The web has no signing action.

### Runtime CLI configuration and safeguards

See [`scripts/README.md`](scripts/README.md) for the complete finite workflow and [`contract/README.md`](contract/README.md) for invariants. The CLI consumes explicitly inherited process environment; it **does not load `.env` files**. Human-controlled role keys are read only for explicitly authorized execution, never in offline/view mode or as command-line arguments.

Read-only example after real setup:

```sh
npm run cli -- inspect --read-only --confirm-testnet --vault your-vault.testnet
npm run derive -- --read-only --confirm-testnet --vault your-vault.testnet
```

Do this -> validate the actual RPC's testnet identity and query the configured vault/MPC public key. The derived ETH sender is based on **the vault account** and path `ethereum-1`, not the Heir's NEAR account. Fund the derived sender with a tiny amount of faucet Sepolia ETH, never mainnet assets.

Live writes require `--execute --confirm-testnet`; Sepolia broadcast additionally requires `--broadcast --confirm-sepolia`. Mainnet and implicit CLI actors are rejected. Commands do not deploy, create accounts, reset Finalized vaults or remove keys. Different inheritance scenarios need fresh separate vaults. A deadline check before submission cannot guarantee timely chain inclusion.

ETH flow is **preview -> request -> verify -> relay**. The CLI obtains Sepolia nonce/gas/balance, independently serializes the destination-locked transaction with viem, cross-checks the contract's preimage/hash, requests through the vault, verifies the returned signature recovers the derived sender, and prints the signed transaction hash before an explicitly gated broadcast. No private EVM key exists for this flow. See detailed command examples in the CLI README.

**MPC deposit:** Heir selects an explicit positive `MPC_SIGN_DEPOSIT_YOCTO`. The contract forwards it, but also requires additional unallocated vault operating surplus of at least that amount to guarantee a failure credit without relying on a returned MPC deposit. That surplus is separate from the **1 NEAR operating buffer**, storage staking, vault assets, bonds and payout credits. Source/API references are pinned; compatibility with the currently deployed MPC contract and its gas/deposit configuration still needs verification.

**Evidence:** `web/public/proofs.json` starts empty with `verified:false`. Explicit runtime `--write-proofs` accumulates observed testnet/Sepolia explorer links, not independently verified consensus proofs. There are no real proof links in this repository yet.

## Why this idea might fail

A contract observes missed check-ins, **not death**. The mechanism is a conditional timer backed by economic incentives, not a proof that a human has died.

- **Sybil collusion:** different account IDs do not prove different people. One person controlling Heir and Rival defeats the intended adversarial independence.
- **Lost Heir key:** loss after Owner becomes unavailable can permanently prevent access; there is no admin recovery.
- **Offline living Owner:** a legitimate Owner can miss both windows. Rival buys time only if willing to stake a bond.
- **Undersized bonds:** a small potential penalty compared with a large vault is a weak deterrent. Rational behavior is an assumption, not contract enforcement.
- **Compromised Owner key:** an attacker can prolong check-ins. It is an authorization key, not a proof of life.
- **Cross-chain blindness:** NEAR cannot inspect Sepolia balance/nonce/fees or guarantee broadcast. Requests can become stale; a stored signature is not a receipt.
- **Repeated signatures:** a new stored signature cannot revoke an earlier one. Same-nonce transactions compete; different-nonce transactions can both execute if funded, always to the same locked recipient.
- **Operational reserve:** failure credits need pre-funded surplus. Native callbacks themselves can fail if gas/storage is insufficient; no unsafe admin escape hatch is provided.
- **ETH Owner exit:** this MVP's living-owner withdrawal is NEAR-only. ETH at the derived address is releasable only after inheritance finalization. Do not treat this demo as a production custody system.

### Comparison by mechanism, not unverified competitor claims

| Mechanism | Passive timelock | Free guardian veto | Proof-of-Grudge |
| --- | --- | --- | --- |
| Challenge cost | No challenge | Often none | Rival stakes B |
| Can watcher cancel alone? | No watcher | Yes by design | No, only timely Owner check-in |
| Hostile delay cost | Not applicable | No bond requirement | Rival loses B to Heir if Owner does not return |
| Honest challenge incentive | Not applicable | External/altruistic | Rival's net gain +B if Owner returns in time |

Earlier planning mentioned Aegis, Handover and near-policy-vault. Their deployed behavior has **not** been independently verified here; this table makes no factual claim about those particular products or uniqueness of our idea.

### Economic model

For a risk-neutral Rival with subjective probability p that Owner checks in before the extended deadline:

`EV(challenge) = pB - (1-p)B = (2p-1)B`.

The simplified recommendation for deterring a speculative Heir claim, with vault value A and Owner-return probability q, is `B >= A(1-q)/q`, q > 0. At A = 100 and q = 90%, B >= 11.11 in the same value unit. These models ignore gas, capital costs, varying asset prices, collusion and uncertainty. They do not prove safety. The contract does not consume p/q, an oracle or AI output.

## Repository map

```text
contract/          Rust vault, official MPC interface, RLP encoder and authored tests
contract/vectors/  viem source inputs/generator; generated fixture pending
scripts/           offline-default CLI and explicit live request/relay workflows
web/               EN/ID simulator and read-only inspector, Three/SVG scene
test-vectors/      shared payoff/deadline fixtures used by Rust and web tests
IMPLEMENTATION_STATUS.md  exact validation boundary and next-AI handoff
```

## Libraries, templates and AI disclosure (Q-005)

- **Rust:** near-sdk 5.30.1 and the official `near-mpc-contract-interface` from `near/mpc` at commit `d0fc87b19e2643299e7becdd7d9611afcd5d5a78`. Manifest/profile adapted from cargo-near 0.23.0's embedded template; source links and deviations in the contract README. Rust dependencies have not yet been resolved into a lockfile.
- **CLI:** TypeScript, tsx, near-api-js 6.5.1, viem, @noble/curves, bs58 and Node standard library. No existing application template or live account credentials included.
- **Web:** React/React DOM, Vite, TypeScript, Tailwind CSS, vanilla Three.js, GSAP, Lenis, Phosphor Icons and near-api-js. Fonts: Fontsource Big Shoulders Display, Instrument Sans and IBM Plex Mono. Vitest and Node's test runner are used in authored tests. Packages and exact direct versions are listed in the workspace manifests; transitive lockfiles await authorized installation.
- **Vector reference:** pinned viem 2.38.5; CLI uses pinned viem 2.57.16. The fixture generator verifies its actual installed version. Separate pins are deliberate and must not be silently substituted.
- **AI assistance:** prior architecture/documentation work disclosed Claude and Gemini. This implementation, authored tests, interface research, documentation and frontend were assisted by OpenAI GPT-6.1 Sol in Zed with delegated coding agents and the Impeccable design skill. NEAR Docs MCP/public source retrieval was used to verify APIs. Generated code remains unaudited and untested until the handoff is completed.
- **Assets:** procedural geometry/SVG, no stock imagery, external image generation, or copied commercial site design. The UI follows the repository's pre-existing visual brief.

## Before submission

The documented deadline is **14 November 2026, 23:59 UTC** (15 November, 06:59 WIB); check [the live rules](https://nearhackathon.com/HACKATHON.md) again before submitting.

- [ ] Resolve/review dependencies and retain lockfiles; generate genuine viem fixtures.
- [ ] All authored tests, typechecks, native/WASM/web builds and browser review pass.
- [ ] Sandbox and live testnet/Sepolia flows have genuine successful receipt evidence.
- [ ] Public repository and reproducible README reviewed, license and AI/library disclosures complete.
- [ ] Record a real demo video (target ~60 seconds); the human publishes the public X post mentioning NEAR Hackathon, @NEARProtocol and #NEARHackathon.
- [ ] Human-created NEAR Mainnet payout address and submission details confirmed.
- [ ] Human approves the exact payload; submit once only. Use request-changes for corrections.

No repository publication/push, X post, mainnet action or competition submission has been performed by this implementation.
