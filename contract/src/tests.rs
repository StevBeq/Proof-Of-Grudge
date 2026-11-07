//! Native unit tests for the SDK 5.30.1 pin in Cargo.toml; authored, not executed.
//!
//! Direct Rust calls do not execute generated extern wrappers: #[private],
//! #[init], and non-payable wrapper guards require separate integration tests.
//! In particular, callback contexts below use the vault as predecessor, but do
//! not claim to test callback privacy. No extern wrapper is called here.
//! catch_unwind does not reproduce receipt rollback. Rejection snapshots below
//! cover guards that run before mutation; tests never fabricate automatic refunds.

use super::*;
use near_mpc_contract_interface::types::SignatureResponse;
use near_sdk::{
    mock::MockAction,
    test_utils::{VMContextBuilder, get_created_receipts},
    testing_env,
};
use std::{collections::HashMap, panic::{AssertUnwindSafe, catch_unwind}};

const OWNER: &str = "owner.testnet";
const HEIR: &str = "heir.testnet";
const RIVAL: &str = "rival.testnet";
const VAULT: &str = "vault.testnet";
const ANYONE: &str = "anyone.testnet";
const HEARTBEAT: u64 = 120_000_000_000;
const GRACE: u64 = 60_000_000_000;
const EXTENSION: u64 = 60_000_000_000;
const CLAIM_AT: u64 = HEARTBEAT + 1;
const DEADLINE: u64 = CLAIM_AT + GRACE;
const EXTENDED_DEADLINE: u64 = DEADLINE + EXTENSION;
const BOND: u128 = 1_000_000_000_000_000_000_000_000;
const ASSETS: u128 = 10 * BOND;
const SIGN_DEPOSIT: u128 = BOND / 10;
const ADDRESS: [u8; 20] = [0x11; 20];

fn account(name: &str) -> AccountId {
    name.parse().expect("Valid test account")
}

fn builder(predecessor: &str, signer: &str, at: u64, deposit: u128) -> VMContextBuilder {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(account(VAULT))
        .predecessor_account_id(account(predecessor))
        .signer_account_id(account(signer))
        .block_timestamp(at)
        .account_balance(NearToken::from_near(100).checked_add(NearToken::from_yoctonear(deposit)).unwrap())
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .prepaid_gas(Gas::from_tgas(300));
    builder
}

fn context(actor: &str, at: u64, deposit: u128) {
    testing_env!(builder(actor, actor, at, deposit).build());
}

fn signing_context(predecessor: &str, signer: &str, deposit: u128, gas: u64) {
    let mut builder = builder(predecessor, signer, DEADLINE, deposit);
    builder
        .account_balance(NearToken::from_near(1000).checked_add(NearToken::from_yoctonear(deposit)).unwrap())
        .prepaid_gas(Gas::from_tgas(gas));
    testing_env!(builder.build());
}

fn callback(results: Vec<PromiseResult>) {
    let mut builder = builder(VAULT, HEIR, EXTENDED_DEADLINE, 0);
    builder.account_balance(NearToken::from_near(1000));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        HashMap::default(),
        results,
    );
}

fn initialize(actors: [&str; 3], address: [u8; 20], intervals: [u64; 3], bond: u128) -> VaultContract {
    VaultContract::init(
        account(actors[0]), account(actors[1]), account(actors[2]), address,
        U64(intervals[0]), U64(intervals[1]), U64(intervals[2]), U128(bond),
    )
}

fn empty_vault() -> VaultContract {
    context(OWNER, 0, 0);
    initialize([OWNER, HEIR, RIVAL], ADDRESS, [HEARTBEAT, GRACE, EXTENSION], BOND)
}

fn funded_vault() -> VaultContract {
    let mut contract = empty_vault();
    context(OWNER, 0, ASSETS);
    contract.deposit_vault();
    context(OWNER, 0, 0);
    contract
}

fn pending_vault() -> VaultContract {
    let mut contract = funded_vault();
    context(HEIR, CLAIM_AT, BOND);
    contract.initiate_claim();
    contract
}

fn challenged_vault() -> VaultContract {
    let mut contract = pending_vault();
    context(RIVAL, CLAIM_AT + 1, BOND);
    contract.challenge_claim();
    contract
}

fn finalized_vault() -> VaultContract {
    let mut contract = pending_vault();
    context(ANYONE, DEADLINE, 0);
    contract.finalize_inheritance();
    contract
}

fn snapshot(contract: &VaultContract) -> serde_json::Value {
    serde_json::to_value(contract.get_vault_state()).expect("Snapshot serializes")
}

fn rejected<T>(expected: &str, action: impl FnOnce() -> T) {
    let panic = match catch_unwind(AssertUnwindSafe(action)) {
        Ok(_) => panic!("Expected rejection containing {expected:?}"),
        Err(panic) => panic,
    };
    let message = if let Some(message) = panic.downcast_ref::<String>() {
        message.as_str()
    } else if let Some(message) = panic.downcast_ref::<&str>() {
        message
    } else {
        panic!("Non-string panic; expected {expected:?}");
    };
    assert!(message.contains(expected), "Expected {expected:?}, got {message:?}");
}

fn rejected_unchanged(contract: &mut VaultContract, expected: &str, action: impl FnOnce(&mut VaultContract)) {
    let before = near_sdk::borsh::to_vec(contract).unwrap();
    let view = snapshot(contract);
    rejected(expected, || action(contract));
    assert_eq!(near_sdk::borsh::to_vec(contract).unwrap(), before);
    assert_eq!(snapshot(contract), view);
    assert!(get_created_receipts().is_empty());
}

fn assert_funds(contract: &VaultContract, credits: [u128; 3], assets: u128) {
    assert_eq!(contract.credits.map(|amount| amount.as_yoctonear()), credits);
    assert_eq!(contract.vault_assets.as_yoctonear(), assets);
    assert_eq!(contract.locked_heir_bond, ZERO);
    assert_eq!(contract.locked_rival_bond, ZERO);
}

