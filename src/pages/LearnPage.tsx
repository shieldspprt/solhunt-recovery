import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BookOpen, ExternalLink, ChevronRight, Shield, Code2, Server, Cpu, Sparkles, Terminal, FileText, Zap } from 'lucide-react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ENGINE_METADATA } from '@/config/constants';

interface LearnContent {
    title: string;
    description: string;
    icon: React.ReactNode;
    conceptIntro: React.ReactNode;
    technicalDetails: React.ReactNode;
    resources: { label: string; url: string }[];
}

const LEARN_CONTENT_MAP: Record<string, LearnContent> = {
    '1': {
        title: 'Revoke Permissions',
        description: 'Understand SPL Token Delegation and how to safely revoke allowances.',
        icon: <Shield className="h-5 w-5" />,
        conceptIntro: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    On Solana, smart contracts (programs) cannot move your tokens unless you grant them permission. This permission is called "Delegation" and it allows a third-party to transfer up to a specified mathematical limit of your tokens without needing your signature for every single transaction.
                </p>
                <p>
                    This is incredibly useful for decentralized exchanges (DEXs) processing limit orders or lending protocols liquidating collateral. For example, when you place a limit order on Jupiter, a temporary delegate is assigned to route your funds when the price triggers.
                </p>
                <p>
                    However, if a delegated program is ever compromised by a malicious actor, or if you connected to a phishing site disguised as a real dApp, they can exploit that standing permission. A single malicious transaction could drain the approved limit directly from your wallet, bypassing standard wallet confirmation screens entirely.
                </p>
            </div>
        ),
        technicalDetails: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    The Solana Token Program encompasses native `Approve` and `Revoke` instructions defined in the spl-token standard. When you approve a delegate, the network state updates your Token Account to set the `delegate_option` to `1` (true). The network then stores the `delegate` `Pubkey` and `delegated_amount` as `u64`.
                </p>
                <p>
                    To secure your wallet retrospectively, you must broadcast a transaction containing a `Revoke` instruction targeted at that specific Token Account. The transaction must be signed by the `Owner` authority.
                </p>
                <p>
                    Once processed by a validator, the `Revoke` instruction forcefully clears the delegate fields back to null on-chain. This immediately removes any standing withdrawal authority, neutralizing the risk vector instantly. SolHunt reads the exact `delegate_amount` directly from the RPC `getParsedTokenAccountsByOwner` payload to identify these accounts.
                </p>
            </div>
        ),
        resources: [
            { label: 'SPL Token Program Docs', url: 'https://spl.solana.com/token' },
            { label: 'Solana Dev: Tokens', url: 'https://solana.com/developers/guides/getstarted/tokens' }
        ]
    },
    '2': {
        title: 'Reclaim Rent',
        description: 'Learn about Solana State Rent and the lifecycle of Token Accounts.',
        icon: <Cpu className="h-5 w-5" />,
        conceptIntro: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    Solana is an ultra-fast blockchain, but storing data (also known as "state") physically costs memory on validator machines. To prevent state bloat and spam, the protocol requires a deposit paid in SOL to keep an account alive. This is called "Rent Exemption."
                </p>
                <p>
                    Every time you buy a new token on a DEX or receive an NFT, a new Associated Token Account (ATA) or legacy Token Account is initialized specifically to hold that asset. This initialization locks up approximately 0.00203928 SOL (the exact rent required for a 165-byte Token Account).
                </p>
                <p>
                    When you sell that token, the balance drops to zero. However, the empty shell of the account remains active on the ledger. Unless instructed otherwise, the Solana protocol assumes you might use the account again, holding your ~0.002 SOL deposit hostage indefinitely.
                </p>
            </div>
        ),
        technicalDetails: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    To aggressively reclaim this deposit, the protocol provides the native `CloseAccount` instruction within the SPL Token program framework. This instruction takes three key accounts: the target account being closed, the destination account for the rent lamports, and the owner authority.
                </p>
                <p>
                    The validator network verifies the instruction, deletes the account's data structure from memory entirely, and transfers all internal rent lamports (SOL) directly to your main wallet.
                </p>
                <div className="bg-shield-bg/80 p-3 rounded-lg border border-shield-border/40 mt-2 font-mono text-xs">
                    <span className="text-shield-warning">CRITICAL SAFETY:</span> The BPF (Berkeley Packet Filter) runtime running on Solana validators strictly enforcing the Token Program will automatically fail the transaction with `TokenError::NonNativeHasBalance` if the account holds more than 0 tokens. This provides a protocol-level mathematical guarantee that you cannot accidentally "burn" active assets when reclaiming rent.
                </div>
            </div>
        ),
        resources: [
            { label: 'Solana Docs: State Rent', url: 'https://docs.solana.com/implemented-proposals/rent' },
            { label: 'Solana Cookbook: Closing Accounts', url: 'https://solanacookbook.com/references/token.html#how-to-close-token-account' }
        ]
    },
    '3': {
        title: 'Sweep Dust',
        description: 'Clear fractional token dust via Jupiter swaps and SPL Burn mechanics.',
        icon: <Sparkles className="h-5 w-5" />,
        conceptIntro: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    "Dust" refers to fractional amounts of tokens (e.g., 0.000004 USDC) left behind in your wallet after decentralized trades. These fractions accumulate due to AMM pricing curve math, slippage tolerances, and rounding decimals.
                </p>
                <p>
                    While financially worthless, these fractional tokens prevent you from closing the associated Token Account, meaning your ~0.002 SOL rent deposit remains locked until the balance reaches a mathematical absolute zero.
                </p>
            </div>
        ),
        technicalDetails: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    To clear dust, there are two technical pathways: <br />
                    1. <strong>Routing:</strong> If the token has liquidity, we query the `Jupiter V6 Aggregator API` to build an exact-out route swapping the fractional amount into SOL. <br />
                    2. <strong>Burning:</strong> If the token has no liquidity (rug pulls), you must permanently destroy the supply via the native SPL `Burn` instruction. Once total supply in the account equals 0, the transaction immediately chains a `CloseAccount` instruction to release the rent.
                </p>
            </div>
        ),
        resources: [
            { label: 'Jupiter API Documentation', url: 'https://station.jup.ag/docs' },
            { label: 'SPL Burn Instruction', url: 'https://spl.solana.com/token#burning' }
        ]
    },
    '4': {
        title: 'Claim Stakes',
        description: 'Understand Delayed Unstaking and state tickets for LST protocols.',
        icon: <Server className="h-5 w-5" />,
        conceptIntro: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    Liquid Staking Tokens (LSTs) like mSOL (Marinade) or JitoSOL represent native SOL delegated to network validators on your behalf. When you "unstake" these directly through the protocol smart contract instead of swapping them into an AMM pool, you trigger a delayed withdrawal process.
                </p>
                <p>
                    This delayed process must wait for the current Solana global epoch to end (an epoch lasts approximately 2 to 3 days, containing 432,000 slots). During this waiting period, protocols issue a PDA (Program Derived Address) acting as a "Ticket" or a "Stake Account" locked to your identity.
                </p>
                <p>
                    Crucially, when the epoch ends, the native SOL is unlocked but it does NOT automatically return to your immediate balance. It sits dormant in a protocol-controlled vault waiting for a manual cryptographic claim request.
                </p>
            </div>
        ),
        technicalDetails: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    Extracting delayed stakes requires specific Anchor Instruction invocations. SolHunt parses the Solana RPC using `getProgramAccounts` with Base58 data filters matching your wallet's `Pubkey` as the ticket beneficiary.
                </p>
                <p>
                    For instance, Marinade Finance requires parsing a `TicketAccountData` struct. If the `ticket_due_date` has passed relative to the current `Clock` sysvar, we construct the `Claim` instruction using an 8-byte discriminator (`[62, 198, 214, 193, 213, 159, 108, 210]`). The program cross-verifies the ticket PDA, the Marinade State PDA, and the Reserve PDA.
                </p>
                <p>
                    Similarly, Sanctum requires intricate Router program invocations (`sanctum-router`). By serializing these interactions directly against the blockchain nodes, we execute these transactions safely without requiring the protocol's web interfaces to still be active or responding.
                </p>
            </div>
        ),
        resources: [
            { label: 'Marinade Finance Dev Docs', url: 'https://docs.marinade.finance/developers' },
            { label: 'Sanctum LST Router', url: 'https://www.sanctum.so/' },
            { label: 'Solana Epochs', url: 'https://solana.com/docs/core/clusters#epoch' }
        ]
    },
    '5': {
        title: 'Harvest LP Fees',
        description: 'Extract unclaimed yields from Concentrated Liquidity Market Makers.',
        icon: <Zap className="h-5 w-5" />,
        conceptIntro: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    Providing liquidity on modern DEXs involves Concentrated Liquidity Market Makers (CLMMs), popularised by protocols like Raydium V3, Orca Whirlpools, and Meteora DLMMs. When traders swap tokens through a price range you are providing liquidity for, the smart contract captures a small percentage fee.
                </p>
                <p>
                    However, unlike older v2 AMMs where fees automatically accrue into the value of the LP token itself, CLMM architectures segregate the trading fees. They are stored natively in an internal reward vault mapped to your specific liquidity position. You must pay a network fee and manually "harvest" them to move the profit to your wallet.
                </p>
            </div>
        ),
        technicalDetails: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    Your specific market footprint within a CLMM is represented by a non-fungible Position NFT held in your wallet. The smart contract relies on this `mint_address` to resolve a PDA (Program Derived Address) computing the exact fee distribution owed across ticks.
                </p>
                <p>
                    SolHunt queries these NFTs using standard Metaplex token standard techniques. Using official protocol SDKs (e.g. `@raydium-io/raydium-sdk-v2` or the Whirlpool TypeScript Client), we calculate the exact nested accounts required to interface with the pool. We then construct the rigid `collectFees` or `harvest` Anchor instructions.
                </p>
                <div className="bg-shield-bg/80 p-3 rounded-lg border border-shield-border/40 mt-2 font-mono text-xs">
                    <span className="text-[#1DA1F2]">MATHEMATICAL ISOLATION:</span> In Anchor IDLs, claiming rewards and withdrawing liquidity are separate instructions with different 8-byte discriminators. Because the transaction payload explicitly omits the `decreaseLiquidity` instruction, the smart contract will strictly reject any attempt to modify your principal liquidity amount during a harvest call.
                </div>
            </div>
        ),
        resources: [
            { label: 'Raydium V3 SDK', url: 'https://github.com/raydium-io/raydium-sdk-V2' },
            { label: 'Orca Whirlpools Core API', url: 'https://github.com/orca-so/whirlpools' }
        ]
    },
    '7': {
        title: 'MEV & Priority Fees',
        description: 'Learn how Jito Block Engine tips are distributed and claimed via Merkle Proofs.',
        icon: <Terminal className="h-5 w-5" />,
        conceptIntro: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    Maximal Extractable Value (MEV) occurs when trading bots pay massive "tips" out-of-band to network validators. They do this to guarantee their transactions land first in a block (usually to execute lucrative arbitrage or liquidations).
                </p>
                <p>
                    The Jito Network created a client that collects these tips in an off-chain Block Engine. Crucially, Jito distributes 100% of these MEV tips back to the validators running the software and the stakers (you) delegating to those validators.
                </p>
                <p>
                    However, tracking millions of micro-tips on-chain is computationally impossible. Thus, these tips are pooled off-chain. To claim your share, you must provide cryptographic evidence to a Solana smart contract proving that your wallet address corresponds to a stake footprint owed a specific fraction of the epoch's pool.
                </p>
            </div>
        ),
        technicalDetails: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    Jito uploads a "Merkle Root" (a 32-byte hash) to the Tip Distribution Program (`4R3gSGeK9D29aK25x96R3x7e3t2y8F7d4v8H1e5d3g6j`) periodically. This root acts as a securely compressed fingerprint representing a massive off-chain ledger containing thousands of specific wallet addresses and their owed lamports.
                </p>
                <p>
                    To execute a claim, SolHunt queries the `kobe.mainnet.jito.network` REST API to fetch a "Merkle Proof" for your specific wallet. The proof is an array of intermediate hashes. If you hash your `[address + owed amount]`, and iteratively hash it alongside the proof array, it will ultimately compute exactly to the public Merkle Root.
                </p>
                <p>
                    We format this array into the Anchor execution payload targeting the `Claim` instruction of the Tip Distribution contract. The Solana runtime performs the hashing verification mathematically inside the block execution. If the derived root matches the stored root perfectly, the contract unleashes the specific SOL balance to your wallet instantly.
                </p>
            </div>
        ),
        resources: [
            { label: 'Jito Tip Distribution System', url: 'https://jito-foundation.gitbook.io/jito/jito-mempool/tip-distribution-system' },
            { label: 'Understanding Merkle Trees', url: 'https://en.wikipedia.org/wiki/Merkle_tree' }
        ]
    },
    '9': {
        title: 'Dead Protocol Rescue',
        description: 'Salvage trapped liquidity from sunset DeFi protocols using Anchor IDLs.',
        icon: <Code2 className="h-5 w-5" />,
        conceptIntro: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    The decentralized finance (DeFi) ecosystem scales quickly, but inevitably deals with high turnover. High-profile protocols frequently sunset, migrate, or face operational shutdown contingencies (e.g., Friktion Volts transitioning to inactive states, Saber AMMs freezing frontend hosting).
                </p>
                <p>
                    When developers take custom web user interfaces offline, retail users are often left stranded holding synthetic "receipt tokens" (such as tracking LP tokens or lending certificates) but absolutely no accessible interface to click a "Withdraw" button.
                </p>
                <p>
                    Crucially, Solana is fundamentally decentralized. The underlying smart contracts (`program_id`s) and the asset vaults (Token Accounts owned by PDAs) are permanent execution layer entities. As long as the Solana blockchain is running, those assets remain mathematically recoverable.
                </p>
            </div>
        ),
        technicalDetails: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    The rescue operation begins with asset accounting. By maintaining an open-source registry (`DEAD_PROTOCOLS`) of known defunct Program IDs and corresponding Vault Public Keys, SolHunt can rapidly scan `getTokenAccountsByOwner` payload structures against the known database. Value is then appraised by mapping the vault's base token against DexScreener's real-time API.
                </p>
                <p>
                    To execute a rescue, the engine must simulate the exact behavior of the protocol's defunct frontend. We analyze the program's original byte-structure using the Anchor Interface Description Language (IDL)—a JSON specification defining how arguments are packed.
                </p>
                <p>
                    We map the required array of Accounts (the vault PDA, the token mint, the user authority, the system program) and pack the correct 8-byte instruction discriminator representing `Withdraw`. You sign the transaction natively through your wallet extension. The raw payload circumvents the need for any website domains and interacts directly with the "dead" smart contract at the validator node level, safely unwinding your receipt tokens back into the raw asset layer.
                </p>
            </div>
        ),
        resources: [
            { label: 'Anchor Framework IDL', url: 'https://www.anchor-lang.com/docs/idl' },
            { label: 'Solana Program Library', url: 'https://spl.solana.com/' }
        ]
    },
    '10': {
        title: 'Recover Program Buffers',
        description: 'Understand the Upgradable BPF Loader and how to salvage failed deployments.',
        icon: <FileText className="h-5 w-5" />,
        conceptIntro: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    Deploying a massive smart contract (written in Rust) to Solana is a multi-step networking process. Because production program binaries can exceed hundreds of kilobytes, the Solana CLI sends the code in fragments (chunks). These chunks are written sequentially into a temporary system ledger entity called a "Buffer Account".
                </p>
                <p>
                    To prevent malicious actors from spamming infinite bytes of buffer data on validators, creating a Buffer Account requires an enormous rent deposit scaling linearly with byte-count—often equating to upwards of 1 to 50 SOL out-of-pocket for standard protocols.
                </p>
                <p>
                    If the deployment crashes due to an RPC timeout, network congestion, or a simple command abortion, the `solana program deploy` transaction terminates. However, the Buffer Account and its massive SOL deposit remains completely abandoned. Thousands of developers and automated AI deployment agents unintentionally lock monumental capital inside these orphaned fragments.
                </p>
            </div>
        ),
        technicalDetails: (
            <div className="space-y-4 text-shield-muted leading-relaxed">
                <p>
                    Solana's core execution environment is managed by the `BPFLoaderUpgradeab1e11111111111111111111111` native program. We execute a `getProgramAccounts` RPC call leveraging specific memory offset filters to isolate all buffer accounts where your wallet `Pubkey` is strictly verified as the authorized `Deployer Key`.
                </p>
                <p>
                    To rescue the locked SOL, we construct a transaction containing the native `BPF Close` instruction targeted specifically at the orphaned buffer's public key.
                </p>
                <p>
                    The validator inspects the instruction. Because you retain the Deployer Key signature authorization, the BPF Loader successfully authorizes the action. It subsequently destroys the orphaned bytecode from validator memory and instantly refunds the trapped lamports back to your authority address in the exact same epoch cycle.
                </p>
            </div>
        ),
        resources: [
            { label: 'Solana Docs: BPF Loader', url: 'https://docs.solana.com/developing/deployed-programs#bpf-loader' },
            { label: 'Managing Program Buffers', url: 'https://solana.com/developers/guides/advanced/managing-program-deployments' }
        ]
    }
};

