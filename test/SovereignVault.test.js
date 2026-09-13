const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SovereignVault & MockRecoverySource — Real Smart Contract Tests", function () {
  let mockVerifier;
  let mockSource;
  let vault;
  let ownerA, ownerB, ownerC, unauthorizedSourceSigner, attacker;
  const PRECOMPILE_ADDR = "0x0000000000000000000000000000000000000FD2";
  const SEPOLIA_CHAIN_KEY = 1n;
  let localChainId;

  // Helper to construct binary EVM encoded transaction bytes matching EvmV1Decoder expectations
  function buildEncodedTransaction({
    txType = 2,
    chainId = 11155111n,
    emitterAddress,
    destinationChainId,
    destinationAccount,
    recoveryNonce = 0n,
    oldOwner,
    newOwner,
    receiptStatus = 1,
    corruptLog = false,
    emptyLogs = false,
    overrideEventSig = null,
  }) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // Chunk 0: CommonTxFields
    const chunk0 = abiCoder.encode(
      ["uint64", "uint64", "address", "bool", "address", "uint256", "bytes"],
      [0n, 100000n, oldOwner, false, emitterAddress, 0n, "0x"]
    );

    // Chunk 1: Type2Fields
    const chunk1 = abiCoder.encode(
      ["uint64", "uint128", "uint128", "tuple(address,bytes32[])[]", "uint8", "bytes32", "bytes32"],
      [chainId, 1000000000n, 2000000000n, [], 0, ethers.ZeroHash, ethers.ZeroHash]
    );

    // Log topics & data
    const eventSig =
      overrideEventSig ||
      ethers.id("RecoveryAuthorized(uint256,address,uint256,address,address)");

    const topic1 = ethers.zeroPadValue(destinationAccount, 32);
    const topic2 = ethers.zeroPadValue(oldOwner, 32);
    const topic3 = ethers.zeroPadValue(newOwner, 32);

    const logData = abiCoder.encode(
      ["uint256", "uint256"],
      [destinationChainId, recoveryNonce]
    );

    const topics = corruptLog ? [eventSig] : [eventSig, topic1, topic2, topic3];

    const logs = emptyLogs
      ? []
      : [
          {
            address_: emitterAddress,
            topics: topics,
            data: logData,
          },
        ];

    // Chunk 2: ReceiptFields
    const chunk2 = abiCoder.encode(
      ["uint8", "uint64", "tuple(address address_, bytes32[] topics, bytes data)[]", "bytes"],
      [receiptStatus, 50000n, logs, "0x"]
    );

    return abiCoder.encode(["uint8", "bytes[]"], [txType, [chunk0, chunk1, chunk2]]);
  }

  // Dummy Merkle proof & continuity proof fixtures
  const dummyProof = {
    action: 0,
    chainKey: SEPOLIA_CHAIN_KEY,
    blockHeight: 6500000n,
    merkleRoot: ethers.keccak256(ethers.toUtf8Bytes("merkleRoot-0")),
    siblings: [
      {
        hash: ethers.keccak256(ethers.toUtf8Bytes("sibling-0")),
        isLeft: false,
      },
    ],
    lowerEndpointDigest: ethers.keccak256(ethers.toUtf8Bytes("lowerEndpoint")),
    continuityRoots: [ethers.keccak256(ethers.toUtf8Bytes("continuity-0"))],
  };

  before(async function () {
    [ownerA, ownerB, ownerC, unauthorizedSourceSigner, attacker] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    localChainId = network.chainId;

    // Deploy MockNativeQueryVerifier and inject bytecode into 0xFD2 precompile slot
    const MockVerifierFactory = await ethers.getContractFactory("MockNativeQueryVerifier");
    mockVerifier = await MockVerifierFactory.deploy();
    await mockVerifier.waitForDeployment();

    const verifierBytecode = await ethers.provider.getCode(await mockVerifier.getAddress());
    await ethers.provider.send("hardhat_setCode", [PRECOMPILE_ADDR, verifierBytecode]);
  });

  beforeEach(async function () {
    // Deploy MockRecoverySource
    const MockSourceFactory = await ethers.getContractFactory("MockRecoverySource");
    mockSource = await MockSourceFactory.deploy(ownerA.address);
    await mockSource.waitForDeployment();

    // Deploy SovereignVault with ownerA, registered mockSource, and expectedSourceChainKey
    const VaultFactory = await ethers.getContractFactory("SovereignVault");
    vault = await VaultFactory.deploy(
      ownerA.address,
      await mockSource.getAddress(),
      SEPOLIA_CHAIN_KEY
    );
    await vault.waitForDeployment();
  });

  describe("Phase 2 — MockRecoverySource unit validations & Access Control", function () {
    it("configured recovery authority CAN emit RecoveryAuthorized", async function () {
      const destinationAccount = await vault.getAddress();
      await expect(
        mockSource.connect(ownerA).authorizeRecovery(
          localChainId,
          destinationAccount,
          0n,
          ownerA.address,
          ownerB.address
        )
      )
        .to.emit(mockSource, "RecoveryAuthorized")
        .withArgs(localChainId, destinationAccount, 0n, ownerA.address, ownerB.address);
    });

    it("arbitrary account CANNOT emit RecoveryAuthorized (reverts with UnauthorizedRecoveryAuthority)", async function () {
      const destinationAccount = await vault.getAddress();
      await expect(
        mockSource.connect(attacker).authorizeRecovery(
          localChainId,
          destinationAccount,
          0n,
          ownerA.address,
          ownerB.address
        )
      ).to.be.revertedWithCustomError(mockSource, "UnauthorizedRecoveryAuthority")
        .withArgs(attacker.address, ownerA.address);
    });

    it("rejects zero recoveryAuthority at deployment", async function () {
      const MockSourceFactory = await ethers.getContractFactory("MockRecoverySource");
      await expect(
        MockSourceFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(mockSource, "ZeroAddress");
    });

    it("rejects zero destinationChainId", async function () {
      await expect(
        mockSource.connect(ownerA).authorizeRecovery(0n, await vault.getAddress(), 0n, ownerA.address, ownerB.address)
      ).to.be.revertedWithCustomError(mockSource, "InvalidDestinationChain");
    });

    it("rejects zero addresses or identical owners", async function () {
      await expect(
        mockSource.connect(ownerA).authorizeRecovery(localChainId, ethers.ZeroAddress, 0n, ownerA.address, ownerB.address)
      ).to.be.revertedWithCustomError(mockSource, "ZeroAddress");

      await expect(
        mockSource.connect(ownerA).authorizeRecovery(localChainId, await vault.getAddress(), 0n, ownerA.address, ownerA.address)
      ).to.be.revertedWithCustomError(mockSource, "IdenticalOwners");
    });

    it("rejects zero expectedSourceChainKey at deployment", async function () {
      const VaultFactory = await ethers.getContractFactory("SovereignVault");
      await expect(
        VaultFactory.deploy(ownerA.address, await mockSource.getAddress(), 0n)
      ).to.be.revertedWithCustomError(vault, "InvalidSourceChain");
    });
  });

  describe("Phase 3 & 4 — Valid Recovery Flow", function () {
    it("VALID: A → B recovery succeeds, increments nonce, and emits AccountRecovered", async function () {
      expect(await vault.currentOwner()).to.equal(ownerA.address);
      expect(await vault.expectedRecoveryNonce()).to.equal(0n);

      const vaultAddr = await vault.getAddress();
      const sourceAddr = await mockSource.getAddress();

      const encodedTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ownerB.address,
      });

      const tx = await vault.execute(
        dummyProof.action,
        dummyProof.chainKey,
        dummyProof.blockHeight,
        encodedTx,
        dummyProof.merkleRoot,
        dummyProof.siblings,
        dummyProof.lowerEndpointDigest,
        dummyProof.continuityRoots
      );

      await expect(tx).to.emit(vault, "AccountRecovered");

      expect(await vault.currentOwner()).to.equal(ownerB.address);
      expect(await vault.expectedRecoveryNonce()).to.equal(1n);
    });

    it("SEQUENTIAL: A → B (nonce 0) followed by B → C (nonce 1)", async function () {
      const vaultAddr = await vault.getAddress();
      const sourceAddr = await mockSource.getAddress();

      // Step 1: A -> B
      const encodedTx1 = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ownerB.address,
      });

      await vault.execute(
        0,
        dummyProof.chainKey,
        100n,
        encodedTx1,
        dummyProof.merkleRoot,
        dummyProof.siblings,
        dummyProof.lowerEndpointDigest,
        dummyProof.continuityRoots
      );

      expect(await vault.currentOwner()).to.equal(ownerB.address);
      expect(await vault.expectedRecoveryNonce()).to.equal(1n);

      // Step 2: B -> C (nonce 1, new block height to vary queryId)
      const encodedTx2 = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 1n,
        oldOwner: ownerB.address,
        newOwner: ownerC.address,
      });

      const siblings2 = [
        {
          hash: ethers.keccak256(ethers.toUtf8Bytes("sibling-step2")),
          isLeft: false,
        },
      ];

      await vault.execute(
        0,
        dummyProof.chainKey,
        101n,
        encodedTx2,
        dummyProof.merkleRoot,
        siblings2,
        dummyProof.lowerEndpointDigest,
        dummyProof.continuityRoots
      );

      expect(await vault.currentOwner()).to.equal(ownerC.address);
      expect(await vault.expectedRecoveryNonce()).to.equal(2n);
    });
  });

  describe("Phase 3 & 4 — Invalid Recovery Scenarios", function () {
    let vaultAddr, sourceAddr;

    beforeEach(async function () {
      vaultAddr = await vault.getAddress();
      sourceAddr = await mockSource.getAddress();
    });

    it("INVALID: wrong source chainKey rejected", async function () {
      const wrongSourceChainKey = 3n; // e.g. Ethereum Mainnet instead of Sepolia (1)
      const encodedTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ownerB.address,
      });

      await expect(
        vault.execute(
          0,
          wrongSourceChainKey,
          dummyProof.blockHeight,
          encodedTx,
          dummyProof.merkleRoot,
          dummyProof.siblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWithCustomError(vault, "InvalidSourceChain");
    });

    it("INVALID: unauthorized source emitter", async function () {
      const fakeSource = unauthorizedSourceSigner.address;
      const encodedTx = buildEncodedTransaction({
        emitterAddress: fakeSource,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ownerB.address,
      });

      await expect(
        vault.execute(
          0,
          dummyProof.chainKey,
          dummyProof.blockHeight,
          encodedTx,
          dummyProof.merkleRoot,
          dummyProof.siblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWithCustomError(vault, "UnauthorizedSourceEmitter");
    });

    it("INVALID: wrong destination chain", async function () {
      const wrongChainId = 999999n;
      const encodedTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: wrongChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ownerB.address,
      });

      await expect(
        vault.execute(
          0,
          dummyProof.chainKey,
          dummyProof.blockHeight,
          encodedTx,
          dummyProof.merkleRoot,
          dummyProof.siblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWithCustomError(vault, "InvalidDestinationChain");
    });

    it("INVALID: wrong destination account", async function () {
      const wrongAccount = attacker.address;
      const encodedTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: wrongAccount,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ownerB.address,
      });

      await expect(
        vault.execute(
          0,
          dummyProof.chainKey,
          dummyProof.blockHeight,
          encodedTx,
          dummyProof.merkleRoot,
          dummyProof.siblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWithCustomError(vault, "WrongDestinationAccount");
    });

    it("INVALID: wrong nonce (skipped nonce 5 instead of 0)", async function () {
      const encodedTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 5n,
        oldOwner: ownerA.address,
        newOwner: ownerB.address,
      });

      await expect(
        vault.execute(
          0,
          dummyProof.chainKey,
          dummyProof.blockHeight,
          encodedTx,
          dummyProof.merkleRoot,
          dummyProof.siblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWithCustomError(vault, "InvalidRecoveryNonce");
    });

    it("INVALID: wrong oldOwner", async function () {
      const wrongOldOwner = attacker.address;
      const encodedTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: wrongOldOwner,
        newOwner: ownerB.address,
      });

      await expect(
        vault.execute(
          0,
          dummyProof.chainKey,
          dummyProof.blockHeight,
          encodedTx,
          dummyProof.merkleRoot,
          dummyProof.siblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWithCustomError(vault, "WrongOldOwner");
    });

    it("INVALID: zero newOwner", async function () {
      const encodedTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ethers.ZeroAddress,
      });

      await expect(
        vault.execute(
          0,
          dummyProof.chainKey,
          dummyProof.blockHeight,
          encodedTx,
          dummyProof.merkleRoot,
          dummyProof.siblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWithCustomError(vault, "ZeroNewOwner");
    });

    it("INVALID: same newOwner as current owner", async function () {
      const encodedTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ownerA.address,
      });

      await expect(
        vault.execute(
          0,
          dummyProof.chainKey,
          dummyProof.blockHeight,
          encodedTx,
          dummyProof.merkleRoot,
          dummyProof.siblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWithCustomError(vault, "IdenticalNewOwner");
    });

    it("INVALID: replay of the exact same query/proof fails", async function () {
      const encodedTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ownerB.address,
      });

      // First execution succeeds
      await vault.execute(
        0,
        dummyProof.chainKey,
        dummyProof.blockHeight,
        encodedTx,
        dummyProof.merkleRoot,
        dummyProof.siblings,
        dummyProof.lowerEndpointDigest,
        dummyProof.continuityRoots
      );

      // Second identical execution MUST revert via ASCBase query deduplication
      await expect(
        vault.execute(
          0,
          dummyProof.chainKey,
          dummyProof.blockHeight,
          encodedTx,
          dummyProof.merkleRoot,
          dummyProof.siblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWith("Query already processed");
    });

    it("INVALID: stale nonce rejected even if fresh queryId", async function () {
      // Execute 0 -> A to B
      const encodedTx0 = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerA.address,
        newOwner: ownerB.address,
      });

      await vault.execute(
        0,
        dummyProof.chainKey,
        200n,
        encodedTx0,
        dummyProof.merkleRoot,
        dummyProof.siblings,
        dummyProof.lowerEndpointDigest,
        dummyProof.continuityRoots
      );

      expect(await vault.currentOwner()).to.equal(ownerB.address);
      expect(await vault.expectedRecoveryNonce()).to.equal(1n);

      // Attempt to submit another transaction also claiming nonce 0
      const staleTx = buildEncodedTransaction({
        emitterAddress: sourceAddr,
        destinationChainId: localChainId,
        destinationAccount: vaultAddr,
        recoveryNonce: 0n,
        oldOwner: ownerB.address,
        newOwner: ownerC.address,
      });

      const differentSiblings = [
        {
          hash: ethers.keccak256(ethers.toUtf8Bytes("different-sibling")),
          isLeft: false,
        },
      ];

      await expect(
        vault.execute(
          0,
          dummyProof.chainKey,
          201n,
          staleTx,
          dummyProof.merkleRoot,
          differentSiblings,
          dummyProof.lowerEndpointDigest,
          dummyProof.continuityRoots
        )
      ).to.be.revertedWithCustomError(vault, "InvalidRecoveryNonce");
    });
  });

  describe("Critical Access-Control Rule", function () {
    it("CRITICAL: _processRecovery cannot be called externally", async function () {
      // Verify that _processRecovery does not exist in the contract ABI
      let found = false;
      vault.interface.forEachFunction((func) => {
        if (func.name.includes("processRecovery") || func.name.includes("_processRecovery")) {
          found = true;
        }
      });
      expect(found).to.be.false;

      // Attempting to invoke raw calldata for a hypothetical public processRecovery must revert
      const fakeSelector = ethers.id("_processRecovery((address,uint256,address,uint256,address,address),bytes32)").slice(0, 10);
      await expect(
        attacker.sendTransaction({
          to: await vault.getAddress(),
          data: fakeSelector,
        })
      ).to.be.reverted;
    });
  });
});

