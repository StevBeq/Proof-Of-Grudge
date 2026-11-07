# Proof-of-Grudge CLI

Implementation only. **No install, test, typecheck, build, CLI invocation, signing, deployment, or transaction was run while authoring these files.** Existing `.env` files and keys were not read. Live compatibility remains unverified.

This directory is self-contained TypeScript. Nothing here deploys, initializes a vault, creates accounts, deletes keys, resets Finalized state, or accesses mainnet. The CLI language is English.

## Entrypoints and root integration

Targets **Node 22.15.1** (manifest minimum `>=22.15.1`) with **`near-api-js@6.5.1`**, **TypeScript 5.9.3**, and **`tsx@4.23.15`** (declares Node >=18). These versions were checked against published metadata/source, not installed or executed.

- `run-demo.ts`: default `demo` command.
- `derive-eth-address.ts`: default `derive` command.
- `cli.ts`: all commands.
- `scripts.test.ts`: authored offline/mocked tests, not executed.

The root package owner should wire `demo` to `tsx scripts/run-demo.ts` and optionally `cli` to `tsx scripts/cli.ts`. No root manifest was modified. Alternatively, the commands below use the local `scripts/package.json`. Dependencies must first be made available by the human/root integration process; these instructions do not imply they are installed.

## Zero-network rehearsal

From the repository root, after dependencies are available:

```sh
npm --prefix scripts run demo -- --dry-run
npm --prefix scripts run demo -- --scenario false-alarm
npm --prefix scripts run demo -- --scenario busted
npm --prefix scripts run demo -- --scenario inherit
npm --prefix scripts run demo -- --scenario spite
npm --prefix scripts run demo -- --scenario owner-withdraw --amount 1000000000000000000000000
npm --prefix scripts run cli -- --help
```

Do this -> see a transcript marked `Simulated: off-chain state machine`, exact yoctoNEAR ledger/credit checks, and simulated payouts. There are **zero RPC requests, no environment reads by the command path, no credential-file access, no signatures, and no proof writes**. Omitting `--dry-run` is equally offline. Every network-capable command defaults to a plan/fixture, never execution.

The fixture starts with 5 NEAR of accounted vault assets and B = 1 NEAR. Times are an injected nanosecond clock, not wall-clock sleeps. These are synthetic values, not deployed balances, MPC quotes, or chain evidence. The offline simulator assumes immediate successful payouts: `payouts_in_flight` remains `{owner:'0',heir:'0',rival:'0'}` in the default fixture/scenarios. It does not model asynchronous native-transfer receipts, failed-payout refunds, or payout callbacks.

| Scenario | Calls after missed heartbeat | New credit, then `withdraw_payout` | End state |
| --- | --- | --- | --- |
| `false-alarm` | Heir claim, Owner check-in | B to Owner | Idle / FalseAlarm |
| `busted` | Heir claim, Rival challenge, Owner check-in | 2B to Rival | Idle / Busted |
| `inherit` | Heir claim, deadline, finalize | B + vault to Heir | Finalized / Uncontested |
| `spite` | Heir claim, Rival challenge, extended deadline, finalize | 2B + vault to Heir | Finalized / SpiteBackfired |
| `owner-withdraw` | Owner withdraw ledger amount while Idle | Amount to Owner | Idle, previous outcome preserved |

Existing recipient credits, if any, are also withdrawn by the scenario. Output distinguishes prior credits from the new payoff.

## Explicit network gates

There are no interactive prompts. Confirmation flags authorize the finite command; omit them if you do not authorize that action.

| Flags | Allowed behavior |
| --- | --- |
| None / `--dry-run` | Offline only |
| `--read-only --confirm-testnet` | RPC views for `inspect`, `derive`, `preview-eth`; no keys/signing |
| `--execute --confirm-testnet` | NEAR state-changing workflows; `relay-eth` only prepares unless broadcast flags are present |
| Above plus `--broadcast --confirm-sepolia` | Sepolia broadcast, only for `relay-eth` / `release-eth` |
| Above plus `--write-proofs` | Append observed transaction links at runtime |

