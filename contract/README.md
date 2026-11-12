# Vault contract

**Locally tested and deployed on NEAR Testnet.** All 41 unit tests and the viem golden-vector test pass; WASM and embedded ABI build successfully. All four native payoff branches and an Idle owner withdrawal have executed with successful payout receipts. Live MPC signing (NEAR Testnet) and Sepolia release (Ethereum Sepolia) have executed and are verified on-chain. See [Testnet evidence](../scripts/TESTNET.md).

## Source and toolchain

The manifest/release profile is adapted from the [official cargo-near 0.23.0 template](https://github.com/near/cargo-near/blob/cargo-near-v0.23.0/cargo-near/src/commands/new/new-project-template/Cargo.template.toml). Its automatic nested Git repository, initial commit, deployment workflows and Sandbox example were deliberately not generated. SDK is pinned to `near-sdk = 5.30.1`, using `#[near(contract_state)]`, `#[near]`, and `unit-testing` in dev-dependencies and the ABI-only native build; it is not enabled for on-chain WASM. The toolchain uses the user's installed Rust 1.99.1, not the template's 1.95.0 pin. The reproducible-image metadata is copied verbatim from the template and has not been exercised.

Official references read before implementation:
- https://docs.near.org/llms.txt
- https://docs.near.org/smart-contracts/what-is
- https://docs.near.org/smart-contracts/quickstart
- https://docs.rs/near-sdk/5.30.1/near_sdk/
- https://docs.near.org/smart-contracts/testing/unit-test
- https://docs.near.org/chain-abstraction/chain-signatures
- https://docs.near.org/chain-abstraction/chain-signatures/implementation

## State, clocks and actors

`Idle -> Pending -> Challenged -> Finalized`, or `Pending/Challenged -> Idle` on a timely owner check-in. Challenge is optional and once per claim. FalseAlarm and Busted are outcomes, not states. Both reset `last_check_in_ns` and return to Idle. A subsequent idle check-in leaves the most recent outcome visible.

- Claim requires **strictly** `now > last_check_in + heartbeat_interval`.
- Check-in and challenge require `now < deadline`.
- Finalization is permissionless at `now >= deadline`.
- Finalized is terminal for claims/check-in/owner withdrawal, but credits remain withdrawable and Heir may request ETH signatures.
- Time additions, bond totals, credits, amounts and sequence IDs use checked arithmetic.
- Owner, Heir and Rival must differ from each other and from the vault account; the locked 20-byte recipient must be nonzero. Address ownership is not proven.
- Positive heartbeat/grace, extension >= grace, positive symmetric bond.
- Every role authorization uses predecessor, never signer. There is no admin, pause, upgrade method or override.

## Exact meaning of vault assets

`vault_assets: NearToken` records **only** attached deposits to `deposit_vault`, permitted for Owner while Idle. It starts at zero. Funding for deployment, storage, an operating buffer, direct native transfers, gas rewards, and any unexpected MPC refunds are **not** automatically inherited. Bond fields are separate `NearToken`s and never computed from raw balance.

The ledger partitions amounts into:
1. Accounted owner assets (`vault_assets`).
2. `locked_heir_bond` and `locked_rival_bond`.
3. Three available actor credits.
4. At most one native payout in flight per actor.
5. At most one reserved MPC failure-credit amount.

The raw account balance is used **only as a solvency guard**, after reserving actual storage staking plus a fixed **1 NEAR operational buffer**; never as the definition of a payout. Pending native transfers are excluded from held-on-account liabilities because the runtime has already deducted their outgoing amount. They remain tracked in separate in-flight fields. Newly scheduled transfers are additionally reserved in the current receipt. Initial deployment funding must cover code/storage and operating liquidity separately from inheritable funding. Growing state is bounded by three actors and one stored/pending ETH release; the buffer is conservative headroom, not a measured gas/storage guarantee.

`owner_withdraw_near(amount)` while Idle **moves assets into Owner's credit**. It does not automatically transfer. A second `withdraw_payout()` sends the credit. This prevents transfer failures from corrupting the vault-asset ledger.

| Resolution | Credited actor | Credit |
| --- | --- | --- |
| Pending + timely Owner check-in | Owner | B |
| Challenged + timely Owner check-in | Rival | 2B |
| Pending + expired deadline | Heir | vault assets + B |
| Challenged + expired deadline | Heir | vault assets + 2B |

Claim/challenge deposits must equal B exactly. An excess deposit is rejected in full by NEAR receipt rollback, not silently kept. The native unit-test environment does not itself simulate that rollback.

## Failed native transfers: pull-payment plus resolver

`withdraw_payout` identifies the caller's actor, moves all available credit into a fixed pending slot **before** scheduling a native transfer, and attaches a private callback with 20 Tgas. A matching successful callback clears the pending slot. A matching failed callback restores its amount to available credit, preserving any new credit that accrued during the transfer. Stale/replayed callbacks do nothing. A second withdrawal is blocked while a transfer for that actor is pending.

Private callback authentication is generated by `#[private]`; the runtime requires predecessor=current account. Direct Rust calls bypass that extern wrapper. Tests exercise logical resolver results, not cross-shard delivery. A callback that itself exhausts gas or cannot persist state can leave an in-flight slot unresolved. There is no unsafe manual recovery/admin override; gas/storage failure injection remains a Sandbox validation requirement before treating this as production-ready.

## MPC source and wire format

The contract depends on **the actual official interface**, pinned to `near/mpc` commit `d0fc87b19e2643299e7becdd7d9611afcd5d5a78`. The initial fetch of this Git dependency requires network access. No local replica of request structs or guessed API is used.

- [SignArgs wrapper](https://github.com/near/mpc/blob/d0fc87b19e2643299e7becdd7d9611afcd5d5a78/crates/near-mpc-contract-interface/src/call_args.rs)
- [Interface exports](https://github.com/near/mpc/blob/d0fc87b19e2643299e7becdd7d9611afcd5d5a78/crates/near-mpc-contract-interface/src/types/sign.rs)
- [Canonical request serialization](https://github.com/near/mpc/blob/d0fc87b19e2643299e7becdd7d9611afcd5d5a78/crates/near-mpc-crypto-types/src/sign.rs)
- [Payload/signature JSON](https://github.com/near/mpc/blob/d0fc87b19e2643299e7becdd7d9611afcd5d5a78/crates/near-mpc-crypto-types/src/primitives.rs)

The request is `{"request":{"path":"ethereum-1","payload_v2":{"Ecdsa":"64 lowercase hex characters"},"domain_id":0}}`. `SignRequestArgs.payload` is renamed by the official Serde serializer to `payload_v2`. Its constructor's `from_legacy_ecdsa` name does **not** cause legacy JSON output. Neither `key_version` nor the old raw-array `payload` field is sent.

Canonical current response is internally tagged: `{"scheme":"Secp256k1","big_r":{"affine_point":"33-byte hex"},"s":{"scalar":"32-byte hex"},"recovery_id":0}`. Only the official Secp256k1 DTO and EVM-compatible recovery IDs 0/1 are accepted on-contract. This structural check trusts the MPC contract; the CLI independently validates points/scalars, normalizes high-s, and verifies recovered sender before relay.

**Read-only Testnet sampling confirmed** `v1.signer-prod.testnet` was Running with a domain-0 Secp256k1 key and a 15 Tgas sign-call minimum in its configuration (block 276803657). Successful live signing and fee compatibility are not yet established; source schema verification is not a live signing result. No mainnet account is configurable. Current source declares 1 yoctoNEAR as a sign deposit, but the application deliberately forwards the Heir's explicit deposit and does not present a hardcoded live fee quote. Gas is 230 Tgas MPC + 40 Tgas callback; the entry point requires 300 Tgas with execution headroom. Actual sufficiency needs runtime testing.

## Destination-locked ETH release and failure reserve

`preview_eth_release` is read-only. It returns the unsigned preimage and hash for decimal-string nonce/value/fee/gas parameters. `request_eth_release` requires Heir, Finalized, positive attached deposit and no in-flight signature. Caller cannot choose chain, destination, calldata, access list, path or signing scheme.

- EIP-1559 `0x02 || RLP([11155111, nonce, priorityFee, maxFee, gasLimit, heirAddress, value, emptyString, emptyList])`.
- Values/fees are bounded u128; nonce/gas are u64. Canonical zero integers, no leading zeros, long RLP lists supported.
- Gas limit 21,000..1,000,000; both fee caps positive, priority <= max. The fixed recipient can be an EVM contract; receiving ETH may still revert there. No arbitrary calldata is supported.
- Keccak-256 of those bytes is the only payload forwarded for signing.
- A successful private callback stores the exact unsigned transaction, hash and typed-parsed response. It does **not** mean Sepolia has received or executed anything.
- A failed/invalid response creates a **pull-payment credit for the complete attached deposit**. The earlier signed release, if any, is retained.

Before forwarding deposit D, solvency must cover held liabilities **plus D reserved for a possible failure credit plus D outgoing to MPC**. Since the attached deposit supplies only one D, the vault must already have additional **unallocated surplus of at least D**, beyond storage and the 1 NEAR buffer. This guarantees failure credit without assuming MPC returns a deposit after a later yield timeout. No bond/asset/other credit funds that reserve. A direct transfer can fund this operational surplus; `deposit_vault` cannot, because it increases asset liabilities equally.

Signing is blocked while **any native payout is unresolved**. A failed transfer refund may arrive before its resolver restores the credit; that temporarily returned balance must never be mistaken for operational surplus. All payout callbacks must settle before requesting a new signature. Payouts may be started after a signature request because its failure reserve is already accounted. Promise results are read with SDK `promise_result_checked` (0 bytes for native transfer, 1,024 for MPC) before allocation/parsing, so oversized MPC responses take the failure-credit path.

Only one request is pending at a time, but repeated requests after settlement are allowed to refresh stale fees/nonces. Overwriting the stored release cannot revoke earlier signatures. Different-nonce signed transactions may both execute if funded. They all remain destination-locked. Do not fund the derived address beyond intended test ETH. The contract cannot query Sepolia balance, nonce, mempool, gas price or receipt, so it does not claim an atomic cross-chain transfer or a one-time spend guarantee. ETH deposited at the derived address has no living-owner release path in this MVP; Owner's escape hatch concerns NEAR only.

## Verification

From the repository root:

```sh
npm --prefix contract run vectors
npm run test:contract
npm run build:contract
```

Observed: 41 unit tests and 1 golden-vector test pass. Coverage includes all four payoff branches, role/deadline/bond/overflow boundaries, ledger conservation, simulated failed/successful callbacks, official JSON request serialization and shared vectors against `../test-vectors/branches.json`. Golden tests require `vectors/eip1559.generated.json`; they intentionally fail with instructions if it is absent. See `vectors/README.md`.

The optimized WASM is **196,109 bytes**, SHA-256 `f254791a926540c2f4991387a72b35ba97120fed5cb57fdd80505318084b9592`, with ABI JSON and compressed embedded ABI. The build uses `--abi-features near-sdk/unit-testing` to supply native mock host functions during Windows ABI linking, while the WASM build uses the normal contract features. Neither `--no-abi`, `--no-wasmopt` nor `--skip-rust-version-check` is used. `Cargo.lock` pins dependency resolution.

The npm wrapper can use an official portable NASM installation in the ignored `.rtk/tools/nasm-3.02` directory on Windows. For direct `cargo test --locked --manifest-path contract/Cargo.toml -- --nocapture`, ensure NASM and the host C/C++ toolchain are available. On Linux/macOS, standard build essentials are sufficient. Live MPC signing and Sepolia broadcast are documented in [Testnet evidence](../scripts/TESTNET.md).
