/**
 * Stellar Testnet Account Setup Script
 *
 * Run once to:
 * 1. Generate issuing + distribution keypairs
 * 2. Fund both via Friendbot
 * 3. Establish ROTR trustline on the distribution account
 * 4. Print env vars to add to your Convex dashboard
 *
 * Usage: npx tsx scripts/setup-stellar.ts
 */

import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
} from "@stellar/stellar-sdk";
import crypto from "crypto";

const FRIENDBOT_URL = "https://friendbot.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const server = new Horizon.Server(HORIZON_URL);

async function fundAccount(publicKey: string): Promise<boolean> {
  const resp = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!resp.ok) {
    console.error(`  ✗ Friendbot funding failed for ${publicKey}: ${resp.status}`);
    return false;
  }
  console.log(`  ✓ Funded ${publicKey.slice(0, 12)}...`);
  return true;
}

async function establishTrustline(
  accountKeypair: Keypair,
  asset: Asset,
): Promise<boolean> {
  try {
    const account = await server.loadAccount(accountKeypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.changeTrust({
          asset,
          limit: "1000000000",
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(accountKeypair);
    await server.submitTransaction(tx);
    console.log(`  ✓ Trustline established for ${accountKeypair.publicKey().slice(0, 12)}...`);
    return true;
  } catch (err: any) {
    console.error(`  ✗ Trustline failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("=== Stellar Testnet Account Setup ===\n");

  // 1. Generate keypairs
  console.log("1. Generating keypairs...");
  const issuingKeypair = Keypair.random();
  const distributionKeypair = Keypair.random();
  console.log(`  Issuing:       ${issuingKeypair.publicKey()}`);
  console.log(`  Distribution:  ${distributionKeypair.publicKey()}`);

  // 2. Generate AES encryption key
  const encryptionSecret = crypto.randomBytes(32).toString("hex");
  console.log(`  AES Key:       ${encryptionSecret.slice(0, 16)}...`);

  // 3. Fund via Friendbot
  console.log("\n2. Funding accounts via Friendbot...");
  const fundIssuing = await fundAccount(issuingKeypair.publicKey());
  const fundDist = await fundAccount(distributionKeypair.publicKey());

  if (!fundIssuing || !fundDist) {
    console.error("\n✗ Funding failed. Friendbot may be rate-limited. Wait a moment and retry.");
    process.exit(1);
  }

  // Wait for Horizon to index the accounts
  console.log("\n   Waiting for Horizon to index accounts...");
  await new Promise((r) => setTimeout(r, 3000));

  // 4. Establish ROTR trustline on distribution account
  console.log("\n3. Establishing ROTR trustline on distribution account...");
  const rotAsset = new Asset("ROTR", issuingKeypair.publicKey());
  const trustlineOk = await establishTrustline(distributionKeypair, rotAsset);

  if (!trustlineOk) {
    console.error("\n✗ Trustline failed. You'll need to establish it manually in Stellar Lab.");
  }

  // 5. Print env vars
  console.log("\n=== Add these to your Convex Dashboard (Settings → Environment Variables) ===\n");
  console.log(`STELLAR_KEY_ENCRYPTION_SECRET=${encryptionSecret}`);
  console.log(`STELLAR_ISSUING_SECRET=${issuingKeypair.secret()}`);
  console.log(`STELLAR_DISTRIBUTION_SECRET=${distributionKeypair.secret()}`);

  console.log("\n=== Issuing Account Public Key (Contract ID) ===");
  console.log(issuingKeypair.publicKey());

  console.log("\n=== Next Steps ===");
  console.log("1. Copy the 3 env vars above into your Convex Dashboard");
  console.log("2. Run 'npx convex dev' to push the schema");
  console.log("3. Mint ROTR to the distribution account via Stellar Lab:");
  console.log(`   → Source:       ${issuingKeypair.publicKey()}`);
  console.log(`   → Destination:  ${distributionKeypair.publicKey()}`);
  console.log("   → Operation:    Payment");
  console.log("   → Asset Code:   ROTR");
  console.log("   → Amount:       1000000");
  console.log(`   → Or visit: https://laboratory.stellar.org/#txbuilder?network=test`);
  console.log("4. Open http://localhost:5173/wallet to see the wallet page");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
