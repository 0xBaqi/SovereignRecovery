require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const MockRecoverySourceArtifact = require("../artifacts/contracts/MockRecoverySource.sol/MockRecoverySource.json");

async function authorizeRecovery(targetVaultAddress, designatedNewOwner) {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required.");
  }

  const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const evidencePath = path.join(__dirname, "../evidence/milestone1b.json");
  let evidence = JSON.parse(fs.readFileSync(evidencePath, "utf-8"));

  const sourceAddress = evidence.liveExecution.sepoliaSourceContract?.address;
  if (!sourceAddress) {
    throw new Error("No Sepolia MockRecoverySource address found. Deploy it first.");
  }

  const vaultAddress = targetVaultAddress || evidence.liveExecution.cc3VaultContract?.address;
  if (!vaultAddress) {
    throw new Error("No Creditcoin SovereignVault address found. Deploy it first.");
  }

  const provider = new ethers.JsonRpcProvider(sepoliaRpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const ownerA = wallet.address;
  // If OWNER_B_ADDRESS provided or designated, use it; otherwise generate/use a distinct deterministic address
  const ownerB = designatedNewOwner || process.env.OWNER_B_ADDRESS || ethers.Wallet.createRandom().address;

  const CC3_CHAIN_ID = 102031; // Verified CC3 EVM chain ID
  const recoveryNonce = 0n;

  console.log(`\n========================================`);
  console.log(`Emitting REAL RecoveryAuthorized event on Sepolia...`);
  console.log(`MockRecoverySource: ${sourceAddress}`);
  console.log(`Destination Chain ID: ${CC3_CHAIN_ID}`);
  console.log(`Destination Account (Vault): ${vaultAddress}`);
  console.log(`Recovery Nonce: ${recoveryNonce}`);
  console.log(`Old Owner (Owner A): ${ownerA}`);
  console.log(`New Owner (Owner B): ${ownerB}`);

  const mockSource = new ethers.Contract(sourceAddress, MockRecoverySourceArtifact.abi, wallet);

  console.log("Broadcasting authorizeRecovery transaction to Sepolia...");
  const tx = await mockSource.authorizeRecovery(
    CC3_CHAIN_ID,
    vaultAddress,
    recoveryNonce,
    ownerA,
    ownerB
  );
  console.log(`Transaction Hash: ${tx.hash}`);

  const receipt = await tx.wait(1);
  console.log(`Included in Block Number: ${receipt.blockNumber}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

  // Find RecoveryAuthorized event in logs
  const eventTopic = ethers.id("RecoveryAuthorized(uint256,address,uint256,address,address)");
  const log = receipt.logs.find((l) => l.topics[0] === eventTopic);
  if (!log) {
    throw new Error("RecoveryAuthorized event not found in receipt logs!");
  }

  const decoded = mockSource.interface.parseLog(log);
  console.log("Emitted Event Decoded Args:", {
    destinationChainId: decoded.args.destinationChainId.toString(),
    destinationAccount: decoded.args.destinationAccount,
    recoveryNonce: decoded.args.recoveryNonce.toString(),
    oldOwner: decoded.args.oldOwner,
    newOwner: decoded.args.newOwner,
  });

  evidence.liveExecution.sepoliaRecoveryTx = {
    txHash: tx.hash,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: receipt.gasUsed.toString(),
    destinationChainId: CC3_CHAIN_ID,
    destinationAccount: vaultAddress,
    recoveryNonce: Number(recoveryNonce),
    oldOwner: ownerA,
    newOwner: ownerB,
    explorerLink: `https://sepolia.etherscan.io/tx/${tx.hash}`
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  return {
    txHash: tx.hash,
    blockNumber: Number(receipt.blockNumber),
    ownerA,
    ownerB
  };
}

if (require.main === module) {
  authorizeRecovery().catch((err) => {
    console.error("Authorization failed:", err);
    process.exit(1);
  });
}

module.exports = { authorizeRecovery };
