require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const SovereignVaultArtifact = require("../artifacts/contracts/SovereignVault.sol/SovereignVault.json");

async function submitProof() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required.");
  }

  const cc3RpcUrl = process.env.CREDITCOIN_RPC_URL || "https://rpc.cc3-testnet.creditcoin.network";
  const evidencePath = path.join(__dirname, "../evidence/milestone1b.json");
  let evidence = JSON.parse(fs.readFileSync(evidencePath, "utf-8"));

  const vaultAddress = evidence.liveExecution.cc3VaultContract?.address;
  if (!vaultAddress) {
    throw new Error("No SovereignVault address found in evidence. Deploy it first.");
  }

  const proofFilePath = path.join(__dirname, "../evidence/attestcoin_proof.json");
  if (!fs.existsSync(proofFilePath)) {
    throw new Error("No attestcoin_proof.json found in evidence. Generate proof first.");
  }
  const proofData = JSON.parse(fs.readFileSync(proofFilePath, "utf-8"));

  console.log(`\n========================================`);
  console.log(`Submitting Attestcoin Proof to SovereignVault on Creditcoin CC3...`);
  console.log(`Vault Address: ${vaultAddress}`);
  console.log(`Creditcoin CC3 RPC: ${cc3RpcUrl}`);

  const provider = new ethers.JsonRpcProvider(cc3RpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const vault = new ethers.Contract(vaultAddress, SovereignVaultArtifact.abi, wallet);

  // Check state before
  const ownerBefore = await vault.currentOwner();
  const nonceBefore = await vault.expectedRecoveryNonce();
  console.log(`\n--- STATE BEFORE ---`);
  console.log(`currentOwner: ${ownerBefore}`);
  console.log(`expectedRecoveryNonce: ${nonceBefore.toString()}`);

  const action = 0; // standard recovery action discriminator

  // Map siblings and continuity roots format for execute(...)
  const siblings = proofData.merkleProof.siblings.map((s) => ({
    hash: s.hash,
    isLeft: s.isLeft,
  }));

  console.log("\nBroadcasting execute(...) transaction to SovereignVault on CC3...");
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
  console.log(`Transaction Hash: ${tx.hash}`);

  const receipt = await tx.wait(1);
  console.log(`Confirmed in Block Number: ${receipt.blockNumber}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

  // Inspect events
  const eventTopic = ethers.id("AccountRecovered(address,address,uint256,bytes32)");
  const log = receipt.logs.find((l) => l.topics[0] === eventTopic);
  let recoveredEventData = null;
  if (log) {
    const parsed = vault.interface.parseLog(log);
    recoveredEventData = {
      oldOwner: parsed.args.oldOwner,
      newOwner: parsed.args.newOwner,
      recoveryNonce: parsed.args.recoveryNonce.toString(),
      queryId: parsed.args.queryId,
    };
    console.log(`\n--- EVENT AccountRecovered ---`);
    console.log(recoveredEventData);
  }

  // Check state after
  const ownerAfter = await vault.currentOwner();
  const nonceAfter = await vault.expectedRecoveryNonce();
  console.log(`\n--- STATE AFTER ---`);
  console.log(`currentOwner: ${ownerAfter}`);
  console.log(`expectedRecoveryNonce: ${nonceAfter.toString()}`);

  const expectedOwnerB = evidence.liveExecution.sepoliaRecoveryTx?.newOwner;
  if (expectedOwnerB && ownerAfter.toLowerCase() !== expectedOwnerB.toLowerCase()) {
    throw new Error(`State verification failed: currentOwner (${ownerAfter}) != expectedOwnerB (${expectedOwnerB})`);
  }
  if (nonceAfter !== nonceBefore + 1n) {
    throw new Error(`Nonce verification failed: expectedRecoveryNonce did not increment by 1!`);
  }

  console.log(`\n>>> VERIFICATION CONFIRMED: SovereignVault recovered from Owner A to Owner B! <<<`);

  evidence.liveExecution.cc3ExecutionTx = {
    txHash: tx.hash,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: receipt.gasUsed.toString(),
    stateBefore: {
      owner: ownerBefore,
      nonce: Number(nonceBefore)
    },
    stateAfter: {
      owner: ownerAfter,
      nonce: Number(nonceAfter)
    },
    accountRecoveredEvent: recoveredEventData
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  return receipt;
}

if (require.main === module) {
  submitProof().catch((err) => {
    console.error("Proof submission failed:", err);
    process.exit(1);
  });
}

module.exports = { submitProof };