export function LearnPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Default to engine 1 if no specific engine is selected or an invalid one is passed
    const activeEngineId = id && LEARN_CONTENT_MAP[id] ? id : '1';
    const activeContent = LEARN_CONTENT_MAP[activeEngineId];

    // Ensure URL matches active state
    useEffect(() => {
        if (!id || !LEARN_CONTENT_MAP[id]) {
            navigate(`/learn/1`, { replace: true });
        }
    }, [id, navigate]);

    return (
        <PageWrapper>
            <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">

                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shield-accent/10 border border-shield-accent/20 text-shield-accent text-xs font-semibold mb-4 uppercase tracking-wider">
                        <BookOpen className="h-4 w-4" />
                        Learning Hub
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-shield-text">
                        Solana Engine Architecture
                    </h1>
                    <p className="text-lg text-shield-muted max-w-3xl">
                        Deep technical explanations of how our non-custodial tools interact with the Solana blockchain safely. Select an engine to learn more and explore official documentation.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar */}
                    <aside className="lg:w-1/3 xl:w-1/4 flex-shrink-0">
                        <div className="glass-card rounded-2xl border border-shield-border/50 overflow-hidden sticky top-24">
                            <div className="p-4 border-b border-shield-border/50 bg-shield-bg/50">
                                <h3 className="font-semibold text-shield-text">Recovery Engines</h3>
                            </div>
                            <nav className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                                {ENGINE_METADATA.map((engine) => {
                                    if (!LEARN_CONTENT_MAP[engine.id]) return null;

                                    const isActive = activeEngineId === engine.id.toString();

                                    return (
                                        <Link
                                            key={engine.id}
                                            to={`/learn/${engine.id}`}
                                            className={`w-full flex items-center justify-between text-left px-3 py-3 rounded-xl transition-all duration-200 ${isActive
                                                ? 'bg-shield-accent/10 border border-shield-accent/30 text-shield-accent font-medium shadow-sm'
                                                : 'text-shield-muted hover:bg-shield-card hover:text-shield-text border border-transparent'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="opacity-70">{LEARN_CONTENT_MAP[engine.id].icon}</span>
                                                {engine.name}
                                            </span>
                                            {isActive && <ChevronRight className="h-4 w-4" />}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    {/* Main Content Pane */}
                    <main className="flex-1 min-w-0">
                        {activeContent && (
                            <div className="glass-card rounded-3xl p-6 sm:p-10 border border-shield-border/40 animate-fade-in relative overflow-hidden">
                                {/* Decorative gradient */}
                                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-shield-accent/5 rounded-full blur-3xl" />

                                <header className="mb-10 relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-shield-accent/10 text-shield-accent border border-shield-accent/20">
                                            {activeContent.icon}
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-bold text-shield-text">
                                            {activeContent.title}
                                        </h2>
                                    </div>
                                    <p className="text-xl text-shield-muted max-w-2xl font-medium">
                                        {activeContent.description}
                                    </p>
                                </header>

                                <div className="space-y-12 relative z-10">
                                    <section>
                                        <h3 className="flex items-center gap-2 text-xl font-bold text-white mb-6 border-b border-shield-border border-dashed pb-3">
                                            <BookOpen className="h-5 w-5 text-shield-accent" />
                                            Conceptual Overview
                                        </h3>
                                        {activeContent.conceptIntro}
                                    </section>

                                    <section>
                                        <h3 className="flex items-center gap-2 text-xl font-bold text-white mb-6 border-b border-shield-border border-dashed pb-3">
                                            <Code2 className="h-5 w-5 text-[#1DA1F2]" />
                                            On-Chain Execution
                                        </h3>
                                        <div className="bg-shield-bg/60 rounded-2xl p-6 border border-shield-border/40">
                                            {activeContent.technicalDetails}
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="flex items-center gap-2 text-xl font-bold text-white mb-6 border-b border-shield-border border-dashed pb-3">
                                            <ExternalLink className="h-5 w-5 text-shield-success" />
                                            Official Documentation
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {activeContent.resources.map((resource, idx) => (
                                                <a
                                                    key={idx}
                                                    href={resource.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group flex flex-col justify-center p-4 rounded-xl border border-shield-border bg-shield-card hover:bg-shield-border/30 hover:border-shield-success/40 transition-all duration-200"
                                                >
                                                    <div className="flex items-center justify-between line-clamp-1">
                                                        <span className="font-semibold text-shield-text group-hover:text-shield-success transition-colors truncate pr-4">
                                                            {resource.label}
                                                        </span>
                                                        <ExternalLink className="h-4 w-4 text-shield-muted group-hover:text-shield-success flex-shrink-0" />
                                                    </div>
                                                    <span className="text-xs text-shield-muted mt-1 truncate">
                                                        {new URL(resource.url).hostname}
                                                    </span>
                                                </a>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </PageWrapper>
    );
}
