/**
 * Stellar Testnet Service
 *
 * All @stellar/stellar-sdk usage is confined to this file.
 * No other file in the codebase should import the SDK directly.
 *
 * Custodial model: users never see/manage a Stellar secret key.
 * The backend generates a keypair per user, funds it via Friendbot,
 * and encrypts the secret key at rest (AES-256-GCM).
 */

import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
} from "@stellar/stellar-sdk";
import { encryptSecretKey, decryptSecretKey } from "./crypto-node";

// ── Config ────────────────────────────────────────────────────────────────

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new Horizon.Server(HORIZON_URL);

/** ROTR asset code — issued by the issuing account */
export const ROTR_ASSET_CODE = "ROTR";

function requiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

/**
 * Called lazily so missing env vars only fail when Stellar is actually used.
 * Values are read once per process.
 */
let _config: {
  issuingKeypair: Keypair;
  distributionKeypair: Keypair;
  rotAsset: Asset;
} | null = null;

function getConfig() {
  if (!_config) {
    const issuingSecret = requiredEnv("STELLAR_ISSUING_SECRET");
    const distributionSecret = requiredEnv("STELLAR_DISTRIBUTION_SECRET");

    _config = {
      issuingKeypair: Keypair.fromSecret(issuingSecret),
      distributionKeypair: Keypair.fromSecret(distributionSecret),
      rotAsset: new Asset(
        ROTR_ASSET_CODE,
        Keypair.fromSecret(issuingSecret).publicKey(),
      ),
    };
  }
  return _config;
}

// ── Key Generation ────────────────────────────────────────────────────────

export function generateKeypair(): Keypair {
  return Keypair.random();
}

// ── Account Funding (Friendbot) ───────────────────────────────────────────

export async function fundAccount(publicKey: string): Promise<void> {
  const resp = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!resp.ok) {
    throw new Error(
      `Friendbot funding failed for ${publicKey}: ${resp.status}`,
    );
  }
}

// ── Trustline (ChangeTrust for ROTR asset) ────────────────────────────────

export async function establishTrustline(
  userKeypair: Keypair,
): Promise<void> {
  const account = await server
    .loadAccount(userKeypair.publicKey())
    .catch(() => null);
  if (!account) return; // account not yet visible on Horizon

  const { rotAsset } = getConfig();
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: rotAsset,
        limit: "1000000000",
      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(userKeypair);
  await server.submitTransaction(tx);
}

// ── Provision Full Wallet ──────────────────────────────────────────────────

export interface ProvisionResult {
  publicKey: string;
  secretKeyEncrypted: string;
}

/**
 * Creates a new Stellar account on testnet, funds it via Friendbot,
 * and establishes a trustline to the ROTR asset.
 * Returns the public key and the AES-encrypted secret key (to store in DB).
 */
export async function provisionWallet(): Promise<ProvisionResult> {
  const userKeypair = generateKeypair();
  await fundAccount(userKeypair.publicKey());
  // Wait briefly for Horizon to index the new account
  await new Promise((r) => setTimeout(r, 2000));
  await establishTrustline(userKeypair);
  const secretKeyEncrypted = await encryptSecretKey(userKeypair.secret());

  return {
    publicKey: userKeypair.publicKey(),
    secretKeyEncrypted,
  };
}

// ── Send Reward (Payment from Distribution Account) ────────────────────────

export interface PaymentResult {
  hash: string;
}

/**
 * Sends `amount` ROTR from the distribution account to `recipientPublicKey`.
 * The distribution account must hold enough ROTR and have an active trustline.
 */
export async function sendRewardPayment(
  recipientPublicKey: string,
  amount: number,
): Promise<PaymentResult> {
  const { distributionKeypair, rotAsset } = getConfig();
  const distributionPub = distributionKeypair.publicKey();

  // Ensure distribution account has a trustline for ROTR
  await ensureDistributionTrustline();

  const account = await server.loadAccount(distributionPub);
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: recipientPublicKey,
        asset: rotAsset,
        amount: amount.toString(),
      }),
    )
    .setTimeout(60)
    .build();

  tx.sign(distributionKeypair);
  const result = await server.submitTransaction(tx);

  if (!result.hash) {
    throw new Error("Stellar payment succeeded but no hash returned");
  }

  return { hash: result.hash };
}