fn request(contract: &mut VaultContract, nonce: u64) -> u64 {
    signing_context(HEIR, HEIR, SIGN_DEPOSIT, 300);
    assert!(remaining_gas() >= Gas::from_tgas(285).as_gas());
    drop(contract.request_eth_release(U64(nonce), U128(1), U128(2), U128(1), U64(21_000)));
    contract.pending_signature.as_ref().unwrap().id
}

fn signature_value(recovery_id: u8) -> serde_json::Value {
    // Structurally valid official DTO, not a cryptographic signature over our hash.
    json!({
        "scheme": "Secp256k1",
        "big_r": {"affine_point": format!("02{}", "11".repeat(32))},
        "s": {"scalar": "07".repeat(32)},
        "recovery_id": recovery_id,
    })
}

fn signature_bytes() -> Vec<u8> {
    let bytes = serde_json::to_vec(&signature_value(0)).unwrap();
    let response: SignatureResponse = serde_json::from_slice(&bytes).expect("Official signature DTO");
    assert!(matches!(response, SignatureResponse::Secp256k1(signature) if signature.recovery_id == 0));
    assert!(mpc::valid_response(&bytes));
    bytes
}

#[test]
fn initialization_keeps_raw_backing_out_of_the_asset_ledger() {
    let mut contract = empty_vault();
    assert_eq!(env::account_balance(), NearToken::from_near(100));
    let view = snapshot(&contract);
    assert_eq!(view["owner"], OWNER);
    assert_eq!(view["heir"], HEIR);
    assert_eq!(view["rival"], RIVAL);
    assert_eq!(view["heir_eth_address"], json!(ADDRESS));
    assert_eq!(view["state"], json!({"status":"Idle"}));
    assert_eq!(view["last_outcome"], "None");
    assert_eq!(view["last_check_in_ns"], "0");
    assert_eq!(view["observed_at_ns"], "0");
    assert_eq!(view["heartbeat_interval_ns"], HEARTBEAT.to_string());
    assert_eq!(view["grace_period_ns"], GRACE.to_string());
    assert_eq!(view["challenge_extension_ns"], EXTENSION.to_string());
    assert_eq!(view["required_bond"], BOND.to_string());
    assert_eq!(view["operating_buffer"], BOND.to_string());
    assert_eq!(view["signing_in_flight"], false);
    assert!(view["eth_release"].is_null());
    assert_funds(&contract, [0; 3], 0);
    context(OWNER, 0, ASSETS);
    contract.deposit_vault();
    assert_eq!(contract.vault_assets.as_yoctonear(), ASSETS);
    context(HEIR, CLAIM_AT, BOND);
    contract.initiate_claim();
    context(ANYONE, DEADLINE, 0);
    contract.finalize_inheritance();
    assert_eq!(env::account_balance(), NearToken::from_near(100));
    assert_funds(&contract, [0, ASSETS + BOND, 0], 0);
    assert!(get_created_receipts().is_empty());
}

#[test]
fn initialization_rejects_every_actor_collision_and_the_vault_account() {
    for actors in [
        [OWNER, OWNER, RIVAL], [OWNER, HEIR, OWNER], [OWNER, HEIR, HEIR],
        [OWNER, OWNER, OWNER],
    ] {
        context(OWNER, 0, 0);
        rejected("Actors must be distinct", || initialize(actors, ADDRESS, [HEARTBEAT, GRACE, EXTENSION], BOND));
    }
    for actors in [[VAULT, HEIR, RIVAL], [OWNER, VAULT, RIVAL], [OWNER, HEIR, VAULT]] {
        context(OWNER, 0, 0);
        rejected("Actors must differ from vault account", || initialize(actors, ADDRESS, [HEARTBEAT, GRACE, EXTENSION], BOND));
    }
}

#[test]
fn initialization_rejects_zero_address_invalid_intervals_and_bonds() {
    context(OWNER, 0, 0);
    rejected("Heir ETH address must not be zero", || initialize([OWNER, HEIR, RIVAL], [0; 20], [HEARTBEAT, GRACE, EXTENSION], BOND));
    for intervals in [[0, GRACE, EXTENSION], [HEARTBEAT, 0, EXTENSION]] {
        context(OWNER, 0, 0);
        rejected("Intervals must be positive", || initialize([OWNER, HEIR, RIVAL], ADDRESS, intervals, BOND));
    }
    context(OWNER, 0, 0);
    rejected("Challenge extension must cover grace period", || initialize([OWNER, HEIR, RIVAL], ADDRESS, [HEARTBEAT, GRACE, GRACE - 1], BOND));
    context(OWNER, 0, 0);
    rejected("Bond must be positive", || initialize([OWNER, HEIR, RIVAL], ADDRESS, [HEARTBEAT, GRACE, EXTENSION], 0));
    context(OWNER, 0, 0);
    rejected("Combined bond overflow", || initialize([OWNER, HEIR, RIVAL], ADDRESS, [HEARTBEAT, GRACE, EXTENSION], u128::MAX));
}

#[test]
fn false_alarm_credits_owner_and_restarts_the_heartbeat() {
    let mut contract = pending_vault();
    let at = CLAIM_AT + GRACE / 2;
    context(OWNER, at, 0);
    contract.check_in();
    assert_eq!(contract.state, VaultState::Idle);
    assert_eq!(contract.last_outcome, Outcome::FalseAlarm);
    assert_eq!(contract.last_check_in_ns, at);
    assert_funds(&contract, [BOND, 0, 0], ASSETS);
    context(HEIR, at + HEARTBEAT, BOND);
    rejected_unchanged(&mut contract, "Heartbeat has not expired", |c| c.initiate_claim());
    context(HEIR, at + HEARTBEAT + 1, BOND);
    contract.initiate_claim();
    assert!(matches!(contract.state, VaultState::Pending { .. }));
    assert_eq!(contract.credits[Actor::Owner.index()].as_yoctonear(), BOND);
}

