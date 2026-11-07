# Web implementation notes

## Scope and direction

This is the user-pinned DESIGN.md implemented as a one-page web surface: an explanatory opening leading into an Operate-mode cockpit. The three-role monolith is the signature interaction; controls remain familiar web buttons, tables, sliders and inputs. Steel ground, actor-specific edges, condensed display typography and a separate outcome stamp preserve the supplied visual authority. No new design system or stretch AI was introduced.

Direction contract: the first viewport pairs the exact English headline with the procedural three-ring monolith and a direct cockpit link. The page then explains the three roles, presents four tabular outcomes, and lets a visitor operate the rules without keys. The same scene follows the hero, mechanism and cockpit anchors. All mechanisms remain readable without WebGL or motion. No direction roll was needed because the user supplied the composition and visual system. Finish verification remains explicitly unperformed under the user's execution prohibition.

## Public setup (not executed)

The supplied runtime is Node 22.15.1. Package engines require Node >=22.12.0. Verified npm metadata pins Vite 7.3.1 and React plugin 5.1.4 (both support >=22.12.0), TypeScript 5.9.3 (>=14.17), Vitest 4.0.18 (supports Node 22), and Node 22.15.1 type definitions. near-api-js is pinned to 6.5.1 instead of 7.4.0, whose Node >=22.22.2 requirement excludes this runtime. The 6.5.1 provider API was checked against its published type declarations. Tailwind's Vite plugin permits Vite 7; its Oxide 4.3.5 engine permits Node >=20. These are metadata/API compatibility checks, not an executed install or build. No lockfile was manufactured. Package scripts provide `dev`, `build`, `test`, `typecheck` and `preview` for a later authorized session.

Local simulation works without configuration and makes no chain requests. Fonts are self-hosted by the three verified Fontsource packages. EN/ID persists as `pog-language` in local storage; blocked storage falls back to session state.

For live reads, copy the public values from `.env.example` into a local configuration file and set `VITE_VAULT_CONTRACT_ID` to a real deployed testnet account. Never add secrets to any `VITE_*` value. The inspector validates the RPC's testnet identity, then uses the verified near-api-js 6.5.1 `providers.JsonRpcProvider.callFunction(contractId, method, args, blockQuery)` view API with final finality. The supplied flat `get_vault_state` response is runtime-validated. Five-second polling runs only in live mode and pauses reads while hidden. A failed read retains the last successful snapshot, its receipt timestamp, and its contract observation timestamp. Countdown is based on the observed chain time, never extrapolated into an unobserved on-chain outcome. No deployed identity or explorer account link is invented.

`VITE_SEPOLIA_RPC_URL` is keyless and public. `sepoliaClient.ts` provides an optional read-only balance utility with a chain-ID check; it is not automatically called. The UI does not infer a derived vault ETH address from the heir recipient, or confuse a stored MPC signature with an Ethereum broadcast.

## Evidence manifest contract

`public/proofs.json` intentionally ships empty:

```json
{ "network": "testnet", "verified": false, "proofs": [] }
```

This is the canonical scripts manifest. The human-operated root demo CLI may write this file when explicitly run. The top-level `network` must be `"testnet"`, `verified` must be a boolean, and `proofs` must be an array. Each proof contains `{ label: string, url: string, createdAt: string, nearTxHash?: string, sepoliaTxHash?: string }`; `createdAt` is a parseable timestamp string. Labels are retained as plain data, while UI link labels remain translated by explorer network. Optional hashes are format-checked, and the hash corresponding to the linked explorer must match its URL. URLs are accepted only in these forms:

- `https://testnet.nearblocks.io/txns/<43-or-44-character-base58-hash>`
- `https://sepolia.etherscan.io/tx/0x<64-hex-characters>`

No credentials, query string, fragment, custom port, lookalike hostname or mainnet link is accepted. Link labels are translated by network, never injected as HTML. Evidence loading begins only in live mode. The manifest is a list of CLI-recorded links, not independent verification of transaction success. Its `verified` field is preserved as script-provided metadata, never promoted into a browser verification claim. The legacy `generated_at`/`transactions` format is rejected. Malformed entries are omitted with an evidence warning; malformed top-level manifests fail the read.

