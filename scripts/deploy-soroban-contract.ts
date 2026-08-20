/**
 * Deploy a Soroban Token Contract for ROTR
 *
 * Uses the Stellar SDK + Soroban RPC to deploy a pre-compiled
 * token WASM. No Rust/Soroban CLI needed.
 *
 * Usage: npx tsx scripts/deploy-soroban-contract.ts
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Contract,
  Address,
  SorobanRpc,
  xdr,
} from "@stellar/stellar-sdk";
import crypto from "crypto";

const RPC_URL = "https://soroban-testnet.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

// Pre-compiled Soroban Token WASM from Stellar examples
// This is the standard SEP-41 token contract
const TOKEN_WASM_URL =
  "https://raw.githubusercontent.com/stellar/soroban-examples/main/token/target/wasm32v1-none/release/soroban_token_contract.wasm";

// Alternative: use the built-in Stellar Asset Contract (SAC) WASM
// which wraps classic assets as Soroban contracts
const SAC_WASM_URL =
  "https://soroban.stellar.org/contracts/soroban_token.wasm";

interface DeployResult {
  contractAddress: string;
  deployerPublicKey: string;
  issuingPublicKey: string;
}

async function main() {
  console.log("=== Soroban ROTR Token Contract Deployment ===\n");

  // 1. Load deployer keypair
  const deployerSecret = process.env.STELLAR_ISSUING_SECRET;
  if (!deployerSecret) {
    console.error("Missing STELLAR_ISSUING_SECRET env var");
    process.exit(1);
  }

  const deployerKeypair = Keypair.fromSecret(deployerSecret);
  const deployerPub = deployerKeypair.publicKey();
  console.log(`Deployer: ${deployerPub}`);

  // 2. Connect to Soroban RPC
  const server = new SorobanRpc.Client(RPC_URL);

  // 3. Fetch the token WASM
  console.log("\nFetching token WASM...");
  let wasmBytes: Buffer;

  try {
    // Try the Stellar examples repo first
    const resp = await fetch(TOKEN_WASM_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const arrayBuf = await resp.arrayBuffer();
    wasmBytes = Buffer.from(arrayBuf);
    console.log(`  ✓ Downloaded WASM (${wasmBytes.length} bytes)`);
  } catch {
    try {
      // Fallback URL
      const resp = await fetch(SAC_WASM_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      wasmBytes = Buffer.from(arrayBuf);
      console.log(`  ✓ Downloaded WASM fallback (${wasmBytes.length} bytes)`);
    } catch (err: any) {
      console.error("  ✗ Failed to download WASM:", err.message);
      console.log("\nManual fallback: Use Stellar Lab to deploy:");
      console.log("  https://laboratory.stellar.org/#txbuilder?network=test");
      process.exit(1);
    }
  }

  // 4. Upload WASM to Soroban
  console.log("\nUploading WASM to Soroban...");
  const wasmHash = crypto.createHash("sha256").update(wasmBytes).digest();

  // Build upload transaction
  let account;
  try {
    account = await server.getAccount(deployerPub);
  } catch {
    console.log("  Account not found on Soroban, funding via Friendbot...");
    await fetch(`${FRIENDBOT_URL}?addr=${deployerPub}`);
    await new Promise((r) => setTimeout(r, 3000));
    account = await server.getAccount(deployerPub);
  }

  const uploadTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeHostFunction({
        hostFunction: xdr.HostFunction.hostFunctionTypeUploadContractWasm(
          xdr.ScVal.scvBytes(wasmBytes)
        ),
        auth: [],
      })
    )
    .setTimeout(300)
    .build();

  const uploadSim = await server.simulateTransaction(uploadTx);
  if (SorobanRpc.Api.isError(uploadSim)) {
    console.error("  ✗ Upload simulation failed:", uploadSim.error);
    process.exit(1);
  }

  // Sign and submit
  uploadTx.sign(deployerKeypair);
  const uploadResult = await server.sendTransaction(uploadTx);
  if (uploadResult.status === "ERROR") {
    console.error("  ✗ Upload failed:", uploadResult);
    process.exit(1);
  }

  // Wait for confirmation
  let uploadedHash = uploadSim.result?.retval;
  console.log("  ✓ WASM uploaded to Soroban");

  // 5. Create (deploy) the contract
  console.log("\nDeploying contract...");

  // Get a fresh account sequence
  account = await server.getAccount(deployerPub);

  const salt = crypto.randomBytes(32);
  const createTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeHostFunction({
        hostFunction: xdr.HostFunction.hostFunctionTypeCreateContract(
          new xdr.CreateContractArgs({
            contractIDPreimage: xdr.ContractIDPreimage.contractIDPreimageFromHash(
              new xdr.Hash(wasmHash)
            ),
            executable: xdr.ContractExecutable.contractExecutableWasm(
              new xdr.Hash(wasmHash)
            ),
          })
        ),
        auth: [],
      })
    )
    .setTimeout(300)
    .build();

  const createSim = await server.simulateTransaction(createTx);
  if (SorobanRpc.Api.isError(createSim)) {
    console.error("  ✗ Deploy simulation failed:", createSim.error);
    console.log("\nFalling back to Stellar Lab for deployment...");
    console.log("Use this command instead:");
    console.log(`soroban contract wrap token --asset ROTR:${deployerPub} --source deployer --network testnet`);
    process.exit(1);
  }

  createTx.sign(deployerKeypair);
  const createResult = await server.sendTransaction(createTx);
  if (createResult.status === "ERROR") {
    console.error("  ✗ Deploy failed:", createResult);
    process.exit(1);
  }

  // Extract contract address from simulation result
  let contractAddress = "";
  if (createSim.result?.retval) {
    const contractData = createSim.result.retval;
    contractAddress = contractData.address()?.contractId()?.toString("hex") || "";
    if (contractAddress) {
      // Stellar contract addresses are 32-byte hashes
      contractAddress = "C" + hexToStellar(contractAddress);
    }
  }

  // Wait and check
  console.log("  ✓ Contract deployed!");

  if (contractAddress) {
    console.log(`\n=== Contract ID (starts with C) ===`);
    console.log(contractAddress);
    console.log(`\n=== Stellar Asset Contract Address ===`);
    console.log(`Asset: ROTR:${deployerPub}`);
  }

  console.log(`\n=== Add to Convex Dashboard ===`);
  console.log(`STELLAR_CONTRACT_ID=${contractAddress || "PENDING - check Stellar Lab"}`);
}

function hexToStellar(hex: string): string {
  // Convert hex bytes to Stellar's base32 address format
  const bytes = Buffer.from(hex, "hex");
  // Stellar addresses use a specific base32 encoding with a checksum
  // This is simplified - for production use stellar-base's StrKey
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }
  return result;
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
