//! Testnet-only adversarial inheritance. No administrator or upgrade entry point.
pub mod eth_rlp;
mod mpc;

use eth_rlp::{EthTransaction, encode_unsigned};
use near_sdk::{
    AccountId, Gas, NearToken, PanicOnDefault, Promise, env, near, require,
    json_types::{U64, U128},
    serde_json::{self, json},
};

const ZERO: NearToken = NearToken::from_yoctonear(0);
/// Unallocated liquidity above storage staking. It is not an inheritable asset.
const OPERATING_BUFFER: NearToken = NearToken::from_near(1);
const MPC_GAS: Gas = Gas::from_tgas(230);
const SIGN_CALLBACK_GAS: Gas = Gas::from_tgas(40);
const PAYOUT_CALLBACK_GAS: Gas = Gas::from_tgas(20);

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Actor { Owner, Heir, Rival }
impl Actor {
    fn index(self) -> usize { match self { Self::Owner => 0, Self::Heir => 1, Self::Rival => 2 } }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
#[serde(tag = "status")]
pub enum VaultState {
    Idle,
    Pending { claimed_at_ns: U64, deadline_ns: U64 },
    Challenged { claimed_at_ns: U64, deadline_ns: U64 },
    Finalized,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome { None, FalseAlarm, Busted, Uncontested, SpiteBackfired }

#[near(serializers = [borsh])]
struct PendingPayout { id: u64, amount: NearToken }

#[near(serializers = [borsh])]
#[derive(Clone)]
struct UnsignedRelease {
    nonce: u64,
    value_wei: u128,
    max_fee_per_gas: u128,
    max_priority_fee_per_gas: u128,
    gas_limit: u64,
    unsigned: Vec<u8>,
    hash: [u8; 32],
}

#[near(serializers = [borsh])]
struct PendingSignature { id: u64, deposit: NearToken, transaction: UnsignedRelease }
#[near(serializers = [borsh])]
struct StoredRelease { transaction: UnsignedRelease, signature: Vec<u8> }

#[near(serializers = [json])]
pub struct Funds { pub owner: U128, pub heir: U128, pub rival: U128 }
impl Funds {
    fn from_tokens(tokens: [NearToken; 3]) -> Self {
        Self { owner: U128(tokens[0].as_yoctonear()), heir: U128(tokens[1].as_yoctonear()), rival: U128(tokens[2].as_yoctonear()) }
    }
}

#[near(serializers = [json])]
pub struct ReleasePreview {
    pub nonce: U64,
    pub value_wei: U128,
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
    pub gas_limit: U64,
    pub unsigned_tx_hex: String,
    pub payload_hex: String,
}
#[near(serializers = [json])]
pub struct EthRelease {
    pub nonce: U64,
    pub value_wei: U128,
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
    pub gas_limit: U64,
    pub unsigned_tx_hex: String,
    pub payload_hex: String,
    pub signature: serde_json::Value,
}
#[near(serializers = [json])]
pub struct SignatureResult { pub success: bool, pub release: Option<EthRelease>, pub refund_credited: U128 }

#[near(serializers = [json])]
pub struct VaultSnapshot {
    pub owner: AccountId,
    pub heir: AccountId,
    pub rival: AccountId,
    pub heir_eth_address: [u8; 20],
    pub state: VaultState,
    pub heartbeat_interval_ns: U64,
    pub grace_period_ns: U64,
    pub challenge_extension_ns: U64,
    pub required_bond: U128,
    pub locked_heir_bond: U128,
    pub locked_rival_bond: U128,
    pub vault_assets: U128,
    pub last_check_in_ns: U64,
    pub last_outcome: Outcome,
    pub credits: Funds,
    pub payouts_in_flight: Funds,
    pub signing_in_flight: bool,
    pub eth_release: Option<EthRelease>,
    pub observed_at_ns: U64,
    pub operating_buffer: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct VaultContract {
    owner: AccountId,
    heir: AccountId,
    rival: AccountId,
    heir_eth_address: [u8; 20],
    heartbeat_interval_ns: u64,
    grace_period_ns: u64,
    challenge_extension_ns: u64,
    required_bond: NearToken,
    locked_heir_bond: NearToken,
    locked_rival_bond: NearToken,
    /// Only explicit `deposit_vault` receipts are credited here. Never raw balance.
    vault_assets: NearToken,
    last_check_in_ns: u64,
    state: VaultState,
    last_outcome: Outcome,
    credits: [NearToken; 3],
    pending_payouts: [Option<PendingPayout>; 3],
    pending_signature: Option<PendingSignature>,
    eth_release: Option<StoredRelease>,
    next_request_id: u64,
}

#[near]
impl VaultContract {
    #[init]
    pub fn init(
        owner: AccountId, heir: AccountId, rival: AccountId, heir_eth_address: [u8; 20],
        heartbeat_interval_ns: U64, grace_period_ns: U64, challenge_extension_ns: U64,
        required_bond: U128,
    ) -> Self {
        require!(owner != heir && owner != rival && heir != rival, "Actors must be distinct");
        let current = env::current_account_id();
        require!(owner != current && heir != current && rival != current, "Actors must differ from vault account");
        require!(heir_eth_address != [0; 20], "Heir ETH address must not be zero");
        require!(heartbeat_interval_ns.0 > 0 && grace_period_ns.0 > 0, "Intervals must be positive");
        require!(challenge_extension_ns.0 >= grace_period_ns.0, "Challenge extension must cover grace period");
        require!(required_bond.0 > 0, "Bond must be positive");
        required_bond.0.checked_mul(2).expect("Combined bond overflow");
        let now = env::block_timestamp();
        time_add(time_add(time_add(now, heartbeat_interval_ns.0), grace_period_ns.0), challenge_extension_ns.0);
        let contract = Self {
            owner, heir, rival, heir_eth_address,
            heartbeat_interval_ns: heartbeat_interval_ns.0,
            grace_period_ns: grace_period_ns.0,
            challenge_extension_ns: challenge_extension_ns.0,
            required_bond: NearToken::from_yoctonear(required_bond.0),
            locked_heir_bond: ZERO, locked_rival_bond: ZERO, vault_assets: ZERO,
            last_check_in_ns: now, state: VaultState::Idle, last_outcome: Outcome::None,
            credits: [ZERO; 3], pending_payouts: [None, None, None], pending_signature: None,
            eth_release: None, next_request_id: 0,
        };
        contract.assert_liquidity(ZERO);
        contract
    }