## Simulator and accounting

`vaultSimulator.ts` is a pure bigint transition function with a caller-injected nanosecond clock, checked u64 time addition, checked u128 monetary additions/subtractions, exact deposits and distinct actors. `totalLiability` checked-adds vault assets, locked bonds, withdrawable credits and in-flight payouts, excluding completed withdrawals. Every successful transition verifies that current liabilities equal prior liabilities plus admitted bond deposits minus completed transfers. Overflow rejects atomically without mutating the prior state. `anyone` is a separate outsider identity allowed to finalize but never an alias for Owner, Heir or Rival. Demo values: 120-second heartbeat, 60-second grace, 60-second one-time extension, B = 1 NEAR, 10 NEAR vault assets. The cockpit adds real elapsed monotonic time and explicit time jumps.

Claim eligibility requires `now > last_check_in + heartbeat`. Check-in/challenge require `now < deadline`; finalize requires `now >= deadline`. A challenge adds to the original deadline once. State and outcome are separate. An expired check-in remains attemptable so its rejection can be demonstrated visibly; Finalized check-in is disabled with a reason.

False alarm credits B to Owner; Busted credits 2B to Rival; Uncontested credits B plus vault assets to Heir; Spite backfired credits 2B plus vault assets to Heir. No credit is labeled already sent. Owner withdrawal while Idle moves vault assets to Owner credit. Claim payout starts a simulated in-flight transfer; explicit local success/failure controls model the private callback and credit restoration. Those controls are not public contract methods. ETH release only explains the locked destination and signing deposit; simulation never signs or sends.

## Authored tests and deferred checks

`vaultSimulator.test.ts` authors all four payoff branches, exact deadline, Finalized rejection, early finalize, wrong deposits, role checks (including outsiders), one-time extension, u64/u128 overflow, aggregate-liability overflow, mutation isolation, credit conservation and failed payout retry. It also covers precise decimal parsing and model calculations. `nearClient.test.ts` covers the supplied response shape, canonical evidence schema and URL trust boundary. No test was run.

`sharedVectors.test.ts` consumes the exact shared schema supplied by the main agent: top-level `{ config, cases }`, string nanosecond/yocto amounts, ordered steps with `{ at_ns, actor, call, deposit?, amount?, reject? }`, and expected `{ status, outcome, credits, vault_assets }`. From `web/src/lib/sharedVectors.test.ts`, `new URL('../../../test-vectors/branches.json', import.meta.url)` resolves through `lib -> src -> web -> repository root`. The file is read with Node `fs` only inside the test body when tests are explicitly run. It has not been read in this session; the main agent owns creating it. Missing vectors fail rather than silently skip or fall back. Each rejected step must leave state unchanged; every successful step checks liabilities, and each case checks final state, outcome, all three credits and vault assets. Standalone boundary tests remain alongside this consumer.

The following were explicitly not performed: dependency installation, lockfile generation, test execution, typecheck, build, dev server, visual/browser review, hardware-acceleration-off review, deployment, RPC calls against an actual vault, transaction signing or sending. Tier 1 and Tier 2 are implemented but their design checklist is not claimed green. `?renderer=svg`, reduced motion, keyboard behavior, translated layouts, latest dependency compatibility and static-host paths still need authorized runtime validation. The scene uses one GSAP ticker, vanilla Three, capped DPR, no shadows, procedural geometry and resource cleanup; actual GPU measurements are unverified.

## Attribution handoff

The root README was intentionally untouched. For the competition disclosure, the main agent/human should add React, React DOM, Vite, TypeScript, Tailwind CSS, Three.js, GSAP, Lenis, near-api-js, Phosphor Icons, Fontsource (Big Shoulders Display, Instrument Sans, IBM Plex Mono), Vitest and this AI coding assistance to the root README. No external template, stock image, raster asset or AI advisor was used.
