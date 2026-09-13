require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const MockRecoverySourceArtifact = require("../artifacts/contracts/MockRecoverySource.sol/MockRecoverySource.json");

async function deployMockSource() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required.");
  }

  const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  console.log(`\n========================================`);
  console.log(`Deploying MockRecoverySource to Ethereum Sepolia...`);
  console.log(`RPC: ${sepoliaRpcUrl}`);

  const provider = new ethers.JsonRpcProvider(sepoliaRpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer Address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} ETH`);
  if (balance === 0n) {
    throw new Error(`Deployer ${wallet.address} has 0 Sepolia ETH. Please fund with Sepolia faucet.`);
  }

  const factory = new ethers.ContractFactory(
    MockRecoverySourceArtifact.abi,
    MockRecoverySourceArtifact.bytecode,
    wallet
  );

  console.log(`Configured Recovery Authority: ${wallet.address}`);
  console.log("Broadcasting deployment transaction...");
  const contract = await factory.deploy(wallet.address);
  console.log(`Deployment Tx Hash: ${contract.deploymentTransaction().hash}`);
  
  const receipt = await contract.deploymentTransaction().wait(1);
  const contractAddress = await contract.getAddress();

  console.log(`MockRecoverySource Deployed at: ${contractAddress}`);
  console.log(`Block Number: ${receipt.blockNumber}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
  console.log(`Explorer: https://sepolia.etherscan.io/address/${contractAddress}`);

  // Persist to evidence
  const evidencePath = path.join(__dirname, "../evidence/milestone1b.json");
  let evidence = JSON.parse(fs.readFileSync(evidencePath, "utf-8"));
  evidence.liveExecution.sepoliaSourceContract = {
    address: contractAddress,
    deployer: wallet.address,
    deploymentTxHash: contract.deploymentTransaction().hash,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: receipt.gasUsed.toString(),
    explorerLink: `https://sepolia.etherscan.io/address/${contractAddress}`
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  return contractAddress;
}

if (require.main === module) {
  deployMockSource().catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
  });
}

module.exports = { deployMockSource };
