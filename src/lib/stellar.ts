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
): Promise<{ hash: string }> {
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

  // Prepare the transaction: simulates + applies Soroban auth & resource budget
  const preparedTx = await sorobanServer.prepareTransaction(tx);

  preparedTx.sign(signer);
  const sendResult = await sorobanServer.sendTransaction(preparedTx);
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

  return { hash: sendResult.hash };
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
  const { hash } = await invokeContract(
    "reward_report",
    [
      Address.fromString(adminKeypair.publicKey()).toScVal(),
      Address.fromString(recipientPublicKey).toScVal(),
      xdr.ScVal.scvU64(new xdr.Uint64([incidentId >>> 0, Math.floor(incidentId / 0x100000000)])),
    ],
    adminKeypair,
  );
  return { hash };
}

export async function sendVerificationReward(
  recipientPublicKey: string,
  incidentId: number,
): Promise<PaymentResult> {
  const { adminKeypair } = getConfig();
  const { hash } = await invokeContract(
    "reward_verification",
    [
      Address.fromString(adminKeypair.publicKey()).toScVal(),
      Address.fromString(recipientPublicKey).toScVal(),
      xdr.ScVal.scvU64(new xdr.Uint64([incidentId >>> 0, Math.floor(incidentId / 0x100000000)])),
    ],
    adminKeypair,
  );
  return { hash };
}

// -- Balance Query (via Soroban Contract) -------------------------------------

export interface BalanceInfo {
  assetCode: string;
  balance: string;
  issuer: string;
}

export async function getRotBalance(publicKey: string): Promise<BalanceInfo> {
  const { adminKeypair, contractId } = getConfig();

  // Try Soroban contract first (read-only simulation)
  try {
    const contract = new Contract(contractId);
    const account = await sorobanServer.getAccount(adminKeypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("balance", Address.fromString(publicKey).toScVal()))
      .setTimeout(30)
      .build();
    const simResult = await sorobanServer.simulateTransaction(tx);
    if (!rpc.Api.isSimulationError(simResult) && simResult.result?.retval) {
      const balance = scValToNative(simResult.result.retval)?.toString() ?? "0";
      return { assetCode: "ROTR", balance, issuer: adminKeypair.publicKey() };
    }
  } catch (err) {
    console.error("[Stellar] Soroban balance simulation failed:", err);
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
  } catch (err) {
    console.error("[Stellar] Horizon balance fallback failed:", err);
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

// -- Backfill: find real tx hashes for old "contract_invoked" records ------

export interface BackfillMatch {
  userPublicKey: string;
  incidentId: number;
  realHash: string;
}

/**
 * Decode a Soroban transaction envelope and extract contract call details.
 * Returns an array of { contractId, method, args } for each InvokeHostFunction op.
 */
function decodeSorobanCalls(
  envelopeXdr: string,
): Array<{ contractAddress: string; method: string; args: xdr.ScVal[] }> {
  const envelope = xdr.TransactionEnvelope.fromXDR(envelopeXdr, "base64");

  let operations: xdr.Operation[];
  switch (envelope.switch()) {
    case xdr.EnvelopeType.envelopeTypeTxV0():
      operations = envelope.v0().tx().operations();
      break;
    case xdr.EnvelopeType.envelopeTypeTx():
      operations = envelope.v1().tx().operations();
      break;
    case xdr.EnvelopeType.envelopeTypeTxFeeBump(): {
      const inner = envelope.feeBump().tx().innerTx();
      if (inner.switch() === xdr.EnvelopeType.envelopeTypeTx()) {
        operations = inner.v1().tx().operations();
      } else {
        return [];
      }
      break;
    }
    default:
      return [];
  }

  const results: Array<{ contractAddress: string; method: string; args: xdr.ScVal[] }> = [];
  for (const op of operations) {
    if (op.body().switch() !== xdr.OperationType.invokeHostFunction()) continue;
    const invokeOp = op.body().invokeHostFunctionOp();
    const hostFn = invokeOp.hostFunction();
    if (hostFn.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) continue;
    const contract = hostFn.invokeContract();
    results.push({
      contractAddress: Address.fromScAddress(contract.contractAddress()).toString(),
      method: contract.functionName().toString(),
      args: contract.args(),
    });
  }
  return results;
}

/**
 * Query Horizon for all admin-signed Soroban reward transactions,
 * decode their envelopes, and return a lookup map keyed by
 * (recipientPublicKey + incidentId) → real transaction hash.
 *
 * This is used by the backfill action to replace the old
 * hardcoded "contract_invoked" hashes with real on-chain hashes.
 */
export async function findRealTxHashes(): Promise<BackfillMatch[]> {
  const { adminKeypair, contractId } = getConfig();
  const adminPubKey = adminKeypair.publicKey();
  const matches: BackfillMatch[] = [];

  // Paginate through all transactions signed by the admin account
  let page = await horizonServer
    .transactions()
    .forAccount(adminPubKey)
    .limit(200)
    .order("desc")
    .call();

  let safetyCounter = 0;
  while (page.records.length > 0 && safetyCounter < 20) {
    safetyCounter++;

    for (const txn of page.records) {
      // Only process successful transactions
      if (txn.successful !== true) continue;

      let calls: Array<{ contractAddress: string; method: string; args: xdr.ScVal[] }>;
      try {
        calls = decodeSorobanCalls(txn.envelope_xdr);
      } catch {
        continue; // skip unparseable envelopes
      }

      for (const call of calls) {
        // Only match calls to our contract with reward methods
        if (call.contractAddress !== contractId) continue;
        if (call.method !== "reward_report" && call.method !== "reward_verification") continue;
        if (call.args.length < 3) continue;

        // args[0] = admin address (ignore — we know it's the admin)
        // args[1] = user/recipient address
        // args[2] = incident_id (U64)
        try {
          const userPublicKey = scValToNative(call.args[1]) as string;
          const incidentIdRaw = scValToNative(call.args[2]);
          const incidentId = typeof incidentIdRaw === "number"
            ? incidentIdRaw
            : typeof incidentIdRaw === "bigint"
              ? Number(incidentIdRaw)
              : parseInt(String(incidentIdRaw), 10);

          if (userPublicKey && !isNaN(incidentId)) {
            matches.push({
              userPublicKey,
              incidentId,
              realHash: txn.hash,
            });
          }
        } catch {
          continue; // skip if arg decoding fails
        }
      }
    }

    // Next page
    if (page.next) {
      page = await page.next();
    } else {
      break;
    }
  }

  return matches;
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