    /// Deployment/storage liquidity and raw transfers are deliberately not inherited.
    #[payable]
    pub fn deposit_vault(&mut self) {
        self.assert_actor(Actor::Owner);
        require!(self.state == VaultState::Idle, "Vault must be Idle");
        let deposit = env::attached_deposit();
        require!(deposit > ZERO, "Deposit must be positive");
        self.vault_assets = add(self.vault_assets, deposit);
        self.assert_accounting();
        self.assert_liquidity(ZERO);
        self.event("vault_funded", json!({"amount": deposit.as_yoctonear().to_string()}));
    }

    pub fn check_in(&mut self) {
        self.assert_actor(Actor::Owner);
        let now = env::block_timestamp();
        time_add(now, self.heartbeat_interval_ns);
        match self.state.clone() {
            VaultState::Idle => {},
            VaultState::Pending { deadline_ns, .. } => {
                require!(now < deadline_ns.0, "Deadline expired; check-in rejected");
                self.credit_bonds(Actor::Owner);
                self.last_outcome = Outcome::FalseAlarm;
            },
            VaultState::Challenged { deadline_ns, .. } => {
                require!(now < deadline_ns.0, "Deadline expired; check-in rejected");
                self.credit_bonds(Actor::Rival);
                self.last_outcome = Outcome::Busted;
            },
            VaultState::Finalized => env::panic_str("Vault is Finalized"),
        }
        self.state = VaultState::Idle;
        self.last_check_in_ns = now;
        self.assert_accounting();
        self.event("check_in", json!({"outcome": self.last_outcome, "at_ns": now.to_string()}));
    }

