/**
 * Stellar Testnet Account Setup Script
 *
 * Run once to:
 * 1. Generate issuing + distribution keypairs
 * 2. Fund both via Friendbot
 * 3. Print env vars to add to your Convex dashboard
 *
 * Usage: npx tsx scripts/setup-stellar.ts
 */

import { Keypair } from "@stellar/stellar-sdk";
import crypto from "crypto";

const FRIENDBOT_URL = "https://friendbot.stellar.org";

async function fundAccount(publicKey: string): Promise<boolean> {
  const resp = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!resp.ok) {
    console.error(`  ✗ Friendbot funding failed for ${publicKey}: ${resp.status}`);
    return false;
  }
  console.log(`  ✓ Funded ${publicKey.slice(0, 12)}...`);
  return true;
}

async function main() {
  console.log("=== Stellar Testnet Account Setup ===\n");

  // 1. Generate keypairs
  console.log("Generating keypairs...");
  const issuingKeypair = Keypair.random();
  const distributionKeypair = Keypair.random();
  console.log(`  Issuing:       ${issuingKeypair.publicKey()}`);
  console.log(`  Distribution:  ${distributionKeypair.publicKey()}`);

  // 2. Generate AES encryption key
  const encryptionSecret = crypto.randomBytes(32).toString("hex");
  console.log(`  AES Key:       ${encryptionSecret.slice(0, 16)}...`);

  // 3. Fund via Friendbot
  console.log("\nFunding accounts via Friendbot...");
  const fundIssuing = await fundAccount(issuingKeypair.publicKey());
  const fundDist = await fundAccount(distributionKeypair.publicKey());

  if (!fundIssuing || !fundDist) {
    console.error("\n✗ Funding failed. Friendbot may be rate-limited. Wait a moment and retry.");
    process.exit(1);
  }

  // 4. Print env vars
  console.log("\n=== Add these to your Convex Dashboard (Settings → Environment Variables) ===\n");
  console.log(`STELLAR_KEY_ENCRYPTION_SECRET=${encryptionSecret}`);
  console.log(`STELLAR_ISSUING_SECRET=${issuingKeypair.secret()}`);
  console.log(`STELLAR_DISTRIBUTION_SECRET=${distributionKeypair.secret()}`);

  console.log("\n=== Issuing Account Public Key (for reference) ===");
  console.log(issuingKeypair.publicKey());

  console.log("\n=== Next Steps ===");
  console.log("1. Copy the env vars above into your Convex Dashboard");
  console.log("2. Run 'npx convex dev' to push the new schema");
  console.log("3. Manually mint ROTR to the distribution account via Stellar Lab:");
  console.log(`   - Source: ${issuingKeypair.publicKey()} (issuing account)`);
  console.log(`   - Destination: ${distributionKeypair.publicKey()} (distribution account)`);
  console.log("   - Operation: Payment");
  console.log("   - Asset: ROTR (code: ROTR)");
  console.log("   - Amount: 1000000");
  console.log("4. Open http://localhost:5173/wallet to see the wallet page");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