Conflicting flags fail closed, including `--dry-run --read-only`. `--execute` is forbidden on read-only commands. `--write-proofs` is forbidden offline. Named `.testnet` accounts only: mainnet and implicit accounts are deliberately unsupported, even if a testnet implicit account might otherwise work.

Before network actions the CLI checks the RPC's actual NEAR `chain_id` is `testnet`, and checks Ethereum `eth_chainId` is `11155111`. HTTPS is required. A malicious RPC can lie; these checks are not independent consensus proofs. Do not supply untrusted endpoints.

## Runtime configuration, never dotenv

**The CLI never loads `.env`, even in execute mode.** `scripts/.env.example` documents names only, with blank signing keys and deposit. Have a human export the variables into the inherited process environment, or inject them through an existing secret manager. Merely creating or copying an `.env` file does not configure this CLI. Never paste keys into command arguments, tracked files, screenshots, or public logs.

Public values:

| Variable | Purpose/default |
| --- | --- |
| `VAULT_CONTRACT_ID` | Existing, initialized `.testnet` vault; required for live commands |
| `NEAR_RPC_URL` | `https://rpc.testnet.near.org` |
| `SEPOLIA_RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` |
| `OWNER_ACCOUNT_ID`, `HEIR_ACCOUNT_ID`, `RIVAL_ACCOUNT_ID` | Must match the vault role being used |

Signing values, read **only during explicit execute preflight**:

- `OWNER_PRIVATE_KEY`, `HEIR_PRIVATE_KEY`, `RIVAL_PRIVATE_KEY`: `ed25519:` keys, only for required roles. They must already be registered FullAccess keys on the funded **actor** accounts, never the vault. Restricted function-call and gas keys are intentionally not supported by this CLI. No key is generated or deleted.
- `MPC_SIGN_DEPOSIT_YOCTO`: positive canonical decimal yoctoNEAR, explicitly selected by the user for `request-eth` / `release-eth`. **There is no assumed live MPC fee.** Upstream currently declares `SIGN_DEPOSIT_YOCTONEAR = 1`, but neither the live deployment nor its fee was queried. Older architecture text suggesting ~0.05 NEAR is not a quote either.

Public configuration flags `--vault`, `--near-rpc`, `--sepolia-rpc` override the corresponding public environment variables. RPC URLs may contain provider tokens; the CLI does not print URLs or external error bodies. Providers receive public account IDs, view args, and signed transactions; they do not receive private keys. RPC usage may incur provider quotas or costs. Blockchain actions spend testnet gas/deposits and are publicly visible.

## Inspect and derive

```sh
npm --prefix scripts run cli -- inspect --read-only --confirm-testnet --vault your-vault.testnet
npm --prefix scripts run derive -- --read-only --confirm-testnet --vault your-vault.testnet
```

Inspect -> see validated flat `get_vault_state` output, distinct contract status/outcome, and the RPC block timestamp. State and timestamp are read at the same finalized NEAR block: SDK v6 uses positional `provider.callFunction(contractId, method, args, {blockId: hash})`, which maps `blockId` to wire-level `block_id`. Signature bodies are replaced by a presence marker in inspect output. The snapshot requires `payouts_in_flight: {owner,heir,rival}` as canonical unsigned decimal-string yoctoNEAR amounts; missing or malformed role amounts are rejected, not defaulted to zero.

Derive -> query **only**:

```json
{
  "contract": "v1.signer-prod.testnet",
  "method": "derived_public_key",
  "args": {
    "path": "ethereum-1",
    "predecessor": "your-vault.testnet",
    "domain_id": 0
  }
}
```

The view returns `secp256k1:base58`. Decode exactly 64 public-key bytes using `bs58`, prefix the uncompressed SEC1 byte `04`, validate the curve point with `@noble/curves`, and call viem `publicKeyToAddress`. **The predecessor is always the vault, never the human Heir/Owner/Rival.** No human MPC signing request is used for derivation.

For offline conversion of an already obtained public key, use `derive --public-key` followed by that public key as its value. It does not establish that the key belongs to a particular vault. Without a key and without network flags, derive prints the view plan, not an invented address.

## Live NEAR scenarios