#[test]
fn busted_credits_both_bonds_to_rival_and_restarts_the_heartbeat() {
    let mut contract = challenged_vault();
    let at = DEADLINE + 1;
    context(OWNER, at, 0);
    contract.check_in();
    assert_eq!(contract.state, VaultState::Idle);
    assert_eq!(contract.last_outcome, Outcome::Busted);
    assert_eq!(contract.last_check_in_ns, at);
    assert_funds(&contract, [0, 0, 2 * BOND], ASSETS);
    context(HEIR, at + HEARTBEAT, BOND);
    rejected_unchanged(&mut contract, "Heartbeat has not expired", |c| c.initiate_claim());
    context(HEIR, at + HEARTBEAT + 1, BOND);
    contract.initiate_claim();
    assert!(matches!(contract.state, VaultState::Pending { .. }));
}

#[test]
fn uncontested_is_permissionless_at_exact_deadline_and_finalization_is_terminal() {
    let mut contract = pending_vault();
    context(ANYONE, DEADLINE, 0);
    contract.finalize_inheritance();
    assert_eq!(contract.state, VaultState::Finalized);
    assert_eq!(contract.last_outcome, Outcome::Uncontested);
    assert_eq!(contract.last_check_in_ns, 0);
    assert_funds(&contract, [0, ASSETS + BOND, 0], 0);
    context(ANYONE, DEADLINE + 1, 0);
    rejected_unchanged(&mut contract, "No active inheritance claim", |c| c.finalize_inheritance());
    context(OWNER, DEADLINE + 1, 0);
    rejected_unchanged(&mut contract, "Vault is Finalized", |c| c.check_in());
    context(HEIR, DEADLINE + 1, BOND);
    rejected_unchanged(&mut contract, "Vault must be Idle", |c| c.initiate_claim());
}

#[test]
fn spite_backfired_credits_only_recorded_assets_and_both_bonds_at_equality() {
    let mut contract = challenged_vault();
    assert_eq!(contract.state, VaultState::Challenged {
        claimed_at_ns: U64(CLAIM_AT), deadline_ns: U64(EXTENDED_DEADLINE),
    });
    context(ANYONE, EXTENDED_DEADLINE, 0);
    contract.finalize_inheritance();
    assert_eq!(contract.state, VaultState::Finalized);
    assert_eq!(contract.last_outcome, Outcome::SpiteBackfired);
    assert_funds(&contract, [0, ASSETS + 2 * BOND, 0], 0);
    assert!(get_created_receipts().is_empty());
}

#[test]
fn check_in_rejects_exact_and_later_deadlines_for_both_active_states() {
    for challenged in [false, true] {
        for late in [0, 1] {
            let mut contract = if challenged { challenged_vault() } else { pending_vault() };
            let deadline = if challenged { EXTENDED_DEADLINE } else { DEADLINE };
            context(OWNER, deadline + late, 0);
            rejected_unchanged(&mut contract, "Deadline expired; check-in rejected", |c| c.check_in());
        }
        let mut contract = if challenged { challenged_vault() } else { pending_vault() };
        let deadline = if challenged { EXTENDED_DEADLINE } else { DEADLINE };
        context(OWNER, deadline - 1, 0);
        contract.check_in();
        assert_eq!(contract.state, VaultState::Idle);
    }
}

#[test]
fn finalization_is_rejected_early_or_without_an_active_claim() {
    for challenged in [false, true] {
        let mut contract = if challenged { challenged_vault() } else { pending_vault() };
        context(ANYONE, if challenged { EXTENDED_DEADLINE - 1 } else { DEADLINE - 1 }, 0);
        rejected_unchanged(&mut contract, "Claim deadline has not arrived", |c| c.finalize_inheritance());
    }
    let mut contract = funded_vault();
    context(ANYONE, 0, 0);
    rejected_unchanged(&mut contract, "No active inheritance claim", |c| c.finalize_inheritance());
}

#[test]
fn heartbeat_must_be_strictly_expired_and_idle_check_in_resets_it() {
    let mut contract = funded_vault();
    for at in [0, HEARTBEAT - 1, HEARTBEAT] {
        context(HEIR, at, BOND);
        rejected_unchanged(&mut contract, "Heartbeat has not expired", |c| c.initiate_claim());
    }
    context(OWNER, HEARTBEAT, 0);
    contract.check_in();
    assert_eq!(contract.last_check_in_ns, HEARTBEAT);
    assert_eq!(contract.last_outcome, Outcome::None);
    context(HEIR, HEARTBEAT * 2 + 1, BOND);
    contract.initiate_claim();
    assert_eq!(contract.locked_heir_bond.as_yoctonear(), BOND);
    assert_eq!(contract.locked_rival_bond, ZERO);
}

#[test]
fn both_bonds_require_exact_deposits_including_rejecting_one_yocto_over() {
    for deposit in [0, BOND - 1, BOND + 1, 2 * BOND] {
        let mut contract = funded_vault();
        context(HEIR, CLAIM_AT, deposit);
        rejected_unchanged(&mut contract, "Exact bond deposit required", |c| c.initiate_claim());
        let mut contract = pending_vault();
        context(RIVAL, CLAIM_AT + 1, deposit);
        rejected_unchanged(&mut contract, "Exact bond deposit required", |c| c.challenge_claim());
    }
    let contract = challenged_vault();
    assert_eq!(contract.locked_heir_bond.as_yoctonear(), BOND);
    assert_eq!(contract.locked_rival_bond.as_yoctonear(), BOND);
    assert_eq!(contract.vault_assets.as_yoctonear(), ASSETS);
    assert_eq!(contract.credits, [ZERO; 3]);
}

