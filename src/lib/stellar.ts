/**
 * Stellar Testnet Service - Soroban Contract Integration
 *
 * All @stellar/stellar-sdk usage is confined to this file.
 * No other file in the codebase should import the SDK directly.
 *
 * Custodial model: users never see/manage a Stellar secret key.
 * The backend generates a keypair per user, funds it via Friendbot,
 * and encryptes the secret key at rest (AES-256-GCM).
 *
 * Token logic lives on-chain in the ROTR Soroban contract (contract/src/lib.rs).
 * This file handles contract invocations, wallet provisioning, and balance queries.
 */

import {
  Keypair,
  Horizon,
  rpc,
  TransactionBuilder,
  Contract,
  Address,
  Networks,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { encryptSecretKey } from "./crypto-node";

// -- Config ------------------------------------------------------------------

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const horizonServer = new Horizon.Server(HORIZON_URL);
const sorobanServer = new rpc.Server(SOROBAN_RPC_URL);

function requiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error("Missing env var: " + name);
  return val;
}

let _config: {
  adminKeypair: Keypair;
  contractId: string;
} | null = null;

function getConfig() {
  if (!_config) {
    const adminSecret = requiredEnv("STELLAR_ISSUING_SECRET");
    const contractId = requiredEnv("STELLAR_CONTRACT_ID");
    _config = {
      adminKeypair: Keypair.fromSecret(adminSecret),
      contractId,
    };
  }
  return _config;
}

// -- Key Generation ----------------------------------------------------------

export function generateKeypair(): Keypair {
  return Keypair.random();
}

// -- Account Funding (Friendbot) ---------------------------------------------

export async function fundAccount(publicKey: string): Promise<void> {
  const resp = await fetch(FRIENDBOT_URL + "?addr=" + publicKey);
  if (!resp.ok) {
    throw new Error("Friendbot funding failed for " + publicKey + ": " + resp.status);
  }
}

// -- Contract Invocation Helpers ----------------------------------------------

async function invokeContract(
  method: string,
  args: xdr.ScVal[],
  signer: Keypair,
): Promise<xdr.ScVal> {
  const { contractId } = getConfig();
  const contract = new Contract(contractId);
  const account = await sorobanServer.getAccount(signer.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(300)
    .build();

  const simResult = await sorobanServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error("Contract simulation failed: " + simResult.error);
  }

  tx.sign(signer);
  const sendResult = await sorobanServer.sendTransaction(tx);
  if (sendResult.status === "ERROR") {
    throw new Error("Transaction submit failed");
  }

  let status = sendResult.status as string;
  let attempts = 0;
  while (status === "PENDING" && attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    const txResult = await sorobanServer.getTransaction(sendResult.hash);
    status = txResult.status;
    attempts++;
  }

  if (status !== "SUCCESS") {
    throw new Error("Transaction not successful: " + status);
  }

  return simResult.result?.retval ?? xdr.ScVal.scvVoid();
}

// -- Provision Wallet --------------------------------------------------------

export interface ProvisionResult {
  publicKey: string;
  secretKeyEncrypted: string;
}

export async function provisionWallet(): Promise<ProvisionResult> {
  const userKeypair = generateKeypair();
  await fundAccount(userKeypair.publicKey());
  await new Promise((r) => setTimeout(r, 2000));
  const secretKeyEncrypted = await encryptSecretKey(userKeypair.secret());
  return {
    publicKey: userKeypair.publicKey(),
    secretKeyEncrypted,
  };
}

// -- Reward Distribution (via Soroban Contract) -------------------------------

export interface PaymentResult {
  hash: string;
}

export async function sendRewardPayment(
  recipientPublicKey: string,
  incidentId: number,
): Promise<PaymentResult> {
  const { adminKeypair } = getConfig();
  await invokeContract(
    "reward_report",
    [
      Address.fromString(adminKeypair.publicKey()).toScVal(),
      Address.fromString(recipientPublicKey).toScVal(),
      xdr.ScVal.scvU64(new xdr.Uint64([incidentId >>> 0, Math.floor(incidentId / 0x100000000)])),
    ],
    adminKeypair,
  );
  return { hash: "contract_invoked" };
}

export async function sendVerificationReward(
  recipientPublicKey: string,
  incidentId: number,
): Promise<PaymentResult> {
  const { adminKeypair } = getConfig();
  await invokeContract(
    "reward_verification",
    [
      Address.fromString(adminKeypair.publicKey()).toScVal(),
      Address.fromString(recipientPublicKey).toScVal(),
      xdr.ScVal.scvU64(new xdr.Uint64([incidentId >>> 0, Math.floor(incidentId / 0x100000000)])),
    ],
    adminKeypair,
  );
  return { hash: "contract_invoked" };
}

// -- Balance Query (via Soroban Contract) -------------------------------------

export interface BalanceInfo {
  assetCode: string;
  balance: string;
  issuer: string;
}

export async function getRotBalance(publicKey: string): Promise<BalanceInfo> {
  const { adminKeypair } = getConfig();

  // Try Soroban contract first (if deployed)
  try {
    const result = await invokeContract(
      "balance",
      [Address.fromString(publicKey).toScVal()],
      adminKeypair,
    );
    const balance = scValToNative(result)?.toString() ?? "0";
    return { assetCode: "ROTR", balance, issuer: adminKeypair.publicKey() };
  } catch {
    // Contract not deployed or call failed — fall back to Horizon
  }

  // Fallback: query Horizon for ROTR classic asset balance
  try {
    const account = await horizonServer.loadAccount(publicKey);
    const line = account.balances.find((b: any) =>
      b.asset_code === "ROTR" && b.asset_issuer === adminKeypair.publicKey()
    );
    return {
      assetCode: "ROTR",
      balance: line ? line.balance : "0",
      issuer: adminKeypair.publicKey(),
    };
  } catch {
    return { assetCode: "ROTR", balance: "0", issuer: adminKeypair.publicKey() };
  }
}

export async function getDistributionBalance(): Promise<string> {
  const { adminKeypair } = getConfig();
  try {
    const account = await horizonServer.loadAccount(adminKeypair.publicKey());
    const xlm = account.balances.find((b: any) => b.asset_type === "native");
    return xlm ? xlm.balance : "0";
  } catch {
    return "0";
  }
}

// -- Asset Info ---------------------------------------------------------------

export interface AssetInfo {
  issuingPublicKey: string;
  contractId: string;
  assetCode: string;
  assetIdentifier: string;
  networkPassphrase: string;
  horizonUrl: string;
  explorerBaseUrl: string;
}

export function getAssetInfo(): AssetInfo | null {
  try {
    const { adminKeypair, contractId } = getConfig();
    const issuingPublicKey = adminKeypair.publicKey();
    return {
      issuingPublicKey,
      contractId,
      assetCode: "ROTR",
      assetIdentifier: "ROTR:" + issuingPublicKey,
      networkPassphrase: NETWORK_PASSPHRASE,
      horizonUrl: HORIZON_URL,
      explorerBaseUrl: "https://stellar.expert/explorer/testnet",
    };
  } catch {
    return null;
  }
}
