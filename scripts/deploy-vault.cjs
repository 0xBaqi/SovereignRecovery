require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const SovereignVaultArtifact = require("../artifacts/contracts/SovereignVault.sol/SovereignVault.json");

async function deployVault(mockSourceAddress) {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required.");
  }

  const cc3RpcUrl = process.env.CREDITCOIN_RPC_URL || "https://rpc.cc3-testnet.creditcoin.network";
  console.log(`\n========================================`);
  console.log(`Deploying SovereignVault to Creditcoin CC3...`);
  console.log(`RPC: ${cc3RpcUrl}`);

  const provider = new ethers.JsonRpcProvider(cc3RpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer Address (Owner A): ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} CTC`);
  if (balance === 0n) {
    throw new Error(`Deployer ${wallet.address} has 0 CC3 CTC. Please fund with CC3 faucet.`);
  }

  const evidencePath = path.join(__dirname, "../evidence/milestone1b.json");
  let evidence = JSON.parse(fs.readFileSync(evidencePath, "utf-8"));
  
  const recoverySource = mockSourceAddress || evidence.liveExecution.sepoliaSourceContract?.address;
  if (!recoverySource) {
    throw new Error("No Sepolia MockRecoverySource address found. Run deploy-mock-source first.");
  }

  const initialOwner = wallet.address;
  const SEPOLIA_CHAIN_KEY = 1; // Verified live Sepolia chainKey on CC3

  console.log(`Initial Owner (Owner A): ${initialOwner}`);
  console.log(`Registered Recovery Source: ${recoverySource}`);
  console.log(`Expected Source Chain Key: ${SEPOLIA_CHAIN_KEY} (Sepolia)`);

  const factory = new ethers.ContractFactory(
    SovereignVaultArtifact.abi,
    SovereignVaultArtifact.bytecode,
    wallet
  );

  console.log("Broadcasting deployment transaction on CC3...");
  const contract = await factory.deploy(initialOwner, recoverySource, SEPOLIA_CHAIN_KEY);
  console.log(`Deployment Tx Hash: ${contract.deploymentTransaction().hash}`);

  const receipt = await contract.deploymentTransaction().wait(1);
  const contractAddress = await contract.getAddress();

  console.log(`SovereignVault Deployed at: ${contractAddress}`);
  console.log(`Block Number: ${receipt.blockNumber}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

  evidence.liveExecution.cc3VaultContract = {
    address: contractAddress,
    deployer: wallet.address,
    initialOwner: initialOwner,
    registeredRecoverySource: recoverySource,
    expectedSourceChainKey: SEPOLIA_CHAIN_KEY,
    deploymentTxHash: contract.deploymentTransaction().hash,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: receipt.gasUsed.toString(),
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  return contractAddress;
}

if (require.main === module) {
  deployVault().catch((err) => {
    console.error("Vault deployment failed:", err);
    process.exit(1);
  });
}

module.exports = { deployVault };