#[test]
fn challenge_is_once_only_and_before_the_original_deadline() {
    let mut contract = pending_vault();
    context(RIVAL, DEADLINE, BOND);
    rejected_unchanged(&mut contract, "Deadline expired; challenge rejected", |c| c.challenge_claim());
    context(RIVAL, DEADLINE - 1, BOND);
    contract.challenge_claim();
    assert_eq!(contract.state, VaultState::Challenged {
        claimed_at_ns: U64(CLAIM_AT), deadline_ns: U64(EXTENDED_DEADLINE),
    });
    context(RIVAL, DEADLINE, BOND);
    rejected_unchanged(&mut contract, "Only a Pending claim can be challenged", |c| c.challenge_claim());
    let mut contract = funded_vault();
    context(RIVAL, CLAIM_AT, BOND);
    rejected_unchanged(&mut contract, "Only a Pending claim can be challenged", |c| c.challenge_claim());
    let mut contract = finalized_vault();
    context(RIVAL, DEADLINE + 1, BOND);
    rejected_unchanged(&mut contract, "Only a Pending claim can be challenged", |c| c.challenge_claim());
}

#[test]
fn authorization_uses_predecessor_not_a_spoofed_authorized_signer() {
    for predecessor in [ANYONE, HEIR, RIVAL] {
        let mut contract = funded_vault();
        testing_env!(builder(predecessor, OWNER, CLAIM_AT, BOND).build());
        rejected_unchanged(&mut contract, "Unauthorized actor", |c| c.deposit_vault());
        rejected_unchanged(&mut contract, "Unauthorized actor", |c| c.check_in());
        rejected_unchanged(&mut contract, "Unauthorized actor", |c| c.owner_withdraw_near(U128(BOND)));
    }
    for predecessor in [ANYONE, OWNER, RIVAL] {
        let mut contract = funded_vault();
        testing_env!(builder(predecessor, HEIR, CLAIM_AT, BOND).build());
        rejected_unchanged(&mut contract, "Unauthorized actor", |c| c.initiate_claim());
    }
    for predecessor in [ANYONE, OWNER, HEIR] {
        let mut contract = pending_vault();
        testing_env!(builder(predecessor, RIVAL, CLAIM_AT + 1, BOND).build());
        rejected_unchanged(&mut contract, "Unauthorized actor", |c| c.challenge_claim());
    }
    let mut contract = funded_vault();
    testing_env!(builder(OWNER, ANYONE, 1, 0).build());
    contract.check_in();
    assert_eq!(contract.last_check_in_ns, 1);
    testing_env!(builder(HEIR, ANYONE, HEARTBEAT + 2, BOND).build());
    contract.initiate_claim();
    testing_env!(builder(RIVAL, ANYONE, HEARTBEAT + 3, BOND).build());
    contract.challenge_claim();
}

#[test]
fn timestamp_overflow_is_rejected_before_accepting_funds_or_resetting_state() {
    context(OWNER, u64::MAX - HEARTBEAT + 1, 0);
    rejected("Timestamp overflow", || initialize([OWNER, HEIR, RIVAL], ADDRESS, [HEARTBEAT, GRACE, EXTENSION], BOND));
    context(OWNER, 0, 0);
    rejected("Timestamp overflow", || initialize([OWNER, HEIR, RIVAL], ADDRESS, [u64::MAX - GRACE, GRACE, EXTENSION], BOND));
    let mut contract = funded_vault();
    context(OWNER, u64::MAX - HEARTBEAT + 1, 0);
    rejected_unchanged(&mut contract, "Timestamp overflow", |c| c.check_in());
    for at in [u64::MAX - GRACE + 1, u64::MAX - GRACE - EXTENSION + 1] {
        context(HEIR, at, BOND);
        rejected_unchanged(&mut contract, "Timestamp overflow", |c| c.initiate_claim());
    }
    // A valid latest claim can still be challenged without wrapping its deadline.
    context(HEIR, u64::MAX - GRACE - EXTENSION, BOND);
    contract.initiate_claim();
    context(RIVAL, u64::MAX - GRACE - EXTENSION + 1, BOND);
    contract.challenge_claim();
    assert!(matches!(contract.state, VaultState::Challenged { deadline_ns: U64(u64::MAX), .. }));
}

#[test]
fn idle_withdrawal_is_a_bounded_owner_credit_not_a_raw_balance_transfer() {
    let mut contract = funded_vault();
    context(OWNER, 1, 0);
    rejected_unchanged(&mut contract, "Amount must be positive", |c| c.owner_withdraw_near(U128(0)));
    rejected_unchanged(&mut contract, "Insufficient vault assets", |c| c.owner_withdraw_near(U128(ASSETS + 1)));
    contract.owner_withdraw_near(U128(3 * BOND));
    assert_funds(&contract, [3 * BOND, 0, 0], 7 * BOND);
    assert!(get_created_receipts().is_empty());
    context(OWNER, 2, 0);
    contract.owner_withdraw_near(U128(7 * BOND));
    assert_funds(&contract, [ASSETS, 0, 0], 0);
    rejected_unchanged(&mut contract, "Insufficient vault assets", |c| c.owner_withdraw_near(U128(1)));
    for mut contract in [pending_vault(), challenged_vault(), finalized_vault()] {
        context(OWNER, EXTENDED_DEADLINE, 0);
        rejected_unchanged(&mut contract, "Vault must be Idle", |c| c.owner_withdraw_near(U128(BOND)));
        context(OWNER, EXTENDED_DEADLINE, BOND);
        rejected_unchanged(&mut contract, "Vault must be Idle", |c| c.deposit_vault());
    }
    let mut contract = empty_vault();
    context(OWNER, 0, 0);
    rejected_unchanged(&mut contract, "Deposit must be positive", |c| c.deposit_vault());
}

