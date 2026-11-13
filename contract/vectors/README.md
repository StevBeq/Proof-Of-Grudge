# EIP-1559 golden vectors

## Current status

`eip1559.inputs.json` contains the three source cases, and `eip1559.generated.json` is generated and committed using `viem@2.57.19`. Both `npm run vectors:check` and `cargo test --test rlp_golden` verify byte-per-byte parity.

## Regenerate locally

From `contract/` (or via root workspace scripts):

1. `npm install` → installs pinned `viem@2.57.19` and updates the root lockfile.
   Installation needs npm registry access; generation itself requires no network.
2. `npm run vectors` → writes `vectors/eip1559.generated.json` with actual viem
   unsigned serialization, the installed viem version, serializer/generator
   provenance, and a copy of the source inputs.
3. `npm run vectors:check` → recomputes using viem and compares the complete file
   without writing it (LF-normalized); missing/stale/modified output fails.
4. `cargo test --test rlp_golden` → compares every Rust preimage byte-for-byte to
   the generated reference. Missing output fails with explicit instructions.

Commit the generated fixture rather than ignoring it.

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

The exact version is resolved from the npm registry:
https://registry.npmjs.org/viem/2.57.19

Using `viem`'s `serializeTransaction` implementation (`type: 'eip1559'`).
