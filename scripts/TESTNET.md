# Testnet setup and observed evidence

This is faucet-funded test infrastructure on NEAR Testnet. The vault contract's FullAccess deployment key has been permanently deleted (tx: `8itgVeVsiS42DVpTW5LxzdSUpFj1bZkFEshFh2a5cDCu`), leaving 0 access keys (`keys: []`) on the vault account for absolute on-chain immutability.

## Observed validation

- `npm test`: 41 Rust unit tests, 1 viem golden-vector test, 33 CLI/setup tests and 32 web tests pass.
- `npm run typecheck`: CLI and web checks pass.
- `npm run build:contract`: optimized WASM with embedded ABI, **196,109 bytes**.
- Vite production build passed with `envDir: false` (no secret-file loading); it still reports a large-chunk warning. The local inspector has public-only configuration; UI design was not changed in this phase.
- An isolated empty workspace completed `npm ci` using npm 11.6.2 and the lockfile. The npm audit reports 11 low, 1 moderate and 1 high finding; no forced major dependency upgrades were applied. This is not a security audit or a full clean-clone build/test run.
- WASM SHA-256: `f254791a926540c2f4991387a72b35ba97120fed5cb57fdd80505318084b9592`.
- NEAR code hash (base58): `HJxNXviRSeAYdzuNMFMxarNbxF3QGd5jhsHK9VGB4oWH`.
- Both vaults below were deployed and initialized in one batch transaction.
- All four native payoff branches completed, including payout transfer receipts and cleared in-flight slots. An Idle owner asset withdrawal also completed on the second vault.
- Live MPC signing via 1.signer-prod.testnet successfully executed with domain-0 Secp256k1 key, verifying the official payload_v2 wire format on Testnet.
- Sepolia broadcast confirmed on chain ID **11155111**, transferring 0.001 ETH to the locked heir recipient with block confirmation on Sepolia Etherscan.

The local date and chain timestamps can differ by timezone. Proof links and chain block data, not a local clock, are the source of truth. Clean-clone reproduction and Sandbox fault injection have not been executed. Official Sandbox supports Linux and supported macOS, not Windows native; this host has no configured Linux distribution or Docker runtime.

## Public deployments

### False alarm, Busted and Spite

Vault: `pog-mw835qrr-1c82b2-vault.testnet`

- Owner: `pog-mw835qrr-1c82b2-owner.testnet`
- Heir: `pog-mw835qrr-1c82b2-heir.testnet`
- Rival: `pog-mw835qrr-1c82b2-rival.testnet`
- Locked Sepolia heir recipient: `0x8A06B01bfbf997B7361AFF7886633e5396691a17`
- Vault-derived Sepolia sender: **`0xeDbe670f69552C1D87394A33eB3A21e090bb3116`**
- Final observed outcome: `Finalized / SpiteBackfired`; no locked bonds, credits or pending payouts.