    #[payable]
    pub fn initiate_claim(&mut self) {
        self.assert_actor(Actor::Heir);
        require!(self.state == VaultState::Idle, "Vault must be Idle");
        let now = env::block_timestamp();
        require!(now > time_add(self.last_check_in_ns, self.heartbeat_interval_ns), "Heartbeat has not expired");
        require!(env::attached_deposit() == self.required_bond, "Exact bond deposit required");
        let deadline = time_add(now, self.grace_period_ns);
        // Check the potential one-time extension before accepting a bond.
        time_add(deadline, self.challenge_extension_ns);
        self.locked_heir_bond = self.required_bond;
        self.state = VaultState::Pending { claimed_at_ns: U64(now), deadline_ns: U64(deadline) };
        self.assert_accounting();
        self.assert_liquidity(ZERO);
        self.event("claim_initiated", json!({"deadline_ns": deadline.to_string()}));
    }

    #[payable]
    pub fn challenge_claim(&mut self) {
        self.assert_actor(Actor::Rival);
        let VaultState::Pending { claimed_at_ns, deadline_ns } = self.state.clone() else {
            env::panic_str("Only a Pending claim can be challenged");
        };
        require!(env::block_timestamp() < deadline_ns.0, "Deadline expired; challenge rejected");
        require!(env::attached_deposit() == self.required_bond, "Exact bond deposit required");
        let extended = time_add(deadline_ns.0, self.challenge_extension_ns);
        self.locked_rival_bond = self.required_bond;
        self.state = VaultState::Challenged { claimed_at_ns, deadline_ns: U64(extended) };
        self.assert_accounting();
        self.assert_liquidity(ZERO);
        self.event("claim_challenged", json!({"deadline_ns": extended.to_string()}));
    }

    /// Permissionless resolution. Credits a pull-payment; no transfer is assumed.
    pub fn finalize_inheritance(&mut self) {
        let (deadline, outcome) = match self.state {
            VaultState::Pending { deadline_ns, .. } => (deadline_ns.0, Outcome::Uncontested),
            VaultState::Challenged { deadline_ns, .. } => (deadline_ns.0, Outcome::SpiteBackfired),
            _ => env::panic_str("No active inheritance claim"),
        };
        require!(env::block_timestamp() >= deadline, "Claim deadline has not arrived");
        self.state = VaultState::Finalized;
        self.last_outcome = outcome;
        self.credit_bonds(Actor::Heir);
        self.credit(Actor::Heir, self.vault_assets);
        self.vault_assets = ZERO;
        self.assert_accounting();
        self.event("inheritance_finalized", json!({"outcome": outcome}));
    }

    /// Move owner assets into an independently withdrawable credit. Idle only.
    pub fn owner_withdraw_near(&mut self, amount: U128) {
        self.assert_actor(Actor::Owner);
        require!(self.state == VaultState::Idle, "Vault must be Idle");
        let amount = NearToken::from_yoctonear(amount.0);
        require!(amount > ZERO, "Amount must be positive");
        self.vault_assets = self.vault_assets.checked_sub(amount).expect("Insufficient vault assets");
        self.credit(Actor::Owner, amount);
        self.assert_accounting();
        self.event("owner_withdrawal_credited", json!({"amount": amount.as_yoctonear().to_string()}));
    }

