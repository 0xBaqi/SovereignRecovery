const recovery = {
  status: "RECOVERY VERIFIED",
  sourceNetwork: "Ethereum Sepolia",
  destinationNetwork: "Creditcoin CC3",
  sourceChainKey: "1",
  destinationChainId: "102031",

  recoveryAuthority: "0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c",
  vault: "0x2d2470Ff6eD7563d0109d9C180cc9F1805d09fF9",

  previousOwner: "0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c",
  currentOwner: "0xAE05B00d4bF1ABC3DA94622831AecFBd3539ef21",

  recoveryNonce: "1",

  sourceTx:
    "0x0b076ac2c1242f4905c2a9d4e30f56163051ebe558bbab0a5a0f95884bab9363",

  executionTx:
    "0x473918051d6590c2e3aeb30f2b5c48d00e54ecfa13b97ac738d61b6c9869f483",

  queryId:
    "0x42b043bcd9c91f0266ae31573d1f3f397ab1601c723d4bd3d1ae3e45e57525fb",

  sourceBlock: "11697145",
  executionBlock: "5481810",
  proofSiblingCount: "7",
  continuityRootCount: "6",
  gasUsed: "140,476",
  verifier: "0x0000000000000000000000000000000000000FD2",
};

function shorten(value) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/40">
              SovereignRecovery
            </p>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Recover once. Recover across chains.
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Ethereum-authorized account recovery verified on Creditcoin using
              Attestcoin — without a trusted relayer or centralized oracle.
            </p>
          </div>

          <StatusBadge>{recovery.status}</StatusBadge>
        </header>

        <section className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.035] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Live Attestcoin verification
              </p>

              <p className="mt-2 text-sm leading-6 text-white/60">
                A real Sepolia recovery authorization was cryptographically
                proven and consumed by SovereignVault on Creditcoin CC3.
              </p>
            </div>

            <div className="font-mono text-xs text-white/45">
              verifier {shorten(recovery.verifier)}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Panel>
            <div className="flex items-start justify-between gap-6">
              <div>
                <Label>Protected account</Label>
                <h2 className="mt-2 text-xl font-medium">
                  Creditcoin Sovereign Vault
                </h2>
              </div>

              <Tag>CC3</Tag>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <Info label="Vault address" value={shorten(recovery.vault)} />
              <Info label="Recovery nonce" value={recovery.recoveryNonce} />

              <Info
                label="Previous owner"
                value={shorten(recovery.previousOwner)}
              />

              <Info
                label="Current owner"
                value={shorten(recovery.currentOwner)}
                emphasis
              />
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <Label>Ownership transition</Label>

              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                <AddressBox
                  label="Owner A"
                  value={shorten(recovery.previousOwner)}
                />

                <div className="text-center text-lg text-white/25">→</div>

                <AddressBox
                  label="Owner B"
                  value={shorten(recovery.currentOwner)}
                  active
                />
              </div>
            </div>
          </Panel>

          <Panel>
            <Label>Recovery authority</Label>
            <h2 className="mt-2 text-xl font-medium">Ethereum security root</h2>

            <div className="mt-8 space-y-6">
              <Info
                label="Authority"
                value={shorten(recovery.recoveryAuthority)}
              />

              <Info label="Source network" value={recovery.sourceNetwork} />

              <Info
                label="Attestcoin chain key"
                value={recovery.sourceChainKey}
              />

              <Info
                label="Destination"
                value={`${recovery.destinationNetwork} · ${recovery.destinationChainId}`}
              />
            </div>
          </Panel>
        </section>

        <Panel className="mt-6">
          <Label>Verified recovery path</Label>

          <h2 className="mt-2 text-xl font-medium">
            Ethereum authorization → Attestcoin → Creditcoin recovery
          </h2>

          <div className="mt-8 grid gap-3 lg:grid-cols-5">
            <Step
              number="01"
              title="Authorized"
              body="Recovery authority emits the exact recovery instruction on Sepolia."
            />

            <Step
              number="02"
              title="Attested"
              body="Attestcoin confirms the source block inside Creditcoin."
              highlight
            />

            <Step
              number="03"
              title="Proven"
              body="ProofBuilder creates transaction inclusion and continuity evidence."
              highlight
            />

            <Step
              number="04"
              title="Verified"
              body="Creditcoin's native 0xFD2 verifier validates the foreign-chain proof."
              highlight
            />

            <Step
              number="05"
              title="Recovered"
              body="Vault ownership changes A → B and the nonce advances."
            />
          </div>
        </Panel>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Evidence
            label="Ethereum authorization"
            network="Ethereum Sepolia"
            hash={recovery.sourceTx}
            block={recovery.sourceBlock}
            href={`https://sepolia.etherscan.io/tx/${recovery.sourceTx}`}
            status="Confirmed"
          />

          <Evidence
            label="Creditcoin execution"
            network="Creditcoin CC3"
            hash={recovery.executionTx}
            block={recovery.executionBlock}
            href={`https://creditcoin-testnet.blockscout.com/tx/${recovery.executionTx}`}
            status="Recovered"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <Panel>
            <div className="flex items-start justify-between gap-5">
              <div>
                <Label>Attestcoin proof</Label>
                <h2 className="mt-2 text-lg font-medium">
                  Cross-chain evidence accepted by CC3
                </h2>
              </div>

              <StatusBadge>PROOF VALID</StatusBadge>
            </div>

            <div className="mt-7 grid gap-6 sm:grid-cols-2">
              <Info label="Source block" value={recovery.sourceBlock} />

              <Info
                label="Merkle siblings"
                value={recovery.proofSiblingCount}
              />

              <Info
                label="Continuity roots"
                value={recovery.continuityRootCount}
              />

              <Info
                label="Execution gas"
                value={recovery.gasUsed}
              />
            </div>

            <div className="mt-7 border-t border-white/10 pt-5">
              <Label>Native verifier</Label>
              <p className="mt-2 break-all font-mono text-sm text-white/65">
                {recovery.verifier}
              </p>
            </div>
          </Panel>

          <Panel>
            <Label>Security properties</Label>

            <div className="mt-6 space-y-4">
              <SecurityCheck text="Recovery authority access-controlled" />
              <SecurityCheck text="Source chain locked to Sepolia" />
              <SecurityCheck text="Destination account explicitly bound" />
              <SecurityCheck text="Monotonic recovery nonce enforced" />
              <SecurityCheck text="Exact proof replay rejected on-chain" />
            </div>
          </Panel>
        </section>

        <Panel className="mt-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <Label>Replay protection</Label>

              <h2 className="mt-2 text-lg font-medium">
                Exact proof replay rejected on-chain
              </h2>
            </div>

            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 font-mono text-sm text-emerald-300">
              Query already processed
            </div>
          </div>

          <div className="mt-5 border-t border-white/10 pt-5">
            <Label>Query ID</Label>

            <p className="mt-2 break-all font-mono text-sm text-white/60">
              {recovery.queryId}
            </p>
          </div>
        </Panel>

        <footer className="mt-10 border-t border-white/10 py-7 text-xs text-white/30">
          SovereignRecovery · BUIDL CTC 2026 · Powered by Attestcoin
        </footer>
      </div>
    </main>
  );
}