Prerequisites, prepared separately by a human:

1. A deployed and initialized vault with distinct actors and a locked heir ETH address.
2. Appropriately funded actor accounts and runtime signing credentials for the selected scenario.
3. For meaningful inheritance, accounted vault deposits made through `deposit_vault`, not plain transfers. Storage reserve and bonds are not inferred from the raw account balance.
4. A grace period long enough for real finalized transactions. The CLI cannot guarantee an Owner check-in will be included before a short deadline.

```sh
npm --prefix scripts run cli -- deposit --amount 5000000000000000000000000 --execute --confirm-testnet
npm --prefix scripts run demo -- --scenario false-alarm --execute --confirm-testnet
npm --prefix scripts run demo -- --scenario busted --execute --confirm-testnet
npm --prefix scripts run demo -- --scenario owner-withdraw --amount 1000000000000000000000000 --execute --confirm-testnet
```

Do this -> sign only the displayed role/method with exact contract bond deposits, print transaction explorer links, check payoff credit deltas, call `withdraw_payout`, and check final receipts/remaining credits. Owner withdrawal is **two steps**: `owner_withdraw_near({amount})` credits the owner; `withdraw_payout()` transfers it.

For each inheritance branch, point at a **fresh separate vault**:

```sh
npm --prefix scripts run demo -- --scenario inherit --execute --confirm-testnet --vault your-inherit-vault.testnet
npm --prefix scripts run demo -- --scenario spite --execute --confirm-testnet --vault your-spite-vault.testnet
```

Do this -> wait for a strictly missed heartbeat (`now > last_check_in + interval`), post exact B, optionally challenge once, wait for the current deadline, finalize, verify accounting and withdraw Heir's NEAR credit. **ETH release is a separate opt-in command. Finalized cannot be reinitialized.** The CLI will refuse to reset or reuse it for another scenario.

`--timeout-seconds 600` bounds each chain-time wait (1..3600 seconds). Eligibility is based on RPC `timestamp_nanosec`, never the local clock. Local monotonic elapsed time bounds the wait; the entire CLI also has a wall-time watchdog. Ordinary NEAR RPC calls are bounded to 30 seconds, NEAR submission/MPC callbacks to 120 seconds. Provider `retries: 1` means **one total HTTP attempt** in the verified v6 provider. The non-legacy `Account.signAndSendTransaction` has no retry option or automatic nonce re-signing loop; the legacy method, which retries and logs failures, is never used. viem transport retries are zero. A timeout is not proof that submission failed.

If a command times out or a receipt fails, do **not** rerun a scenario blindly. A sent transaction may still finish. Inspect state and the printed explorer links. Active claims are not automatically canceled or resumed by `demo`.

To withdraw existing credits separately (including reserve-backed credits for failed MPC requests):

```sh
npm --prefix scripts run cli -- withdraw-payout --role heir --execute --confirm-testnet
```

This is an explicit transfer command, not an automatic retry mechanism.

## ETH release: preview -> request -> recover -> relay

Offline preview, no configuration or network needed:

```sh
npm --prefix scripts run cli -- preview-eth --dry-run --to 0x1111111111111111111111111111111111111111 --nonce 0 --value-wei 1 --max-fee-per-gas 2 --max-priority-fee-per-gas 1 --gas-limit 21000
```

Do this -> see unsigned EIP-1559 bytes and Keccak-256 hash. Defaults are explicitly illustrative, not live fees or funded destinations. Nonces above JavaScript's safe-integer range are rejected, not rounded.

For a **Finalized** live vault whose derived Sepolia address is already funded:

```sh
npm --prefix scripts run cli -- preview-eth --read-only --confirm-testnet --value-wei 1000000000000000
npm --prefix scripts run cli -- request-eth --execute --confirm-testnet --value-wei 1000000000000000
npm --prefix scripts run cli -- relay-eth --execute --confirm-testnet
npm --prefix scripts run cli -- relay-eth --execute --confirm-testnet --broadcast --confirm-sepolia
```