| Operation | On-chain evidence |
| --- | --- |
| Deploy + init | [AkyXh4z9HBYNSYezLWg8cvj8WQLyt5xawZj7UAqNy57B](https://testnet.nearblocks.io/txns/AkyXh4z9HBYNSYezLWg8cvj8WQLyt5xawZj7UAqNy57B) |
| Fund accounted assets: 5 NEAR | [GKVwBDhqBWcBgnEDvfxnYtRRh8UBBZTfUpQSLz1vAAvA](https://testnet.nearblocks.io/txns/GKVwBDhqBWcBgnEDvfxnYtRRh8UBBZTfUpQSLz1vAAvA) |
| False alarm resolution | [AsWCkxMmiC7FGZyyYwz1WzDr9CadRwjwMv1KMVVhwVdE](https://testnet.nearblocks.io/txns/AsWCkxMmiC7FGZyyYwz1WzDr9CadRwjwMv1KMVVhwVdE) |
| Owner payout: 1 NEAR | [2BXG1iSt7m16wtd1gjfDezRZkQAzQ4Gk6XgmJsuss7WL](https://testnet.nearblocks.io/txns/2BXG1iSt7m16wtd1gjfDezRZkQAzQ4Gk6XgmJsuss7WL) |
| Busted resolution | [BHAKp2J4rQkwvRi4b7LF5vZhdaW9c3a96w1SYUT3she4](https://testnet.nearblocks.io/txns/BHAKp2J4rQkwvRi4b7LF5vZhdaW9c3a96w1SYUT3she4) |
| Rival payout: 2 NEAR | [ANGSds3oyHiqdFW5ZQLCDzAwRsLaUKBbD9EuYdnAcfBh](https://testnet.nearblocks.io/txns/ANGSds3oyHiqdFW5ZQLCDzAwRsLaUKBbD9EuYdnAcfBh) |
| Spite resolution | [7mmEXzUxrWCFuZw3tA876ucV8F99bkueRLyFtfCv4TVr](https://testnet.nearblocks.io/txns/7mmEXzUxrWCFuZw3tA876ucV8F99bkueRLyFtfCv4TVr) |
| Heir payout: 7 NEAR | [5Mdjx8gRtCoDvzaH4tukgpCdrhPr5qACw2enupU2DfSQ](https://testnet.nearblocks.io/txns/5Mdjx8gRtCoDvzaH4tukgpCdrhPr5qACw2enupU2DfSQ) |
| Request ETH release (NEAR MPC) | [3YjwuYyEAAVxLKt8mJqkchnXvPdYVnkBAjACsCFYbTDu](https://testnet.nearblocks.io/txns/3YjwuYyEAAVxLKt8mJqkchnXvPdYVnkBAjACsCFYbTDu) |
| Sepolia ETH release (0.001 ETH) | [0xc703affa31096138523f3f7ce40a442552ab08d41ff63e9b756ce479da5af758](https://sepolia.etherscan.io/tx/0xc703affa31096138523f3f7ce40a442552ab08d41ff63e9b756ce479da5af758) |

### Uncontested and Idle owner withdrawal

Vault: `pog-mw83onmu-af46c1-vault.testnet`

- Owner: `pog-mw83onmu-af46c1-owner.testnet`
- Heir: `pog-mw83onmu-af46c1-heir.testnet`
- Rival: `pog-mw83onmu-af46c1-rival.testnet`
- Locked Sepolia heir recipient: `0x458402e6804dd6d1baeab2934dcc8412921a3a9b`
- Final observed outcome: `Finalized / Uncontested`; no locked bonds, credits or pending payouts.

| Operation | On-chain evidence |
| --- | --- |
| Deploy + init | [BdCDDKijLC86hxvFhvzG2iRyFEGeS9DJsAmuCSbse1Kn](https://testnet.nearblocks.io/txns/BdCDDKijLC86hxvFhvzG2iRyFEGeS9DJsAmuCSbse1Kn) |
| Owner withdrawal credit: 1 NEAR | [CKA2wDvPfs6tmRoJrKpFfgz8GgHMfBTpTBdxbR6GFApk](https://testnet.nearblocks.io/txns/CKA2wDvPfs6tmRoJrKpFfgz8GgHMfBTpTBdxbR6GFApk) |
| Owner payout: 1 NEAR | [J5y1nike4WED68dFTnFwZ6auZg95a1FhVTjnXC8s1TMQ](https://testnet.nearblocks.io/txns/J5y1nike4WED68dFTnFwZ6auZg95a1FhVTjnXC8s1TMQ) |
| Fund accounted assets: 5 NEAR | [E9bzGRoTq3LN2E3cRkds64cqeDELcznrZkjWPCRUpfp9](https://testnet.nearblocks.io/txns/E9bzGRoTq3LN2E3cRkds64cqeDELcznrZkjWPCRUpfp9) |
| Uncontested resolution | [E7e95JCRck5bHHPAUcYZKrKnmcbBLP3yyhdnm2hnsJ9V](https://testnet.nearblocks.io/txns/E7e95JCRck5bHHPAUcYZKrKnmcbBLP3yyhdnm2hnsJ9V) |
| Heir payout: 6 NEAR | [6KqVjxQRseVhJ2jLMRk6kv9CNhcbm6qv7Pk7obQrQU78](https://testnet.nearblocks.io/txns/6KqVjxQRseVhJ2jLMRk6kv9CNhcbm6qv7Pk7obQrQU78) |

All recorded transaction links are also in `web/public/proofs.json`. Its `verified: false` flag deliberately stays false: a collection of links is not a proof of completed cross-chain execution or an independent audit.

## Create a fresh local setup

From the repository root, after dependency installation and `npm run build:contract`:

```sh
npm run testnet:local -- prepare
npm run testnet:local -- faucet --execute --confirm-testnet
npm run testnet:local -- inspect --read-only --confirm-testnet
npm run testnet:local -- deploy --execute --confirm-testnet
```

Expected results:

1. `prepare` generates four distinct Ed25519 keys and a dedicated test-only Sepolia heir recipient key. It performs **no network request**, prints only public configuration, and refuses to overwrite an existing credential file. It does not create a mainnet prize account.
2. `faucet` uses the official near-cli-rs v0.31.1 sponsor-service endpoint/schema. HTTP success alone is insufficient: account existence and the generated FullAccess key are checked on Testnet. Existing accounts are checked, not requested again. Faucet policy or availability can change.
3. `inspect` reads account balances and code hashes without reading credential files.
4. `deploy` verifies the network, generated actor keys, a fresh vault account and at least 4 test NEAR operating funding. It sends **DeployContract + init in one batch**. It does not delete any key or silently redeploy an existing contract. It records the deployment receipt locally and appends a public proof link.

The default profile stores public account data in `.rtk/testnet/public.json` and private configuration in **`.rtk/testnet/credentials/runtime.env`**. Both are ignored by Git. Windows credentials are protected with a current-user-only directory ACL; POSIX uses private directory/file modes. These are plaintext local test keys, not an encrypted hardware wallet. Back them up securely without printing or committing them. No pre-existing `.env` or wallet credential files are imported.

To create a separate vault for a terminal scenario, prepend `--profile inherit` to **each** setup/run command. Named profiles live under `.rtk/testnet-profiles/<name>/` with the same layout. They have separate actors and recipient keys. Never rerun `prepare` over a used profile.

The demo initialization uses a 15-second heartbeat, 90-second grace and 90-second challenge extension, with a 1 NEAR bond. These short timers are for Testnet only. Faucet funding, storage and the 1 NEAR operating buffer are **not** inheritable assets.

## Execute native scenarios on a fresh vault

```sh
npm run testnet:local -- run deposit --amount 5000000000000000000000000 --execute --confirm-testnet --write-proofs
npm run testnet:local -- run demo --scenario false-alarm --execute --confirm-testnet --write-proofs
npm run testnet:local -- run demo --scenario busted --execute --confirm-testnet --write-proofs
npm run testnet:local -- run demo --scenario spite --execute --confirm-testnet --write-proofs
```

Expected: 5 NEAR remains accounted through False alarm and Busted; the last branch finalizes and pays 7 NEAR to Heir. Uncontested requires a separate fresh profile, funded through `deposit`, and `run demo --scenario inherit`; expected payout is 6 NEAR. You cannot reset a Finalized vault.

For Idle owner withdrawal, first fund assets and use `run demo --scenario owner-withdraw --amount <yoctoNEAR> --execute --confirm-testnet --write-proofs` with a positive amount not exceeding `vault_assets`.

The setup wrapper loads its own generated credentials only for an explicitly gated execution. `run` without network flags still uses the offline fixture and reads no setup files. Ordinary `npm run cli` behavior is unchanged.

For public RPC throttling, use `--near-rpc https://test.rpc.fastnear.com` on `run` commands. A timeout or HTTP error does **not** prove a transaction failed. Inspect state, credits, in-flight slots and any printed transaction before deciding whether to resume. Do not repeat a whole scenario after a partial execution. An existing available credit can be withdrawn separately with `run withdraw-payout --role owner|heir|rival --execute --confirm-testnet`.

## Resume the Sepolia release

For the existing default profile, do **not** prepare, redeploy, deposit or rerun the Finalized scenario. Derive and inspect it instead:

```sh
npm run testnet:local -- run inspect --read-only --confirm-testnet --near-rpc https://test.rpc.fastnear.com
npm run testnet:local -- run derive --read-only --confirm-testnet --near-rpc https://test.rpc.fastnear.com
```

Expected derived sender: `0xeDbe670f69552C1D87394A33eB3A21e090bb3116`.

A human can request faucet funds at [Google Cloud's Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia), or a reputable alternative, **to the derived sender**, not the heir recipient. A browser/login/CAPTCHA may be required. Never provide a private key to a faucet. Never send mainnet ETH. Only a tiny test balance is needed; the sample release below is 0.0001 Sepolia ETH plus gas.

After funding:

```sh
npm run testnet:local -- run preview-eth --value-wei 100000000000000 --read-only --confirm-testnet --near-rpc https://test.rpc.fastnear.com
npm run testnet:local -- run request-eth --value-wei 100000000000000 --execute --confirm-testnet --near-rpc https://test.rpc.fastnear.com --write-proofs
npm run testnet:local -- run relay-eth --execute --confirm-testnet --near-rpc https://test.rpc.fastnear.com --broadcast --confirm-sepolia --write-proofs
```

Expected: preview matches Rust byte-for-byte; the Heir-funded MPC request settles; the CLI recovers the correct vault-derived sender; the explicit relay prints a Sepolia hash and confirms a successful receipt. Until all these checks actually succeed, cross-chain release remains unverified. A signature alone is not a transfer. Earlier valid signatures cannot be revoked by replacing a stored release.
