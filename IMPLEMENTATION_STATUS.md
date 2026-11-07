# Implementation handoff

## Execution boundary

The user requested **implementation only**, with validation delegated to another AI. No application test, typecheck, build, lint, dependency install, vector generator, application CLI, preview server, deployment, transaction signing, key removal, publication or submission was run for this implementation. Existing `.env` and key files were not opened. Sources and documentation were read to verify public interfaces; the design-context loader was the only design setup utility used.

Consequently, this repository is **not yet validated or submission-ready**. Implemented source is not proof of operational correctness. Do not report tests passed, live transfers, deployment addresses, WASM size, generated viem agreement or a reviewed browser screenshot.

## Implemented

- Rust SDK 5.30.1 contract: exact-bond four-branch state machine, distinct actors, predecessor authorization, checked timestamps, explicit asset ledger, Idle owner withdrawal, pull-payment callbacks, MPC request/result integration.
- Destination-locked Sepolia EIP-1559 serialization, canonical interface dependency pinned to official MPC source revision, serialized preview and callback failure-credit reserve.
- Authored Rust unit tests and shared contract/frontend vectors.
- Pinned viem fixture inputs/generator and a golden test which fails loudly until the actual fixture is generated.
- English offline-default CLI, explicit Testnet/Sepolia execution flags, public derivation, scenarios, payout, request/recover/relay, optional accumulation of proof links.
- English-default web with persisted Indonesian toggle, self-hosted Big Shoulders Display / Instrument Sans / IBM Plex Mono, procedural three-role monolith and SVG/reduced-motion fallback, bigint simulator, live read-only inspector, payout matrix, EV and bond sizing.
- English README, contract and CLI security explanations, root workspace commands and MIT license.

## Start here for the validation AI

The commands below are instructions, not a record of execution. Obtain authorization for installation and test execution first; do not read or print secrets.

1. Check the public package manifests and host tools. Node target is 22.15.1; use Rust 1.99.1 and cargo-near 0.23.0. The official MPC Git dependency and npm transitive dependencies remain unresolved. Review native Windows linker/C++ tooling and upstream dependency platform compatibility first.
2. `npm install` at the root resolves all three workspaces. Review/preserve package-lock.json. No lockfile was invented.
3. `npm run vectors` writes genuine viem output; `npm run vectors:check` detects drift. Commit the generated fixture only after independently reviewing it. It is currently absent by design.
4. `npm run test:contract` resolves Cargo dependencies and creates Cargo.lock, then exercises unit tests. Retain the lockfile: .gitignore no longer excludes it. Do not claim on-chain rollback/private wrapper coverage from direct method calls.
5. `npm run test:cli`, `npm run test:web`, `npm run typecheck`, then `npm run build:contract` and `npm run build:web`. Report actual results and measure WASM only after success. Fix root causes rather than deleting tests/features to silence failures.
6. Browser review at mobile/desktop sizes; EN and ID; keyboard; blocked localStorage; reduced motion; `?renderer=svg`; unavailable WebGL; live RPC failures and stale snapshots; malformed proof manifests; no private values in browser configuration/bundle.
7. Local Sandbox tests must cover extern-wrapper guards, storage and gas, actual native-transfer failure/result callbacks and MPC-success/failure/timeout mocks. Unit mocks do not establish these.
8. Only after new explicit human approval: create/fund human-controlled testnet actors and separate clean vaults, verify the live MPC API/config, batch deploy+init, run all live scenarios, derive/fund Sepolia vault, request signature, recover sender, broadcast tiny test ETH, record successful receipt links.
9. Removing vault FullAccess keys is irreversible and has not been automated or performed. Audit the exact deployed code, init actors/timers/destination and pull-payment/live release proofs before the human authorizes final lock-down. No deploy command exists in this scaffold.

## Integration contracts

- Public snapshot: `get_vault_state` uses `{state:{status,...}}`, decimal strings for integers, `last_outcome`, `credits`, `payouts_in_flight`, `signing_in_flight`, and last `eth_release`. See `contract/src/lib.rs`.
- FalseAlarm/Busted reset to Idle; Busted is never a fifth contract state.
- Owner withdrawal credits first; `withdraw_payout` transfers separately.
- The web never signs. Operational live actions happen through separately authorized CLI commands.
- Canonical proof file: `{network:"testnet",verified:false,proofs:[...]}`; it is currently empty. `verified:false` distinguishes observed links from independent finality proofs.
- CLI configuration is inherited process environment, not automatic dotenv loading. Web VITE variables are public only. Account/address/deposit setup is pending, not fabricated.
- Repeated MPC requests are possible; prior signatures cannot be revoked. Failure credits are backed by additional operational surplus, not assumed returned MPC deposits. New signing is blocked until all native payout callbacks settle, preventing a returned-but-unresolved payout from being counted as surplus. Promise-result reads are bounded before allocation.

## Deferred / absent

Actual validation results, Cargo/npm lockfiles, generated viem fixture, contract/actor accounts, confirmed recipient address, testnet/Sepolia funding, deployed contract, transaction evidence, hosted demo, video, public X post, verified payout address and competition submission. NEAR AI Advisor is intentionally excluded from the MVP; no AI API key, AI backend or privacy/TEE claim is present.

## Submission gate

Before submission, read the live competition rules again. Complete public repository/license/disclosure/reproducibility checks, real video post tagging @NEARProtocol and #NEARHackathon, human-created NEAR Mainnet payout address and exact confirmed submission payload. Submit once only; corrections use request-changes. No visibility change, push, post or submission is authorized by implementation-only approval.