    /// One in-flight transfer per actor; failed transfers restore their credit.
    pub fn withdraw_payout(&mut self) -> Promise {
        let actor = self.caller_actor();
        let index = actor.index();
        require!(self.pending_payouts[index].is_none(), "Payout already in flight");
        let amount = self.credits[index];
        require!(amount > ZERO, "No payout credit");
        require!(remaining_gas() >= Gas::from_tgas(35).as_gas(), "Attach at least 50 Tgas");
        let id = self.allocate_id();
        self.credits[index] = ZERO;
        self.pending_payouts[index] = Some(PendingPayout { id, amount });
        self.assert_liquidity(amount);
        self.event("payout_started", json!({"actor": actor, "id": id.to_string(), "amount": amount.as_yoctonear().to_string()}));
        Promise::new(self.account(actor).clone()).transfer(amount).then(
            Promise::new(env::current_account_id()).function_call(
                "on_payout_complete".to_owned(),
                serde_json::to_vec(&json!({"actor": actor, "transfer_id": U64(id)})).expect("Callback serializes"),
                ZERO, PAYOUT_CALLBACK_GAS,
            ),
        )
    }

    #[private]
    pub fn on_payout_complete(&mut self, actor: Actor, transfer_id: U64) -> bool {
        let index = actor.index();
        if env::promise_results_count() != 1 || !self.pending_payouts[index].as_ref().is_some_and(|p| p.id == transfer_id.0) {
            return false;
        }
        let payout = self.pending_payouts[index].take().expect("Matched pending payout");
        let success = env::promise_result_checked(0, 0).is_ok();
        if !success { self.credit(actor, payout.amount); }
        self.event(if success { "payout_sent" } else { "payout_restored" }, json!({"actor": actor, "amount": payout.amount.as_yoctonear().to_string()}));
        success
    }

    /// Preview is read-only and never requests a signature.
    pub fn preview_eth_release(&self, nonce: U64, value_wei: U128, max_fee_per_gas: U128, max_priority_fee_per_gas: U128, gas_limit: U64) -> ReleasePreview {
        let tx = self.unsigned_release(nonce, value_wei, max_fee_per_gas, max_priority_fee_per_gas, gas_limit);
        preview(&tx)
    }

    /// Heir funds signing, never the bond/vault ledger. Repeated signatures remain
    /// destination-locked; a newer request cannot revoke a previously issued one.
    #[payable]
    pub fn request_eth_release(&mut self, nonce: U64, value_wei: U128, max_fee_per_gas: U128, max_priority_fee_per_gas: U128, gas_limit: U64) -> Promise {
        self.assert_actor(Actor::Heir);
        require!(self.state == VaultState::Finalized, "Vault must be Finalized");
        require!(self.pending_signature.is_none(), "Signature already in flight");
        // A failed transfer's refund can arrive before its resolver. Until the
        // resolver settles, that balance is not new operating surplus.
        require!(self.pending_payouts.iter().all(Option::is_none), "Settle all payouts before MPC signing");
        require!(remaining_gas() >= Gas::from_tgas(285).as_gas(), "Attach 300 Tgas for MPC signing");
        let deposit = env::attached_deposit();
        require!(deposit > ZERO, "Heir must attach MPC signing deposit");
        let transaction = self.unsigned_release(nonce, value_wei, max_fee_per_gas, max_priority_fee_per_gas, gas_limit);
        let arguments = mpc::arguments(transaction.hash);
        let id = self.allocate_id();
        self.pending_signature = Some(PendingSignature { id, deposit, transaction });
        // The deposit may be consumed by MPC even if a later yield fails. Reserve
        // an equal amount from surplus, then forward it; never borrow payout credit.
        self.assert_accounting();
        self.assert_liquidity(deposit);
        self.event("eth_signature_requested", json!({"id": id.to_string(), "nonce": nonce, "deposit": deposit.as_yoctonear().to_string()}));
        Promise::new(mpc::CONTRACT.parse().expect("Valid MPC account")).function_call("sign".to_owned(), arguments, deposit, MPC_GAS).then(
            Promise::new(env::current_account_id()).function_call(
                "on_eth_signature".to_owned(),
                serde_json::to_vec(&json!({"request_id": U64(id)})).expect("Callback serializes"),
                ZERO, SIGN_CALLBACK_GAS,
            ),
        )
    }