1. Read vault state and derive the sender using the vault predecessor.
2. Query Sepolia pending nonce and balance, estimate EIP-1559 fee caps and gas, adding a 20% gas-limit buffer rounded upward. Reject buffered gas outside **21000..1000000**, nonpositive max/priority fees, or priority above max; do not silently clamp estimates. Require sufficient balance for value + gas limit x maximum fee. The value is explicit wei; there is no automatic sweep, ETH funding, or ETH private key.
3. Build `0x02 || RLP([11155111, nonce, priorityFee, maxFee, gasLimit, lockedHeirAddress, value, 0x, []])` using viem. Live commands reject destination/nonce/fee/gas/public-key overrides. The locked recipient is not supplied by the operator.
4. Call `preview_eth_release` with decimal-string `nonce`, `value_wei`, `max_fee_per_gas`, `max_priority_fee_per_gas`, `gas_limit`. Require both `unsigned_tx_hex` and `payload_hex` to match local bytes/hash exactly (optional hex prefix/case normalized).
5. Only Heir calls **the vault** `request_eth_release` with the same args, configured MPC deposit, and **300 Tgas**. The CLI never calls MPC `sign` directly. The vault owns the path/chain/destination constraints. CLI preflight requires all three `payouts_in_flight` amounts to be zero, otherwise it stops with `Settle all payouts before MPC signing`. The contract independently rejects **any unresolved native payout**, even one belonging to another role. A failed native payout's refund receipt can reach the vault before its callback restores the corresponding credit; that temporary raw balance is not safe operating surplus. Inspect until every payout callback has settled before explicitly requesting MPC signing; the CLI does not automatically settle payouts or retry signing. This guard applies to initial and repeated requests, not read-only preview or relay of an already signed release. Before forwarding, the contract requires **additional operating surplus of at least the attached MPC deposit** for the failure-credit reserve, separate from storage, accounted assets, bonds, existing credits, and other liabilities. Allow headroom for gas/storage as well. A plain testnet transfer for operating surplus is distinct from `deposit_vault`, which increases accounted assets; this CLI does not automate surplus funding or infer spendable reserve from raw balance. No reserve-availability view is exposed, so the contract enforces this requirement. Do not assume an asynchronous MPC failure refunds its deposit.
6. Parse the final JSON callback. Success must be `{success:true,release:EthRelease,refund_credited:'0'}`; it replaces the stored release. Failure must be `{success:false,release:null,refund_credited:attachedDeposit}`; it preserves the previous stored release and credits Heir from the upfront reserve. Re-read state, check signing has settled, and verify failure preserved the prior release. Report a credit, **not a confirmed transfer or presumed MPC refund**, then stop for manual inspection/withdrawal. On success cross-check callback bytes and all stored release args.
7. Validate MPC point/scalars and recovery ID, normalize high-s with parity flip, recover the signer from the payload hash, require it equals the derived sender, serialize the signed transaction, and **print its hash before any broadcast**.
8. `relay-eth` reads the stored release without any NEAR key. With the extra broadcast gates, recheck Sepolia chain/nonce/balance/base fee and re-read the NEAR release to reject superseded bytes. Broadcast once and wait at most 120 seconds for one successful confirmation. One confirmation is not consensus finality.

`release-eth --execute --confirm-testnet --value-wei ...` combines request and signature verification. It still does **not** broadcast unless both `--broadcast --confirm-sepolia` are supplied. `request-eth` never accepts broadcast flags. Use `relay-eth` to inspect/relay a stored release without paying another MPC deposit. An explicit new `request-eth` or `release-eth` is allowed even when `eth_release` exists, provided the vault is Finalized, the prior signing callback has settled, and all native payouts have settled; it charges a new user-configured deposit. A successful callback overwrites the stored release; a failed one leaves it intact.

**Overwriting `eth_release` cannot revoke any earlier valid signature.** All requests remain locked to the same recipient and Sepolia chain. Transactions with the same nonce compete; transactions with different nonces may **both execute if funded**. Explicit repeat requests can refresh stale fees/nonces after a callback, but are not cancellation. Review every prior signature and public transaction before authorizing another request. No automatic replacement, repeated signing, or replay is performed.