function Panel({ children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/[0.025] p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function Label({ children }) {
  return (
    <p className="text-xs uppercase tracking-[0.18em] text-white/35">
      {children}
    </p>
  );
}

function Info({ label, value, emphasis = false }) {
  return (
    <div>
      <Label>{label}</Label>

      <p
        className={`mt-2 font-mono text-sm ${emphasis ? "text-emerald-300" : "text-white/75"
          }`}
      >
        {value}
      </p>
    </div>
  );
}

function Tag({ children }) {
  return (
    <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
      {children}
    </span>
  );
}

function StatusBadge({ children }) {
  return (
    <div className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold tracking-wide text-emerald-300">
      {children}
    </div>
  );
}

function AddressBox({ label, value, active = false }) {
  return (
    <div
      className={`flex-1 rounded-xl border p-4 ${active
          ? "border-emerald-400/25 bg-emerald-400/[0.06]"
          : "border-white/10 bg-black/20"
        }`}
    >
      <p className="text-xs text-white/35">{label}</p>

      <p className="mt-2 font-mono text-sm text-white/75">{value}</p>
    </div>
  );
}

function Step({ number, title, body, highlight = false }) {
  return (
    <div
      className={`rounded-xl border p-4 ${highlight
          ? "border-emerald-400/15 bg-emerald-400/[0.025]"
          : "border-white/10 bg-black/20"
        }`}
    >
      <p
        className={`text-xs font-medium ${highlight ? "text-emerald-300/60" : "text-white/25"
          }`}
      >
        {number}
      </p>

      <h3 className="mt-6 text-sm font-medium">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-white/45">{body}</p>
    </div>
  );
}

function Evidence({ label, network, hash, block, href, status }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white/45">{label}</p>
          <p className="mt-1 text-xs text-white/30">
            {network} · block {block}
          </p>
        </div>

        <Tag>{status}</Tag>
      </div>

      <p className="mt-6 break-all font-mono text-sm leading-6 text-white/65">
        {hash}
      </p>

      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
      >
        View on explorer ↗
      </a>
    </div>
  );
}

function SecurityCheck({ text }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-xs text-emerald-300">
        ✓
      </span>

      <span className="text-sm text-white/60">{text}</span>
    </div>
  );
}