#[test]
fn payout_failure_restores_credit_success_clears_and_old_ids_are_noops() {
    let mut contract = funded_vault();
    context(OWNER, 1, 0);
    contract.owner_withdraw_near(U128(3 * BOND));
    context(OWNER, 2, 0);
    drop(contract.withdraw_payout());
    let id = contract.pending_payouts[0].as_ref().unwrap().id;
    assert_eq!(contract.credits[0], ZERO);
    assert_eq!(snapshot(&contract)["payouts_in_flight"]["owner"], (3 * BOND).to_string());
    let receipts = get_created_receipts();
    assert_eq!(receipts.len(), 2);
    assert_eq!(receipts[0].receiver_id, account(OWNER));
    assert!(receipts[0].actions.iter().any(|action| matches!(action,
        MockAction::Transfer { deposit, .. } if deposit.as_yoctonear() == 3 * BOND)));
    assert_eq!(receipts[1].receiver_id, account(VAULT));
    assert!(receipts[1].actions.iter().any(|action| matches!(action,
        MockAction::FunctionCallWeight { method_name, args, attached_deposit, prepaid_gas, .. }
        if method_name.as_slice() == b"on_payout_complete"
            && serde_json::from_slice::<serde_json::Value>(args).unwrap() == json!({"actor":"Owner", "transfer_id":id.to_string()})
            && *attached_deposit == ZERO && *prepaid_gas == PAYOUT_CALLBACK_GAS)));
    context(OWNER, 3, 0);
    rejected_unchanged(&mut contract, "Payout already in flight", |c| { drop(c.withdraw_payout()); });
    callback(vec![PromiseResult::Failed]);
    assert!(!contract.on_payout_complete(Actor::Owner, U64(id + 1)));
    assert!(contract.pending_payouts[0].is_some());
    assert!(!contract.on_payout_complete(Actor::Heir, U64(id)));
    assert!(!contract.on_payout_complete(Actor::Owner, U64(id)));
    assert!(contract.pending_payouts[0].is_none());
    assert_eq!(contract.credits[0].as_yoctonear(), 3 * BOND);
    let before = snapshot(&contract);
    assert!(!contract.on_payout_complete(Actor::Owner, U64(id)));
    assert_eq!(snapshot(&contract), before);
    context(OWNER, 4, 0);
    drop(contract.withdraw_payout());
    let retry_id = contract.pending_payouts[0].as_ref().unwrap().id;
    assert!(retry_id > id);
    callback(vec![PromiseResult::Successful(Vec::new())]);
    assert!(!contract.on_payout_complete(Actor::Owner, U64(id)));
    assert_eq!(contract.pending_payouts[0].as_ref().unwrap().id, retry_id);
    assert!(contract.on_payout_complete(Actor::Owner, U64(retry_id)));
    assert!(contract.pending_payouts[0].is_none());
    assert_eq!(contract.credits[0], ZERO);
    assert!(!contract.on_payout_complete(Actor::Owner, U64(retry_id)));
}

#[test]
fn payout_completion_preserves_new_credits_accrued_while_in_flight() {
    for success in [false, true] {
        let mut contract = funded_vault();
        context(OWNER, 1, 0);
        contract.owner_withdraw_near(U128(BOND));
        context(OWNER, 2, 0);
        drop(contract.withdraw_payout());
        let id = contract.pending_payouts[0].as_ref().unwrap().id;
        context(OWNER, 3, 0);
        contract.owner_withdraw_near(U128(2 * BOND));
        assert_eq!(contract.credits[0].as_yoctonear(), 2 * BOND);
        callback(vec![if success { PromiseResult::Successful(Vec::new()) } else { PromiseResult::Failed }]);
        assert_eq!(contract.on_payout_complete(Actor::Owner, U64(id)), success);
        assert_eq!(contract.credits[0].as_yoctonear(), if success { 2 * BOND } else { 3 * BOND });
        assert_eq!(contract.vault_assets.as_yoctonear(), 7 * BOND);
        assert!(contract.pending_payouts[0].is_none());
    }
}

#[test]
fn payout_guards_authorization_empty_credit_gas_and_callback_result_count() {
    let mut contract = funded_vault();
    context(OWNER, 1, 0);
    rejected_unchanged(&mut contract, "No payout credit", |c| { drop(c.withdraw_payout()); });
    contract.owner_withdraw_near(U128(BOND));
    testing_env!(builder(ANYONE, OWNER, 2, 0).build());
    rejected_unchanged(&mut contract, "Unauthorized actor", |c| { drop(c.withdraw_payout()); });
    let mut low_gas = builder(OWNER, OWNER, 2, 0);
    low_gas.prepaid_gas(Gas::from_tgas(34));
    testing_env!(low_gas.build());
    rejected_unchanged(&mut contract, "Attach at least 50 Tgas", |c| { drop(c.withdraw_payout()); });
    context(OWNER, 3, 0);
    drop(contract.withdraw_payout());
    let id = contract.pending_payouts[0].as_ref().unwrap().id;
    for results in [vec![], vec![PromiseResult::Failed, PromiseResult::Failed]] {
        callback(results);
        let before = snapshot(&contract);
        assert!(!contract.on_payout_complete(Actor::Owner, U64(id)));
        assert_eq!(snapshot(&contract), before);
        assert!(contract.pending_payouts[0].is_some());
    }
}

#[test]
fn heir_and_rival_can_pull_their_own_branch_credits() {
    for (mut contract, actor, kind, amount) in [
        (finalized_vault(), HEIR, Actor::Heir, ASSETS + BOND),
        ({
            let mut c = challenged_vault();
            context(OWNER, DEADLINE, 0);
            c.check_in();
            c
        }, RIVAL, Actor::Rival, 2 * BOND),
    ] {
        context(actor, EXTENDED_DEADLINE, 0);
        drop(contract.withdraw_payout());
        let index = kind.index();
        let pending = contract.pending_payouts[index].as_ref().unwrap();
        let id = pending.id;
        assert_eq!(pending.amount.as_yoctonear(), amount);
        assert_eq!(contract.credits[index], ZERO);
        assert_eq!(get_created_receipts()[0].receiver_id, account(actor));
        callback(vec![PromiseResult::Successful(Vec::new())]);
        assert!(contract.on_payout_complete(kind, U64(id)));
        assert!(contract.pending_payouts[index].is_none());
    }
}

