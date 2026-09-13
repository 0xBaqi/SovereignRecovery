require("dotenv").config();
const { ethers } = require("ethers");
const { chainInfo, proofProvider } = require("@gluwa/usc-sdk");
const fs = require("fs");
const path = require("path");

async function generateProof(sourceTxHash, sourceBlockNumber) {
  const cc3RpcUrl = process.env.CREDITCOIN_RPC_URL || "https://rpc.cc3-testnet.creditcoin.network";
  const proverUrl = process.env.CREDITCOIN_PROOF_BUILDER_URL || "https://prover.cc3-testnet.creditcoin.network/";
  const SEPOLIA_CHAIN_KEY = 1;

  const evidencePath = path.join(__dirname, "../evidence/milestone1b.json");
  let evidence = JSON.parse(fs.readFileSync(evidencePath, "utf-8"));

  const txHash = sourceTxHash || evidence.liveExecution.sepoliaRecoveryTx?.txHash;
  const blockNumber = sourceBlockNumber || evidence.liveExecution.sepoliaRecoveryTx?.blockNumber;

  if (!txHash || !blockNumber) {
    throw new Error("No Sepolia recovery transaction found. Run authorize-recovery first.");
  }

  console.log(`\n========================================`);
  console.log(`Generating Attestcoin Proof via @gluwa/usc-sdk...`);
  console.log(`Source Tx Hash: ${txHash}`);
  console.log(`Source Block Number: ${blockNumber}`);
  console.log(`Attestcoin ChainKey: ${SEPOLIA_CHAIN_KEY} (Sepolia)`);
  console.log(`Creditcoin CC3 RPC: ${cc3RpcUrl}`);
  console.log(`Proof Builder URL: ${proverUrl}`);

  const provider = new ethers.JsonRpcProvider(cc3RpcUrl);
  const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(provider);

  console.log(`\nWaiting for block ${blockNumber} to be attested on Creditcoin CC3...`);
  console.log(`(Attestation checks the on-chain precompile bounds. This may take several minutes...)`);

  await chainInfoProvider.waitUntilHeightAttested(SEPOLIA_CHAIN_KEY, blockNumber, 10000, 600000, 15000);
  console.log(`Block ${blockNumber} is ATTESTED on Creditcoin CC3!`);

  // Request proof from the ProofBuilder service
  console.log(`\nRequesting inclusion and continuity proof from ProofBuilder service...`);
  const builder = new proofProvider.service.ProofBuilder(SEPOLIA_CHAIN_KEY, proverUrl);
  const proofResult = await builder.getProof(txHash);

  if (!proofResult.success || !proofResult.data) {
    throw new Error(`Proof generation failed from ProofBuilder: ${proofResult.error || "Unknown error"}`);
  }

  const proofData = proofResult.data;
  console.log(`\nProof successfully generated!`);
  console.log(`Chain Key: ${proofData.chainKey}`);
  console.log(`Header Number: ${proofData.headerNumber}`);
  console.log(`Transaction Index: ${proofData.txIndex}`);
  console.log(`Merkle Root: ${proofData.merkleProof.root}`);
  console.log(`Sibling Count: ${proofData.merkleProof.siblings.length}`);
  console.log(`Continuity Lower Endpoint: ${proofData.continuityProof.lowerEndpointDigest}`);
  console.log(`Continuity Roots Count: ${proofData.continuityProof.roots.length}`);

  // Save the full real proof to evidence/attestcoin_proof.json
  const proofFilePath = path.join(__dirname, "../evidence/attestcoin_proof.json");
  fs.writeFileSync(proofFilePath, JSON.stringify(proofData, null, 2));
  console.log(`Proof saved to: ${proofFilePath}`);

  // Update milestone1b.json
  evidence.liveExecution.attestcoinProof = {
    chainKey: proofData.chainKey,
    headerNumber: proofData.headerNumber,
    txIndex: proofData.txIndex,
    merkleRoot: proofData.merkleProof.root,
    siblingCount: proofData.merkleProof.siblings.length,
    lowerEndpointDigest: proofData.continuityProof.lowerEndpointDigest,
    continuityRootsCount: proofData.continuityProof.roots.length,
    savedProofFile: "evidence/attestcoin_proof.json",
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  return proofData;
}

if (require.main === module) {
  generateProof().catch((err) => {
    console.error("Proof generation failed:", err);
    process.exit(1);
  });
}

module.exports = { generateProof };