Nonce contention, stale fees, MPC delays, Sepolia contract-recipient behavior, and reorgs remain possible. A timeout after broadcast can leave a pending/mined transaction; retain its printed hash and inspect before retrying. Pending-nonce preflight deliberately fails closed when an earlier transaction is already pending; it is not a mempool replacement tool.

### Verified upstream wire formats

Current `near-mpc-contract-interface` `SignArgs` wraps `SignRequestArgs` under `request`. The canonical upstream request is:

```json
{"request":{"path":"ethereum-1","payload_v2":{"Ecdsa":"32-byte hash as 64 hex characters without 0x"},"domain_id":0}}
```

This is a schema description, **not a direct MPC command**. No `key_version` is generated.

**Important correction:** current upstream `SignatureResponse` has `#[serde(tag = "scheme")]`. The accepted tagged form is:

```json
{"scheme":"Secp256k1","big_r":{"affine_point":"33-byte compressed point hex"},"s":{"scalar":"32-byte scalar hex"},"recovery_id":0}
```

The verified inner `K256Signature` omits `scheme`; that untagged form is also accepted. The guessed externally-tagged `{"Secp256k1":{...}}` form, Ed25519, arrays, and unknown fields are rejected. EVM only supports recovery parity 0/1 here; recovery IDs 2/3 are rejected rather than truncated. No live deployment's response shape was sampled.

## Proof-file handoff to frontend/root agents

Only explicit runtime `--write-proofs` writes `web/public/proofs.json`. No file outside `scripts/**` was authored during implementation. The web public directory must already exist.

```json
{
  "network": "testnet",
  "verified": false,
  "proofs": [
    {
      "label": "heir: finalize_inheritance",
      "nearTxHash": "base58 transaction hash",
      "url": "https://testnet.nearblocks.io/txns/base58 transaction hash",
      "createdAt": "ISO-8601 timestamp"
    }
  ]
}
```

This is schema documentation, not real evidence. Sepolia entries instead have `sepoliaTxHash` and a `https://sepolia.etherscan.io/tx/...` URL. Each entry identifies exactly one chain. Existing entries accumulate and duplicate hashes are skipped. An exclusive lock plus temporary-file/rename prevents partial overwrite. An incompatible existing schema (including a bare array) is rejected, never erased. `verified:false` is deliberate: these are RPC-observed links, not independent cryptographic consensus proofs. A successful NEAR request transaction does not prove a successful MPC signature; inspect its callback. Sepolia links are appended only after a successful receipt. Proof-file failure never triggers transaction replay.

## Authored checks, not executed

The following are **available for later human authorization**, not commands run by this implementation:

```sh
npm --prefix scripts test
npm --prefix scripts run typecheck
```

Coverage authored: five scenario ledgers; strict heartbeat; exact bonds; once-only challenge; exact/late deadline; Finalized rejection; owner withdrawal credit versus transfer; default offline commands; flag conflicts; bounded integer validation; redacted error messages/stacks/causes; repeated-release request preflight; callback success/failure shapes and full failure credit; gas/fee boundaries; mock RPC network refusal; SDK one-attempt/blockId semantics; vault-predecessor MPC view; fixed EIP-1559 RLP bytes; locked chain/data/access list; derived public key conversion; tagged/untagged signature recovery, high-s normalization and invalid recovery IDs; proof-schema validation.

The RLP reference test is viem-backed and includes a fixed hand-audited byte vector. It is **not a claim that the Rust contract's golden-vector test has run or passed**. The contract/root owner should compare `eth_rlp.rs` against the same viem reference and coordinate shared root vectors. No root test vectors were modified in this scripts-only task.

## Pinned dependencies and attribution

Versions were fetched from npm registry metadata, not invented. Direct dependencies are pinned, but no lockfile was generated because install was prohibited; transitive resolution is not yet locked.