#[test]
fn preview_is_read_only_destination_locked_and_uses_fixed_sepolia_chain() {
    let contract = funded_vault();
    context(ANYONE, 1, 0);
    let before = near_sdk::borsh::to_vec(&contract).unwrap();
    let preview = contract.preview_eth_release(U64(0), U128(0), U128(2), U128(1), U64(21_000));
    // Independent hand-derived preimage: type 2, Sepolia aa36a7, no data/access list.
    // This is not represented as an executed viem golden-vector comparison.
    let mut expected = vec![0x02, 0xe2, 0x83, 0xaa, 0x36, 0xa7, 0x80, 0x01, 0x02, 0x82, 0x52, 0x08, 0x94];
    expected.extend_from_slice(&ADDRESS);
    expected.extend_from_slice(&[0x80, 0x80, 0xc0]);
    assert_eq!(preview.unsigned_tx_hex, hex(&expected));
    assert_eq!(preview.payload_hex, hex(&env::keccak256(&expected)));
    assert_eq!(preview.nonce.0, 0);
    assert_eq!(preview.value_wei.0, 0);
    assert_eq!(preview.max_fee_per_gas.0, 2);
    assert_eq!(preview.max_priority_fee_per_gas.0, 1);
    assert_eq!(preview.gas_limit.0, 21_000);
    assert_eq!(near_sdk::borsh::to_vec(&contract).unwrap(), before);
    assert!(get_created_receipts().is_empty());
    let upper = contract.preview_eth_release(U64(u64::MAX), U128(u128::MAX), U128(u128::MAX), U128(1), U64(1_000_000));
    assert_eq!(upper.gas_limit.0, 1_000_000);
}

#[test]
fn preview_rejects_out_of_policy_gas_and_fees() {
    let contract = empty_vault();
    for gas in [0, 20_999, 1_000_001, u64::MAX] {
        context(ANYONE, 0, 0);
        rejected("Gas limit must be between 21000 and 1000000", || contract.preview_eth_release(U64(0), U128(1), U128(2), U128(1), U64(gas)));
    }
    for (maximum, priority, error) in [
        (0, 1, "Fees must be positive"), (2, 0, "Fees must be positive"),
        (1, 2, "Priority fee exceeds maximum fee"),
    ] {
        context(ANYONE, 0, 0);
        rejected(error, || contract.preview_eth_release(U64(0), U128(1), U128(maximum), U128(priority), U64(21_000)));
    }
}

#[test]
fn signing_requires_finalization_heir_predecessor_positive_deposit_and_enough_gas() {
    for mut contract in [funded_vault(), pending_vault(), challenged_vault()] {
        signing_context(HEIR, HEIR, SIGN_DEPOSIT, 300);
        rejected_unchanged(&mut contract, "Vault must be Finalized", |c| {
            drop(c.request_eth_release(U64(0), U128(1), U128(2), U128(1), U64(21_000)));
        });
    }
    let mut contract = finalized_vault();
    for predecessor in [ANYONE, OWNER, RIVAL] {
        signing_context(predecessor, HEIR, SIGN_DEPOSIT, 300);
        rejected_unchanged(&mut contract, "Unauthorized actor", |c| {
            drop(c.request_eth_release(U64(0), U128(1), U128(2), U128(1), U64(21_000)));
        });
    }
    signing_context(HEIR, HEIR, 0, 300);
    rejected_unchanged(&mut contract, "Heir must attach MPC signing deposit", |c| {
        drop(c.request_eth_release(U64(0), U128(1), U128(2), U128(1), U64(21_000)));
    });
    signing_context(HEIR, HEIR, SIGN_DEPOSIT, 284);
    rejected_unchanged(&mut contract, "Attach 300 Tgas for MPC signing", |c| {
        drop(c.request_eth_release(U64(0), U128(1), U128(2), U128(1), U64(21_000)));
    });
    signing_context(HEIR, HEIR, SIGN_DEPOSIT, 300);
    rejected_unchanged(&mut contract, "Gas limit must be between 21000 and 1000000", |c| {
        drop(c.request_eth_release(U64(0), U128(1), U128(2), U128(1), U64(20_999)));
    });
    signing_context(HEIR, ANYONE, SIGN_DEPOSIT, 300);
    drop(contract.request_eth_release(U64(0), U128(1), U128(2), U128(1), U64(21_000)));
    signing_context(HEIR, HEIR, SIGN_DEPOSIT, 300);
    rejected_unchanged(&mut contract, "Signature already in flight", |c| {
        drop(c.request_eth_release(U64(1), U128(1), U128(2), U128(1), U64(21_000)));
    });
}

#[test]
fn signing_receipt_forwards_only_heir_deposit_and_the_official_v2_hash() {
    let mut contract = finalized_vault();
    let credits = contract.credits;
    let id = request(&mut contract, 7);
    let pending = contract.pending_signature.as_ref().unwrap();
    assert_eq!(pending.deposit.as_yoctonear(), SIGN_DEPOSIT);
    assert_eq!(pending.transaction.nonce, 7);
    assert_eq!(contract.credits, credits);
    assert_eq!(contract.vault_assets, ZERO);
    let receipts = get_created_receipts();
    assert_eq!(receipts.len(), 2);
    assert_eq!(receipts[0].receiver_id, account("v1.signer-prod.testnet"));
    let sign_args = receipts[0].actions.iter().find_map(|action| {
        if let MockAction::FunctionCallWeight { method_name, args, attached_deposit, prepaid_gas, .. } = action {
            assert_eq!(method_name.as_slice(), b"sign");
            assert_eq!(attached_deposit.as_yoctonear(), SIGN_DEPOSIT);
            assert_eq!(*prepaid_gas, MPC_GAS);
            Some(serde_json::from_slice::<serde_json::Value>(args).unwrap())
        } else { None }
    }).expect("MPC function call");
    assert_eq!(sign_args, json!({"request": {
        "path": "ethereum-1", "domain_id": 0,
        "payload_v2": {"Ecdsa": hex(&pending.transaction.hash)[2..].to_owned()},
    }}));
    assert_eq!(receipts[1].receiver_id, account(VAULT));
    assert!(receipts[1].actions.iter().any(|action| matches!(action,
        MockAction::FunctionCallWeight { method_name, args, attached_deposit, prepaid_gas, .. }
        if method_name.as_slice() == b"on_eth_signature"
            && serde_json::from_slice::<serde_json::Value>(args).unwrap() == json!({"request_id":id.to_string()})
            && *attached_deposit == ZERO && *prepaid_gas == SIGN_CALLBACK_GAS)));
}

