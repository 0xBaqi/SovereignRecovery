const { JsonRpcProvider } = require("ethers");
const { chainInfo } = require("@gluwa/usc-sdk");

async function main() {
  const cc3RpcUrl = process.env.CREDITCOIN_RPC_URL || "https://rpc.cc3-testnet.creditcoin.network";
  console.log(`Connecting to CC3 RPC: ${cc3RpcUrl}`);
  
  const provider = new JsonRpcProvider(cc3RpcUrl);
  
  try {
    const network = await provider.getNetwork();
    console.log(`Creditcoin CC3 EVM chainId (dec): ${network.chainId}`);
    console.log(`Creditcoin CC3 EVM chainId (hex): 0x${network.chainId.toString(16)}`);

    const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(provider);
    try {
      const supportedChains = await chainInfoProvider.getSupportedChains();
      console.log("Supported chains from PrecompileChainInfoProvider:", JSON.stringify(supportedChains, null, 2));
    } catch (err) {
      console.log("Could not query supported chains precompile:", err.message);
    }
  } catch (err) {
    console.error("Failed to connect to CC3 RPC:", err.message);
  }

  const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
  console.log(`Connecting to Sepolia RPC: ${sepoliaRpcUrl}`);
  try {
    const sepoliaProvider = new JsonRpcProvider(sepoliaRpcUrl);
    const sepoliaNetwork = await sepoliaProvider.getNetwork();
    console.log(`Ethereum Sepolia EVM chainId: ${sepoliaNetwork.chainId}`);
  } catch (err) {
    console.error("Failed to connect to Sepolia RPC:", err.message);
  }
}

main().catch(console.error);
