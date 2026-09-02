//! # ROTR Token Contract (Soroban)
//!
//! SEP-41 compatible token with built-in reward distribution
//! for the RoTraff road safety platform.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

#[contracttype]
pub enum DataKey {
    Balance(Address),
    Allowance(Address, Address),
    Admin,
    ReportReward,
    VerifyReward,
    TotalSupply,
    RewardLedger(u64),
    RewardCount,
}

#[contracttype]
pub struct RewardEntry {
    pub user: Address,
    pub amount: i128,
    pub reason: Symbol,
    pub incident_id: u64,
    pub timestamp: u64,
}

#[contract]
pub struct RotrToken;

#[contractimpl]
impl RotrToken {
    pub fn initialize(env: Env, admin: Address, report_reward: i128, verify_reward: i128) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::ReportReward, &report_reward);
        env.storage()
            .instance()
            .set(&DataKey::VerifyReward, &verify_reward);
        env.storage().instance().set(&DataKey::TotalSupply, &0_i128);
        env.storage().instance().set(&DataKey::RewardCount, &0_u64);
    }

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get::<_, Address>(&DataKey::Admin)
            .unwrap()
    }

    pub fn set_report_reward(env: Env, admin: Address, new_amount: i128) {
        Self::require_admin(&env, &admin);
        env.storage()
            .instance()
            .set(&DataKey::ReportReward, &new_amount);
    }

    pub fn set_verify_reward(env: Env, admin: Address, new_amount: i128) {
        Self::require_admin(&env, &admin);
        env.storage()
            .instance()
            .set(&DataKey::VerifyReward, &new_amount);
    }

    pub fn report_reward(env: Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&DataKey::ReportReward)
            .unwrap_or(5)
    }

    pub fn verify_reward(env: Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&DataKey::VerifyReward)
            .unwrap_or(2)
    }

    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        Self::require_admin(&env, &admin);
        Self::increase_balance(&env, &to, amount);
    }

    pub fn reward_report(env: Env, admin: Address, user: Address, incident_id: u64) -> i128 {
        Self::require_admin(&env, &admin);
        let amount = Self::report_reward(env.clone());
        Self::increase_balance(&env, &user, amount);
        Self::log_reward(&env, &user, amount, symbol_short!("report"), incident_id);
        amount
    }

    pub fn reward_verification(env: Env, admin: Address, user: Address, incident_id: u64) -> i128 {
        Self::require_admin(&env, &admin);
        let amount = Self::verify_reward(env.clone());
        Self::increase_balance(&env, &user, amount);
        Self::log_reward(&env, &user, amount, symbol_short!("verify"), incident_id);
        amount
    }

    pub fn get_reward(env: Env, index: u64) -> RewardEntry {
        env.storage()
            .persistent()
            .get::<_, RewardEntry>(&DataKey::RewardLedger(index))
            .unwrap()
    }

    pub fn reward_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get::<_, u64>(&DataKey::RewardCount)
            .unwrap_or(0)
    }

    pub fn name(env: Env) -> soroban_sdk::String {
        soroban_sdk::String::from_str(&env, "RoTraff ROTR Token")
    }

    pub fn symbol(env: Env) -> soroban_sdk::String {
        soroban_sdk::String::from_str(&env, "ROTR")
    }

    pub fn decimals(_env: Env) -> u32 {
        0
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get::<_, i128>(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn balance(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::Balance(user))
            .unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::decrease_balance(&env, &from, amount);
        Self::increase_balance(&env, &to, amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        Self::decrease_allowance(&env, &from, &spender, amount);
        Self::decrease_balance(&env, &from, amount);
        Self::increase_balance(&env, &to, amount);
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        live_after: Option<u32>,
    ) {
        from.require_auth();
        let key = DataKey::Allowance(from.clone(), spender.clone());
        if let Some(la) = live_after {
            if env.ledger().sequence() >= la {
                env.storage().persistent().set(&key, &amount);
            } else {
                env.storage().persistent().set(&key, &(-1_i128));
            }
        } else {
            env.storage().persistent().set(&key, &amount);
        }
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::Allowance(from, spender))
            .unwrap_or(0)
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if *caller != admin {
            panic!("not authorized: only admin");
        }
    }

    fn increase_balance(env: &Env, user: &Address, amount: i128) {
        let key = DataKey::Balance(user.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_balance = current
            .checked_add(amount)
            .unwrap_or_else(|| panic!("overflow"));
        env.storage().persistent().set(&key, &new_balance);
        let total_key = DataKey::TotalSupply;
        let supply: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
        let new_supply = supply
            .checked_add(amount)
            .unwrap_or_else(|| panic!("overflow"));
        env.storage().instance().set(&total_key, &new_supply);
    }

    fn decrease_balance(env: &Env, user: &Address, amount: i128) {
        let key = DataKey::Balance(user.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_balance = current
            .checked_sub(amount)
            .unwrap_or_else(|| panic!("insufficient balance"));
        env.storage().persistent().set(&key, &new_balance);
        let total_key = DataKey::TotalSupply;
        let supply: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
        let new_supply = supply
            .checked_sub(amount)
            .unwrap_or_else(|| panic!("underflow"));
        env.storage().instance().set(&total_key, &new_supply);
    }

    fn decrease_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) {
        let key = DataKey::Allowance(from.clone(), spender.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_allowance = current
            .checked_sub(amount)
            .unwrap_or_else(|| panic!("insufficient allowance"));
        env.storage().persistent().set(&key, &new_allowance);
    }

    fn log_reward(env: &Env, user: &Address, amount: i128, reason: Symbol, incident_id: u64) {
        let count_key = DataKey::RewardCount;
        let index: u64 = env.storage().instance().get(&count_key).unwrap_or(0);
        let entry = RewardEntry {
            user: user.clone(),
            amount,
            reason,
            incident_id,
            timestamp: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::RewardLedger(index), &entry);
        env.storage().instance().set(&count_key, &(index + 1));
    }
}
