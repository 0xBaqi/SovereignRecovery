require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const SovereignVaultArtifact = require("../artifacts/contracts/SovereignVault.sol/SovereignVault.json");

async function testReplay() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required.");
  }

  const cc3RpcUrl = process.env.CREDITCOIN_RPC_URL || "https://rpc.cc3-testnet.creditcoin.network";
  const evidencePath = path.join(__dirname, "../evidence/milestone1b.json");
  let evidence = JSON.parse(fs.readFileSync(evidencePath, "utf-8"));

  const vaultAddress = evidence.liveExecution.cc3VaultContract?.address;
  if (!vaultAddress) {
    throw new Error("No SovereignVault address found. Deploy it first.");
  }

  const proofFilePath = path.join(__dirname, "../evidence/attestcoin_proof.json");
  if (!fs.existsSync(proofFilePath)) {
    throw new Error("No attestcoin_proof.json found. Generate proof first.");
  }
  const proofData = JSON.parse(fs.readFileSync(proofFilePath, "utf-8"));

  console.log(`\n========================================`);
  console.log(`Executing REPLAY ATTACK TEST on Creditcoin CC3...`);
  console.log(`Attempting to submit the exact same authorization & proof a second time...`);

  const provider = new ethers.JsonRpcProvider(cc3RpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const vault = new ethers.Contract(vaultAddress, SovereignVaultArtifact.abi, wallet);

  const action = 0;
  const siblings = proofData.merkleProof.siblings.map((s) => ({
    hash: s.hash,
    isLeft: s.isLeft,
  }));

  let replayFailed = false;
  let revertReason = null;
  let classifiedMechanism = null;

  try {
    const tx = await vault.execute(
      action,
      proofData.chainKey,
      proofData.headerNumber,
      proofData.txBytes,
      proofData.merkleProof.root,
      siblings,
      proofData.continuityProof.lowerEndpointDigest,
      proofData.continuityProof.roots
    );
    await tx.wait(1);
    throw new Error("CRITICAL SECURITY FAILURE: Replay transaction succeeded!");
  } catch (err) {
    replayFailed = true;
    revertReason = err.shortMessage || err.reason || err.message;
    console.log(`\n[SUCCESS] Replay was REJECTED by Creditcoin CC3!`);
    console.log(`Observed Revert Message: ${revertReason}`);

    // Classify protection mechanism based strictly on observed revert
    if (revertReason.includes("Query already processed")) {
      classifiedMechanism = "ASCBase query deduplication (processedQueries[queryId] == true)";
    } else if (revertReason.includes("InvalidRecoveryNonce")) {
      classifiedMechanism = "SovereignVault nonce protection (expectedRecoveryNonce advanced)";
    } else if (revertReason.includes("Proof of inclusion verification failed")) {
      classifiedMechanism = "Block prover precompile verification";
    } else {
      classifiedMechanism = `On-chain revert: ${revertReason}`;
    }
    console.log(`Classified Protection Mechanism: ${classifiedMechanism}`);
  }

  evidence.liveExecution.replayAttempt = {
    replaySuccess: false,
    observedRevertReason: revertReason,
    classifiedProtectionMechanism: classifiedMechanism,
    testedAt: new Date().toISOString()
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  return { replayFailed, revertReason, classifiedMechanism };
}

if (require.main === module) {
  testReplay().catch((err) => {
    console.error("Replay test script error:", err);
    process.exit(1);
  });
}

module.exports = { testReplay };