| Package | Version | Use |
| --- | --- | --- |
| `near-api-js` | 6.5.1 | Node 22.15.1-compatible published v6 Account/KeyPairSigner and provider/transaction namespaces |
| `viem` | 2.57.16 | EIP-1559 serialization, Keccak, sender recovery, Sepolia RPC |
| `@noble/curves` | 1.9.1 | Public curve-point validation; matches viem's curve version |
| `bs58` | 6.0.0 | Decode MPC public keys |
| `tsx` | 4.23.15 | TypeScript execution/test loader |
| `typescript` | 5.9.3 | TypeScript compiler; declares Node >=14.17 |
| `@types/node` | 22.19.0 | Node API types |

Source URLs consulted:

- https://docs.near.org/llms.txt
- https://docs.near.org/tools/near-api
- https://docs.near.org/integrations/create-transactions
- https://docs.near.org/chain-abstraction/chain-signatures
- https://docs.near.org/chain-abstraction/chain-signatures/implementation
- https://raw.githubusercontent.com/near/mpc/main/crates/near-mpc-contract-interface/src/call_args.rs
- https://raw.githubusercontent.com/near/mpc/main/crates/near-mpc-contract-interface/src/deposits.rs
- https://raw.githubusercontent.com/near/mpc/main/crates/near-mpc-crypto-types/src/sign.rs
- https://raw.githubusercontent.com/near/mpc/main/crates/near-mpc-crypto-types/src/primitives.rs
- https://raw.githubusercontent.com/near/mpc/main/crates/near-mpc-crypto-types/src/crypto.rs
- https://unpkg.com/near-api-js@6.5.1/lib/index.d.ts
- https://unpkg.com/near-api-js@6.5.1/lib/index-BDdRUK93.d.ts
- https://unpkg.com/near-api-js@6.5.1/lib/transaction-C81hWIM7.d.ts
- https://unpkg.com/@near-js/accounts@2.5.1/lib/esm/account.d.ts
- https://unpkg.com/@near-js/accounts@2.5.1/lib/esm/account.js
- https://unpkg.com/@near-js/providers@2.5.1/lib/esm/json-rpc-provider.d.ts
- https://unpkg.com/@near-js/providers@2.5.1/lib/esm/json-rpc-provider.js
- https://unpkg.com/@near-js/providers@2.5.1/lib/esm/fetch_json.js
- https://unpkg.com/@near-js/signers@2.5.1/lib/esm/key_pair_signer.d.ts
- https://viem.sh/docs/utilities/serializeTransaction
- https://viem.sh/docs/utilities/recoverAddress
- https://registry.npmjs.org/near-api-js/6.5.1
- https://registry.npmjs.org/viem/latest
- https://registry.npmjs.org/bs58/latest
- https://registry.npmjs.org/@noble%2fcurves/1.9.1
- https://registry.npmjs.org/tsx/4.23.15
- https://registry.npmjs.org/typescript/5.9.3
- https://registry.npmjs.org/@types%2fnode/22.19.0

Verified v6 usage: `Account` and `KeyPairSigner` are top-level exports; `JsonRpcProvider` comes from `providers`, and `functionCall` from `transactions`. Construct `new Account(accountId, provider, signer)`, use positional provider view methods, and submit with `waitUntil:'FINAL', throwOnFailure:false`. No v7-only object-style provider calls or account retry options are used.

AI assistance: authored with the Zed coding agent (GPT-6.1 Sol). No external project template was copied. The root README owner must also list these libraries and AI use for competition disclosure Q-005; this task intentionally did not edit the root README.

## Unverified boundaries

- These sources/tests have not been executed or typechecked. No live NEAR or Sepolia RPC, MPC fee, deployed contract code, account key, balance, callback, or transaction was verified.
- The CLI targets the flat contract API supplied for this task, including pull-payment credits. A deployment with a different API fails validation rather than being guessed compatible.
- Upstream `main` MPC source can change; consulted blob IDs include `primitives.rs` `80885af0a0774b62f7168f4a8354744a7e92e46c` and `sign.rs` `847225699f6dc8a84a89edae7e441694da087519`. Reconfirm the deployed version before authorizing funds.
- An initialized, funded contract and manual testnet setup are external prerequisites. No deployment or key-deletion automation is provided.
- External failures are intentionally summarized without raw exception messages/stacks. Use public explorer hashes and read-only inspection for diagnosis, not secret-bearing RPC logs.