#[test]
fn failed_signing_credits_exact_deposit_without_assuming_a_runtime_refund() {
    let mut contract = finalized_vault();
    let before = contract.credits[1].as_yoctonear();
    let id = request(&mut contract, 0);
    callback(vec![PromiseResult::Failed]);
    let balance_before = env::account_balance();
    let result = contract.on_eth_signature(U64(id));
    assert!(!result.success);
    assert!(result.release.is_none());
    assert_eq!(result.refund_credited.0, SIGN_DEPOSIT);
    assert_eq!(contract.credits[1].as_yoctonear(), before + SIGN_DEPOSIT);
    assert_eq!(env::account_balance(), balance_before);
    assert!(contract.pending_signature.is_none());
    assert!(contract.eth_release.is_none());
    assert!(get_created_receipts().is_empty());
    let before = snapshot(&contract);
    let replay = contract.on_eth_signature(U64(id));
    assert!(!replay.success);
    assert_eq!(replay.refund_credited.0, 0);
    assert_eq!(snapshot(&contract), before);
}

#[test]
fn successful_signing_stores_the_dto_and_replays_cannot_replace_it() {
    let mut contract = finalized_vault();
    let before = contract.credits;
    let id = request(&mut contract, 7);
    let unsigned = contract.pending_signature.as_ref().unwrap().transaction.unsigned.clone();
    callback(vec![PromiseResult::Successful(signature_bytes())]);
    let result = contract.on_eth_signature(U64(id));
    assert!(result.success);
    assert_eq!(result.refund_credited.0, 0);
    let release = result.release.unwrap();
    assert_eq!(release.nonce.0, 7);
    assert_eq!(release.value_wei.0, 1);
    assert_eq!(release.unsigned_tx_hex, hex(&unsigned));
    assert_eq!(release.payload_hex, hex(&env::keccak256(&unsigned)));
    assert_eq!(release.signature, signature_value(0));
    assert!(contract.pending_signature.is_none());
    assert_eq!(contract.credits, before);
    assert_eq!(snapshot(&contract)["eth_release"], serde_json::to_value(&release).unwrap());
    let view = snapshot(&contract);
    let replay = contract.on_eth_signature(U64(id));
    assert!(!replay.success);
    assert!(replay.release.is_none());
    assert_eq!(replay.refund_credited.0, 0);
    assert_eq!(snapshot(&contract), view);
}

#[test]
fn failed_replacement_retains_old_signature_and_stale_callback_does_not_cancel_new_request() {
    let mut contract = finalized_vault();
    let old_id = request(&mut contract, 0);
    callback(vec![PromiseResult::Successful(signature_bytes())]);
    assert!(contract.on_eth_signature(U64(old_id)).success);
    let old_release = snapshot(&contract)["eth_release"].clone();
    let new_id = request(&mut contract, 1);
    assert!(new_id > old_id);
    assert_eq!(snapshot(&contract)["eth_release"], old_release);
    callback(vec![PromiseResult::Failed]);
    let stale = contract.on_eth_signature(U64(old_id));
    assert!(!stale.success);
    assert_eq!(stale.refund_credited.0, 0);
    assert_eq!(contract.pending_signature.as_ref().unwrap().id, new_id);
    let before = contract.credits[1].as_yoctonear();
    let failed = contract.on_eth_signature(U64(new_id));
    assert!(!failed.success);
    assert_eq!(failed.refund_credited.0, SIGN_DEPOSIT);
    assert_eq!(contract.credits[1].as_yoctonear(), before + SIGN_DEPOSIT);
    assert_eq!(snapshot(&contract)["eth_release"], old_release);
}

#[test]
fn malformed_wrong_scheme_oversized_and_invalid_recovery_signatures_restore_deposit() {
    let mut bad_point = signature_value(0);
    bad_point["big_r"]["affine_point"] = json!("11".repeat(32));
    let mut bad_scalar = signature_value(0);
    bad_scalar["s"]["scalar"] = json!("07".repeat(31));
    let inputs = vec![
        b"null".to_vec(), b"not json".to_vec(),
        serde_json::to_vec(&json!({"scheme":"Ed25519", "signature":vec![7u8; 64]})).unwrap(),
        serde_json::to_vec(&signature_value(2)).unwrap(),
        serde_json::to_vec(&bad_point).unwrap(), serde_json::to_vec(&bad_scalar).unwrap(),
        vec![b' '; 1025],
    ];
    for bytes in inputs {
        let mut contract = finalized_vault();
        let before = contract.credits[1].as_yoctonear();
        let id = request(&mut contract, 0);
        assert!(!mpc::valid_response(&bytes));
        callback(vec![PromiseResult::Successful(bytes)]);
        let result = contract.on_eth_signature(U64(id));
        assert!(!result.success);
        assert!(result.release.is_none());
        assert_eq!(result.refund_credited.0, SIGN_DEPOSIT);
        assert_eq!(contract.credits[1].as_yoctonear(), before + SIGN_DEPOSIT);
        assert!(contract.pending_signature.is_none());
    }
    assert!(mpc::valid_response(&serde_json::to_vec(&signature_value(1)).unwrap()));
}

#[test]
fn signature_callback_requires_one_result_and_matching_request_id() {
    let mut contract = finalized_vault();
    let id = request(&mut contract, 0);
    for results in [vec![], vec![PromiseResult::Failed, PromiseResult::Failed]] {
        callback(results);
        let before = snapshot(&contract);
        let result = contract.on_eth_signature(U64(id));
        assert!(!result.success);
        assert_eq!(result.refund_credited.0, 0);
        assert_eq!(snapshot(&contract), before);
    }
    callback(vec![PromiseResult::Successful(signature_bytes())]);
    let before = snapshot(&contract);
    let result = contract.on_eth_signature(U64(id + 1));
    assert!(!result.success);
    assert_eq!(result.refund_credited.0, 0);
    assert_eq!(snapshot(&contract), before);
    assert!(contract.on_eth_signature(U64(id)).success);
}