// ── Distribution Trustline Safety Check ───────────────────────────────────

/**
 * Ensures the distribution account has an active ROTR trustline.
 * Called before the first payment to prevent op_no_trust errors.
 */
async function ensureDistributionTrustline(): Promise<void> {
  const { distributionKeypair, rotAsset } = getConfig();
  const distributionPub = distributionKeypair.publicKey();

  try {
    const account = await server.loadAccount(distributionPub);
    const hasTrustline = account.balances.some(
      (b: any) =>
        b.asset_type !== "native" &&
        b.asset_code === ROTR_ASSET_CODE &&
        b.asset_issuer === rotAsset.getIssuer(),
    );

    if (!hasTrustline) {
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.changeTrust({
            asset: rotAsset,
            limit: "1000000000",
          }),
        )
        .setTimeout(30)
        .build();

      tx.sign(distributionKeypair);
      await server.submitTransaction(tx);
    }
  } catch {
    // If we can't check/set the trustline, let the payment attempt fail naturally
    // so the error is logged but we don't crash here
  }
}

// ── Balance Query (read-only) ──────────────────────────────────────────────

export interface BalanceInfo {
  assetCode: string;
  balance: string;
  issuer: string;
}

/**
 * Queries Horizon for the user's ROTR balance.
 * Returns 0 if no trustline / account doesn't exist yet.
 */
export async function getRotBalance(
  publicKey: string,
): Promise<BalanceInfo> {
  try {
    const account = await server.loadAccount(publicKey);
    const { rotAsset } = getConfig();
    const line = account.balances.find(
      (b: any) =>
        b.asset_type !== "native" &&
        b.asset_code === ROTR_ASSET_CODE &&
        b.asset_issuer === rotAsset.getIssuer(),
    );
    return {
      assetCode: ROTR_ASSET_CODE,
      balance: line ? line.balance : "0",
      issuer: rotAsset.getIssuer() ?? "",
    };
  } catch {
    // Account not yet funded or doesn't exist
    return {
      assetCode: ROTR_ASSET_CODE,
      balance: "0",
      issuer: getConfig().rotAsset.getIssuer() ?? "",
    };
  }
}

/**
 * Returns the distribution account's current ROTR balance (for monitoring).
 */
export async function getDistributionBalance(): Promise<string> {
  const { distributionKeypair } = getConfig();
  const info = await getRotBalance(distributionKeypair.publicKey());
  return info.balance;
}

// ── Asset Info (Contract ID equivalent) ───────────────────────────────────

export interface AssetInfo {
  /** The issuing account public key — acts as the "contract ID" for this asset */
  issuingPublicKey: string;
  /** The Soroban Smart Contract ID (starts with C) */
  sorobanContractId: string | null;
  assetCode: string;
  /** Full Stellar asset identifier: "CODE:ISSUER_ADDRESS" */
  assetIdentifier: string;
  networkPassphrase: string;
  horizonUrl: string;
  explorerBaseUrl: string;
}

/**
 * Returns the ROTR asset metadata, or null if env vars are not configured.
 * The issuing account public key serves as the contract identifier
 * for Stellar classic assets (equivalent to a Soroban contract address).
 */
export function getAssetInfo(): AssetInfo | null {
  try {
    const { issuingKeypair } = getConfig();
    const issuingPublicKey = issuingKeypair.publicKey();
    const sorobanContractId = process.env.STELLAR_CONTRACT_ID || null;
    return {
      issuingPublicKey,
      sorobanContractId,
      assetCode: ROTR_ASSET_CODE,
      assetIdentifier: `${ROTR_ASSET_CODE}:${issuingPublicKey}`,
      networkPassphrase: NETWORK_PASSPHRASE,
      horizonUrl: HORIZON_URL,
      explorerBaseUrl: "https://stellar.expert/explorer/testnet",
    };
  } catch {
    // Env vars not configured — return null instead of crashing
    return null;
  }
}
