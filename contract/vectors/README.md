# EIP-1559 golden vectors

## Current status

`eip1559.inputs.json` contains the three source cases. The generator and Rust
comparison test are implemented but have not been executed. There is deliberately
**no `eip1559.generated.json` yet**: no bytes have been represented as viem output.
The independently hand-derived unit-test expectations in `src/eth_rlp.rs` are not
viem golden vectors.

## Generate when execution is authorized

From `contract/`:

1. `npm install` → installs exactly `viem@2.38.5` and creates a package lock.
   Installation needs npm registry access; generation itself requires no network.
2. `npm run vectors` → writes `vectors/eip1559.generated.json` with actual viem
   unsigned serialization, the installed viem version, serializer/generator
   provenance, and a copy of the source inputs.
3. `npm run vectors:check` → recomputes using viem and compares the complete file
   without writing it; missing/stale/modified output fails.
4. `cargo test --test rlp_golden` → compares every Rust preimage byte-for-byte to
   the generated reference. Missing output fails with explicit instructions.

Commit the generated fixture rather than ignoring it. Commit the npm package lock
as part of the authorized dependency-installation work for transitive dependency
reproducibility. Neither file was generated during this implementation-only task.

The main contract crate must be named `proof_of_grudge` and export
`pub mod eth_rlp;` from its library. The integration test uses
`near_sdk::serde_json`, avoiding an additional direct dependency.

## Scope and policy

All cases use chain ID `11155111`, empty calldata, and an empty access list.
Decimal strings preserve u128 precision. The cases cover zero nonce with nonzero
value, zero nonce with zero value, and maximum u128 value/fees with a long RLP list.
The generator explicitly rejects nonces beyond JavaScript's safe integer range;
the separate Rust unit test covers `u64::MAX` nonce without claiming a viem vector.

The encoder returns the unsigned typed preimage, not a hash or signed transaction.
It asserts positive fees and priority <= maximum. Main must supply the stored,
locked destination and validate authorization and gas policy (minimum 21,000 plus
main's chosen upper bound). No chain ID, calldata, or access-list override exists
in the encoder API.

The generator only reads public local fixture inputs and installed package
metadata, then serializes in memory. It does not access wallets, secrets, RPCs,
or signing services, and it does not broadcast transactions.

## Reference provenance

The exact version was verified through npm metadata (read-only HTTP retrieval):
https://registry.npmjs.org/viem/2.38.5

The published serializer implementation was inspected at:
https://unpkg.com/viem@2.38.5/_esm/utils/transaction/serializeTransaction.js

A verified package version and inspected source are not proof of executed vector
generation. Only running the generator produces the missing viem reference file.