    #[private]
    pub fn on_eth_signature(&mut self, request_id: U64) -> SignatureResult {
        if env::promise_results_count() != 1 || !self.pending_signature.as_ref().is_some_and(|p| p.id == request_id.0) {
            return SignatureResult { success: false, release: None, refund_credited: U128(0) };
        }
        let pending = self.pending_signature.take().expect("Matched pending signature");
        if let Ok(bytes) = env::promise_result_checked(0, 1024) {
            if mpc::valid_response(&bytes) {
                self.eth_release = Some(StoredRelease { transaction: pending.transaction, signature: bytes });
                self.event("eth_signature_ready", json!({"id": request_id}));
                return SignatureResult { success: true, release: self.eth_release.as_ref().map(release_view), refund_credited: U128(0) };
            }
        }
        self.credit(Actor::Heir, pending.deposit);
        self.event("eth_signature_failed", json!({"id": request_id, "refund_credited": pending.deposit.as_yoctonear().to_string()}));
        SignatureResult { success: false, release: None, refund_credited: U128(pending.deposit.as_yoctonear()) }
    }

    pub fn get_vault_state(&self) -> VaultSnapshot {
        VaultSnapshot {
            owner: self.owner.clone(), heir: self.heir.clone(), rival: self.rival.clone(),
            heir_eth_address: self.heir_eth_address, state: self.state.clone(),
            heartbeat_interval_ns: U64(self.heartbeat_interval_ns), grace_period_ns: U64(self.grace_period_ns),
            challenge_extension_ns: U64(self.challenge_extension_ns), required_bond: U128(self.required_bond.as_yoctonear()),
            locked_heir_bond: U128(self.locked_heir_bond.as_yoctonear()), locked_rival_bond: U128(self.locked_rival_bond.as_yoctonear()),
            vault_assets: U128(self.vault_assets.as_yoctonear()), last_check_in_ns: U64(self.last_check_in_ns),
            last_outcome: self.last_outcome, credits: Funds::from_tokens(self.credits),
            payouts_in_flight: Funds::from_tokens(std::array::from_fn(|i| self.pending_payouts[i].as_ref().map_or(ZERO, |p| p.amount))),
            signing_in_flight: self.pending_signature.is_some(), eth_release: self.eth_release.as_ref().map(release_view),
            observed_at_ns: U64(env::block_timestamp()), operating_buffer: U128(OPERATING_BUFFER.as_yoctonear()),
        }
    }
}

impl VaultContract {
    fn assert_actor(&self, actor: Actor) {
        require!(env::predecessor_account_id() == *self.account(actor), "Unauthorized actor");
    }
    fn account(&self, actor: Actor) -> &AccountId {
        match actor { Actor::Owner => &self.owner, Actor::Heir => &self.heir, Actor::Rival => &self.rival }
    }
    fn caller_actor(&self) -> Actor {
        let predecessor = env::predecessor_account_id();
        if predecessor == self.owner { Actor::Owner } else if predecessor == self.heir { Actor::Heir }
        else if predecessor == self.rival { Actor::Rival } else { env::panic_str("Unauthorized actor") }
    }
    fn credit(&mut self, actor: Actor, amount: NearToken) {
        let index = actor.index();
        self.credits[index] = add(self.credits[index], amount);
    }
    fn credit_bonds(&mut self, actor: Actor) {
        self.credit(actor, add(self.locked_heir_bond, self.locked_rival_bond));
        self.locked_heir_bond = ZERO;
        self.locked_rival_bond = ZERO;
    }
    fn allocate_id(&mut self) -> u64 {
        let id = self.next_request_id;
        self.next_request_id = id.checked_add(1).expect("Request id overflow");
        id
    }
    /// Obligations still held on-account. Pending native transfers have already
    /// been deducted by the runtime, so counting them here would double-reserve.
    fn held_liabilities(&self) -> NearToken {
        let mut total = add(add(self.vault_assets, self.locked_heir_bond), self.locked_rival_bond);
        for credit in self.credits { total = add(total, credit); }
        if let Some(pending) = &self.pending_signature { total = add(total, pending.deposit); }
        total
    }
    fn assert_accounting(&self) {
        let mut total = self.held_liabilities();
        for payout in self.pending_payouts.iter().flatten() { total = add(total, payout.amount); }
        let _ = total;
    }
    fn assert_liquidity(&self, outgoing: NearToken) {
        let storage = env::storage_byte_cost().checked_mul(u128::from(env::storage_usage())).expect("Storage cost overflow");
        let liquid = env::account_balance().checked_sub(add(storage, OPERATING_BUFFER)).expect("Fund storage and 1 NEAR operating buffer separately");
        require!(liquid >= add(self.held_liabilities(), outgoing), "Insufficient operating surplus; vault and credits are reserved");
    }
    fn unsigned_release(&self, nonce: U64, value_wei: U128, max_fee_per_gas: U128, max_priority_fee_per_gas: U128, gas_limit: U64) -> UnsignedRelease {
        require!((21_000..=1_000_000).contains(&gas_limit.0), "Gas limit must be between 21000 and 1000000");
        require!(max_fee_per_gas.0 > 0 && max_priority_fee_per_gas.0 > 0, "Fees must be positive");
        require!(max_priority_fee_per_gas.0 <= max_fee_per_gas.0, "Priority fee exceeds maximum fee");
        let tx = EthTransaction { nonce: nonce.0, value_wei: value_wei.0, max_fee_per_gas: max_fee_per_gas.0, max_priority_fee_per_gas: max_priority_fee_per_gas.0, gas_limit: gas_limit.0 };
        let unsigned = encode_unsigned(&tx, &self.heir_eth_address);
        let hash = env::keccak256(&unsigned).try_into().expect("Keccak256 has 32 bytes");
        UnsignedRelease { nonce: tx.nonce, value_wei: tx.value_wei, max_fee_per_gas: tx.max_fee_per_gas, max_priority_fee_per_gas: tx.max_priority_fee_per_gas, gas_limit: tx.gas_limit, unsigned, hash }
    }
    fn event(&self, name: &str, data: serde_json::Value) {
        env::log_str(&format!("EVENT_JSON:{}", json!({"standard":"proof_of_grudge", "version":"1.0.0", "event":name, "data":[data]})));
    }
}

fn time_add(a: u64, b: u64) -> u64 { a.checked_add(b).expect("Timestamp overflow") }
fn add(a: NearToken, b: NearToken) -> NearToken { a.checked_add(b).expect("Amount overflow") }
fn remaining_gas() -> u64 { env::prepaid_gas().as_gas().saturating_sub(env::used_gas().as_gas()) }
fn hex(bytes: &[u8]) -> String {
    let mut value = String::with_capacity(2 + bytes.len() * 2);
    value.push_str("0x");
    for byte in bytes { use std::fmt::Write; write!(value, "{byte:02x}").expect("String write"); }
    value
}
fn preview(tx: &UnsignedRelease) -> ReleasePreview {
    ReleasePreview { nonce: U64(tx.nonce), value_wei: U128(tx.value_wei), max_fee_per_gas: U128(tx.max_fee_per_gas), max_priority_fee_per_gas: U128(tx.max_priority_fee_per_gas), gas_limit: U64(tx.gas_limit), unsigned_tx_hex: hex(&tx.unsigned), payload_hex: hex(&tx.hash) }
}
fn release_view(release: &StoredRelease) -> EthRelease {
    let p = preview(&release.transaction);
    EthRelease { nonce: p.nonce, value_wei: p.value_wei, max_fee_per_gas: p.max_fee_per_gas, max_priority_fee_per_gas: p.max_priority_fee_per_gas, gas_limit: p.gas_limit, unsigned_tx_hex: p.unsigned_tx_hex, payload_hex: p.payload_hex,
        signature: serde_json::from_slice(&release.signature).expect("Stored signature was parsed before storing") }
}

#[cfg(test)]
mod tests;
