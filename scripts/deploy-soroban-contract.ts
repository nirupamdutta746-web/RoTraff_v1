/**
 * Deploy the ROTR Soroban Token Contract
 *
 * Deploys contract/target/wasm32v1-none/release/rotr_token.wasm to Soroban Testnet.
 * The contract is our custom Rust implementation (contract/src/lib.rs).
 *
 * Prerequisites:
 *   1. Build the contract: cd contract && cargo build --target wasm32v1-none --release
 *   2. Set STELLAR_ISSUING_SECRET env var (the deployer/admin keypair)
 *
 * Usage: npx tsx scripts/deploy-soroban-contract.ts
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Contract, Address,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const RPC_URL = "https://soroban-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

async function main() {
  console.log("=== ROTR Soroban Contract Deployment ===
");

  // 1. Load deployer keypair
  const deployerSecret = process.env.STELLAR_ISSUING_SECRET;
  if (!deployerSecret) {
    console.error("Missing STELLAR_ISSUING_SECRET env var");
    process.exit(1);
  }
  const deployerKeypair = Keypair.fromSecret(deployerSecret);
  const deployerPub = deployerKeypair.publicKey();
  console.log("Deployer: " + deployerPub);

  // 2. Read the compiled WASM
  const wasmPath = path.join(__dirname, "../contract/target/wasm32v1-none/release/rotr_token.wasm");
  if (!fs.existsSync(wasmPath)) {
    console.error("WASM not found at: " + wasmPath);
    console.error("Build the contract first: cd contract && cargo build --target wasm32v1-none --release");
    process.exit(1);
  }
  const wasmBytes = fs.readFileSync(wasmPath);
  console.log("WASM loaded (" + wasmBytes.length + " bytes)");

  // 3. Connect to Soroban RPC
  const server = new rpc.Server(RPC_URL);

  // 4. Fund deployer if needed
  let account;
  try {
    account = await server.getAccount(deployerPub);
  } catch {
    console.log("Funding deployer via Friendbot...");
    await fetch(FRIENDBOT_URL + "?addr=" + deployerPub);
    await new Promise((r) => setTimeout(r, 3000));
    account = await server.getAccount(deployerPub);
  }

  // 5. Upload WASM
  console.log("
Uploading WASM...");
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
  if (rpc.Api.isSimulationError(uploadSim)) {
    console.error("Upload simulation failed:", uploadSim.error);
    process.exit(1);
  }

  uploadTx.sign(deployerKeypair);
  const uploadResult = await server.sendTransaction(uploadTx);
  if (uploadResult.status === "ERROR") {
    console.error("Upload failed:", uploadResult);
    process.exit(1);
  }
  console.log("WASM uploaded");

  // 6. Deploy the contract
  console.log("Deploying contract...");
  account = await server.getAccount(deployerPub);

  const wasmHash = crypto.createHash("sha256").update(wasmBytes).digest();
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
  if (rpc.Api.isSimulationError(createSim)) {
    console.error("Deploy simulation failed:", createSim.error);
    process.exit(1);
  }

  createTx.sign(deployerKeypair);
  const createResult = await server.sendTransaction(createTx);
  if (createResult.status === "ERROR") {
    console.error("Deploy failed:", createResult);
    process.exit(1);
  }

  let contractAddress = "";
  if (createSim.result?.retval) {
    contractAddress = createSim.result.retval.address()?.contractId()?.toString("hex") || "";
    if (contractAddress) {
      contractAddress = "C" + hexToStellar(contractAddress);
    }
  }

  console.log("Contract deployed!");

  // 7. Initialize the contract with admin and reward amounts
  if (contractAddress) {
    console.log("
Initializing contract...");
    account = await server.getAccount(deployerPub);

    const initTx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        new Contract(contractAddress).call(
          "initialize",
          Address.fromString(deployerPub).toScVal(),
          xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: BigInt(0), lo: BigInt(5) })),  // report_reward: 5
          xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: BigInt(0), lo: BigInt(2) })),  // verify_reward: 2
        )
      )
      .setTimeout(300)
      .build();

    const initSim = await server.simulateTransaction(initTx);
    if (!rpc.Api.isSimulationError(initSim)) {
      initTx.sign(deployerKeypair);
      await server.sendTransaction(initTx);
      console.log("Contract initialized (report_reward=5, verify_reward=2)");
    } else {
      console.log("Init skipped (may already be initialized):", initSim.error);
    }
  }

  console.log("
=== Add to Convex Dashboard ===");
  console.log("STELLAR_CONTRACT_ID=" + (contractAddress || "PENDING"));
  console.log("
=== StellarExpert ===");
  console.log("https://stellar.expert/explorer/testnet/contract/" + contractAddress);
}

function hexToStellar(hex) {
  const bytes = Buffer.from(hex, "hex");
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