#[test]
fn mpc_failure_credit_can_accrue_while_heir_payout_is_in_flight() {
    let mut contract = finalized_vault();
    context(HEIR, DEADLINE, 0);
    drop(contract.withdraw_payout());
    let payout_id = contract.pending_payouts[1].as_ref().unwrap().id;
    let sign_id = request(&mut contract, 0);
    assert!(sign_id > payout_id);
    callback(vec![PromiseResult::Failed]);
    assert_eq!(contract.on_eth_signature(U64(sign_id)).refund_credited.0, SIGN_DEPOSIT);
    assert_eq!(contract.credits[1].as_yoctonear(), SIGN_DEPOSIT);
    assert!(!contract.on_payout_complete(Actor::Heir, U64(payout_id)));
    assert_eq!(contract.credits[1].as_yoctonear(), ASSETS + BOND + SIGN_DEPOSIT);
    assert!(contract.pending_payouts[1].is_none());
}

#[test]
fn liquidity_reserves_vault_credits_signing_deposit_and_operating_buffer() {
    let mut contract = finalized_vault();
    let id = request(&mut contract, 0);
    let liabilities = ASSETS + BOND + SIGN_DEPOSIT;
    assert_eq!(contract.held_liabilities().as_yoctonear(), liabilities);
    let mut low_balance = builder(VAULT, HEIR, DEADLINE, 0);
    low_balance.storage_usage(0).account_balance(NearToken::from_yoctonear(liabilities + BOND));
    testing_env!(low_balance.build());
    // This pure guard test avoids asserting transaction rollback after mutation.
    rejected("Insufficient operating surplus", || contract.assert_liquidity(NearToken::from_yoctonear(SIGN_DEPOSIT)));
    callback(vec![PromiseResult::Failed]);
    assert_eq!(contract.on_eth_signature(U64(id)).refund_credited.0, SIGN_DEPOSIT);
    assert_eq!(contract.held_liabilities().as_yoctonear(), liabilities);
}

#[test]
fn shared_branch_vectors_match_serialized_public_snapshots() {
    let vectors: serde_json::Value = serde_json::from_str(include_str!("../../test-vectors/branches.json"))
        .expect("Shared branch vectors are valid JSON");
    let config = &vectors["config"];
    let decimal = |value: &serde_json::Value| -> u128 {
        value.as_str().expect("Decimal string").parse().expect("Valid u128")
    };
    let timestamp = |value: &serde_json::Value| -> u64 {
        value.as_str().expect("Timestamp string").parse().expect("Valid u64")
    };
    assert_eq!(timestamp(&config["heartbeat_ns"]), HEARTBEAT);
    assert_eq!(timestamp(&config["grace_ns"]), GRACE);
    assert_eq!(timestamp(&config["extension_ns"]), EXTENSION);
    assert_eq!(decimal(&config["bond_yocto"]), BOND);
    assert_eq!(decimal(&config["vault_yocto"]), ASSETS);
    let cases = vectors["cases"].as_array().expect("Vector cases");
    assert!(!cases.is_empty());
    let mut outcomes = std::collections::HashSet::new();
    for case in cases {
        let name = case["name"].as_str().expect("Case name");
        context(OWNER, 0, 0);
        let mut contract = initialize(
            [OWNER, HEIR, RIVAL], ADDRESS,
            [timestamp(&config["heartbeat_ns"]), timestamp(&config["grace_ns"]), timestamp(&config["extension_ns"])],
            decimal(&config["bond_yocto"]),
        );
        context(OWNER, 0, decimal(&config["vault_yocto"]));
        contract.deposit_vault();
        for step in case["steps"].as_array().expect("Case steps") {
            let actor = match step["actor"].as_str().expect("Step actor") {
                "owner" => OWNER, "heir" => HEIR, "rival" => RIVAL, "anyone" => ANYONE,
                actor => panic!("Unknown actor {actor} in {name}"),
            };
            let deposit = step.get("deposit").map_or(0, &decimal);
            context(actor, timestamp(&step["at_ns"]), deposit);
            let before = near_sdk::borsh::to_vec(&contract).unwrap();
            let view = snapshot(&contract);
            let result = catch_unwind(AssertUnwindSafe(|| {
                match step["call"].as_str().expect("Step call") {
                    "initiate_claim" => contract.initiate_claim(),
                    "challenge_claim" => contract.challenge_claim(),
                    "check_in" => contract.check_in(),
                    "finalize_inheritance" => contract.finalize_inheritance(),
                    "owner_withdraw_near" => contract.owner_withdraw_near(U128(decimal(&step["amount"]))),
                    "deposit_vault" => contract.deposit_vault(),
                    call => panic!("Unknown call {call} in {name}"),
                }
            }));
            if step.get("reject").and_then(serde_json::Value::as_bool).unwrap_or(false) {
                assert!(result.is_err(), "{name}: expected rejection for {step}");
                assert_eq!(near_sdk::borsh::to_vec(&contract).unwrap(), before, "{name}: rejection mutated state");
                assert_eq!(snapshot(&contract), view, "{name}: rejection mutated snapshot");
            } else {
                assert!(result.is_ok(), "{name}: unexpected rejection for {step}");
            }
        }
        let actual = snapshot(&contract);
        let expected = &case["expected"];
        assert_eq!(actual["state"]["status"], expected["status"], "{name}");
        assert_eq!(actual["last_outcome"], expected["outcome"], "{name}");
        assert_eq!(actual["credits"], expected["credits"], "{name}");
        assert_eq!(actual["vault_assets"], expected["vault_assets"], "{name}");
        outcomes.insert(expected["outcome"].as_str().unwrap().to_owned());
    }
    for outcome in ["FalseAlarm", "Busted", "Uncontested", "SpiteBackfired"] {
        assert!(outcomes.contains(outcome), "Shared vectors must cover {outcome}");
    }
}
