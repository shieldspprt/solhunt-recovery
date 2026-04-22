import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Shield, FileCode, CheckCircle2, Lock, Cpu, Server, Sparkles, AlertTriangle, Code2 } from 'lucide-react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ENGINE_METADATA } from '@/config/constants';
import React, { useEffect } from 'react';

interface EngineDetails {
    title: string;
    subtitle: string;
    sections: {
        heading: string;
        content: React.ReactNode;
        icon: React.ReactNode;
    }[];
}

const ENGINE_DETAILS_MAP: Record<string, EngineDetails> = {
    '1': {
        title: 'Revoke Permissions',
        subtitle: 'How we safely remove token delegates using SPL Revoke instructions.',
        sections: [
            {
                heading: 'The Problem: Token Delegation',
                icon: <Server className="h-5 w-5 text-shield-accent" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            When you interact with a decentralized application (dApp) on Solana—such as placing a limit order, lending tokens, or using a smart contract—you often must grant the program "delegate authority" over your token account via the SPL Token Program's <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">Approve</code> instruction.
                        </p>
                        <p>
                            This allows the dApp to move tokens mathematically up to a specified maximum. However, if the dApp is ever compromised, or if you connected to a malicious phishing site disguised as a real dApp, this delegate authority can be exploited to drain your wallet.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'The Solution: The Revoke Instruction',
                icon: <Code2 className="h-5 w-5 text-shield-success" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            SolHunt queries your wallet via your RPC endpoint to find all token accounts that have an active <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">delegate_option</code> set to <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">1</code>.
                        </p>
                        <p>
                            To remove these permissions, we build a transaction solely containing the native SPL Token <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">Revoke</code> instruction for each delegated account.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Safety Guarantees',
                icon: <Shield className="h-5 w-5 text-shield-warning" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            The generated transaction only contains <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">Revoke</code> instructions. You are <strong>never</strong> signing a transfer, approve, or close instruction in Engine 1. Your wallet remains in complete control and this operates 100% client-side.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '2': {
        title: 'Reclaim Rent',
        subtitle: 'How we close empty token accounts to recover locked SOL.',
        sections: [
            {
                heading: 'Solana State Rent',
                icon: <Cpu className="h-5 w-5 text-shield-accent" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Solana requires validators to allocate hardware memory to host state (accounts, tokens, programs). This requires a deposit of SOL known as "Rent Exemption" (~0.002 SOL per token account). When you trade on a DEX, a token account is initialized. When you sell the token, your balance hits 0, but the account stays active, permanently locking your ~0.002 SOL.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Execution: CloseAccount',
                icon: <Code2 className="h-5 w-5 text-shield-success" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            SolHunt filters your <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">getTokenAccountsByOwner</code> RPC response for accounts holding exactly 0 tokens.
                        </p>
                        <p>
                            We build a transaction containing the SPL Token <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">CloseAccount</code> instruction. This native instruction deletes the account from the state array and explicitly maps the returned SOL deposit directly to your wallet's main address.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Safety Controls',
                icon: <Lock className="h-5 w-5 text-shield-warning" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            The Solana protocol <strong>will automatically fail the transaction</strong> if we attempt to use <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">CloseAccount</code> on an account that has a token balance greater than 0. This provides protocol-level certainty that you cannot accidentally "burn" non-empty accounts.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '3': {
        title: 'Sweep Dust',
        subtitle: 'How we leverage Jupiter Aggregator and SPL Burn to clear unwanted tokens.',
        sections: [
            {
                heading: 'Fractional Dust Accumulation',
                icon: <Sparkles className="h-5 w-5 text-shield-accent" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Trading on DEXs often leaves fractional dust (e.g., 0.000001 USDC) due to slippage and math rounding. This dust clutters your wallet and holds your ~0.002 SOL rent deposit hostage, since you cannot close an account until the balance is exactly 0.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Option 1: Swapping to SOL',
                icon: <Server className="h-5 w-5 text-shield-success" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            For tokens that still have liquidity, SolHunt queries the <strong>Jupiter V6 API</strong>. We request an exact-out route to swap your remaining dust balance into SOL. We use the official API to serialize the exact swap instruction and append it to a transaction for your wallet to sign.
                        </p>
                        <p>
                            You only sign the swap parameters presented in the UI modal.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Option 2: Burn & Close',
                icon: <AlertTriangle className="h-5 w-5 text-shield-warning" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            If a token has no liquidity (rug pulls, spam NFTs), you cannot swap it. SolHunt allows you to explicitly build a transaction combining two instructions:
                            <br /><br />
                            1. SPL Token <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">Burn</code>: Destroys the token supply in your wallet forever.
                            <br />
                            2. SPL Token <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">CloseAccount</code>: Once the balance is 0, recovers your locked 0.002 SOL rent.
                        </p>
                        <p className="text-shield-warning font-semibold text-xs mt-2 uppercase tracking-wide">Warning: Burn is permanent and cannot be undone.</p>
                    </div>
                ),
            }
        ]
    },
    '4': {
        title: 'Claim Stakes',
        subtitle: 'How we parse and execute cross-program claims for Sanctum and Marinade.',
        sections: [
            {
                heading: 'Delayed Unstaking Mechanisms',
                icon: <Server className="h-5 w-5 text-shield-accent" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            When you delayed-unstake LSTs (like mSOL or JitoSOL) mathematically instead of swapping them in a liquidity pool, protocols create a "Stake Account" or "Ticket" tied to your wallet address. These tickets mature after an epoch boundary (~54 hours). Once matured, manual claim instructions must be sent to the protocol smart contract to release the SOL back to your main wallet.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'On-Chain Execution Data',
                icon: <Code2 className="h-5 w-5 text-shield-success" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            SolHunt queries the Marinade State and Sanctum APIs to discover tickets matching your wallet address.
                        </p>
                        <p>
                            Instead of simple native transfers, the transactions generated by this engine are cross-program target calls. For example, Marinade requires a specific 8-byte instruction discriminator: <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">[62, 198, 214, 193, 213, 159, 108, 210]</code> to trigger the <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">Claim</code> method.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Strict Trust Limits',
                icon: <Shield className="h-5 w-5 text-shield-warning" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            SolHunt reads the exact contract addresses required and constructs these specialized contract calls from scratch entirely in your browser window. You grant no persistent authorities when redeeming your tickets.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '5': {
        title: 'Harvest LP Fees',
        subtitle: 'How we read and isolate unclaimed yields from major DEXs.',
        sections: [
            {
                heading: 'The Mechanics of AMM Yield',
                icon: <Cpu className="h-5 w-5 text-shield-accent" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            When you provide liquidity on Concentrated Liquidity Market Makers (CLMMs) like Raydium or Orca Whirlpools, trading fees accumulate inside specific reward accounts associated with your position NFTs. Often, these yields sit unclaimed because claiming them requires interfacing with complex smart contracts.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Extracting Yield Without Principal Risk',
                icon: <Code2 className="h-5 w-5 text-shield-success" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            SolHunt uses the official SDKs (e.g. <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">@raydium-io/raydium-sdk-v2</code>) to query your specific position accounts based on the NFTs in your wallet.
                        </p>
                        <p>
                            The transactions generated by this engine **only** include <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">harvest</code> or <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">collectFees</code> instructions targeted at your specific LP accounts.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Mathematical Isolation',
                icon: <Shield className="h-5 w-5 text-shield-warning" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Because the transactions explicitly omit any <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">withdraw</code> or <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">decreaseLiquidity</code> protocol instructions, it is mathematically impossible for the signed transaction to remove your base liquidity from the pool.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '7': {
        title: 'MEV & Priority Fees',
        subtitle: 'How we parse Merkle Roots to claim Jito block space tips.',
        sections: [
            {
                heading: 'The Jito Tip Distribution Protocol',
                icon: <Server className="h-5 w-5 text-shield-accent" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Jito validates Solana blocks by collecting out-of-band "tips" (MEV) to order transactions. These tips are held by the Tip Distribution Program (<code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">4R3gSG...vrR</code>). Periodically, Jito uploads a Merkle root to the blockchain representing exactly how much SOL every validator delegator is owed for their staked share footprint.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Proof Extraction and Verification',
                icon: <Code2 className="h-5 w-5 text-shield-success" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            To claim these rewards, users must submit cryptographic inclusion proofs. SolHunt queries the <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">kobe.mainnet.jito.network</code> API to extract your wallet's specific Merkle proofs for the active epochs.
                        </p>
                        <p>
                            We then map these proofs into raw Jito Claim instructions and serialize them to your browser's Wallet Adapter for signature.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Execution Safety',
                icon: <CheckCircle2 className="h-5 w-5 text-shield-warning" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Claiming MEV has absolutely no impact on your underlying staked SOL principal. The smart contract invocation purely instructs the off-chain Jito treasury to disburse your uncollected yields.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '9': {
        title: 'Dead Protocol Rescue',
        subtitle: 'How we salvage liquidity from decommissioned and abandoned DeFi protocols.',
        sections: [
            {
                heading: 'The Problem: Abandoned Protocols',
                icon: <Server className="h-5 w-5 text-shield-accent" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            DeFi protocols frequently sunset, migrate, or shut down completely (e.g., Friktion, Saber AMMs). When this happens, custom user interfaces are taken offline, making it extremely difficult for non-technical users to withdraw their supplied liquidity or bonded tokens.
                        </p>
                        <p>
                            However, the underlying smart contracts and asset vaults remain permanent on the Solana blockchain.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'On-Chain Discovery & Valuation',
                icon: <Sparkles className="h-5 w-5 text-shield-success" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            SolHunt maintains a dynamically updated, open-source registry of known defunct program IDs, vault public keys, and LP token mints.
                        </p>
                        <p>
                            When you scan your wallet, we cross-reference your token accounts against this registry. We then use real-time price feeds to appraise the underlying vault assets backing your otherwise illiquid receipt tokens.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Execution: Direct Contract Withdrawals',
                icon: <Code2 className="h-5 w-5 text-shield-warning" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Instead of relying on web interfaces that no longer exist, SolHunt generates the exact protocol-specific withdrawal instructions (derived directly from the program's original Anchor IDL).
                        </p>
                        <p>
                            You sign the transaction natively through your wallet to interact directly with the decommissioned smart contract, safely unwinding your LP tokens and returning the underlying assets to your wallet.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '10': {
        title: 'Recover Program Buffers',
        subtitle: 'How we use the Upgradable BPF Loader to salvage failed deployment SOL.',
        sections: [
            {
                heading: 'Failed Solana Deployments',
                icon: <Cpu className="h-5 w-5 text-shield-accent" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            When developers deploy a Rust program to Solana using <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">solana program deploy</code>, the network first writes the binary into a temporary Buffer Account. Because binaries are large, this Buffer Account absorbs 1–50 SOL in rent exemption.
                        </p>
                        <p>
                            If the deployment fails, crashes, or is aborted, that Buffer Account is abandoned. The SOL deposit remains trapped in the BPF Loader.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'The Rescue Instruction',
                icon: <Code2 className="h-5 w-5 text-shield-success" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            SolHunt queries the <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">BPFLoaderUpgradeab1e11111111111111111111111</code> program matching your wallet as the authorized deployer key.
                        </p>
                        <p>
                            We then construct transactions containing the native <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">BPF Close</code> instruction, which destroys the orphaned buffer bytecode and forces the Solana protocol to return the SOL balance directly to your Deployer Authority address.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Developer-Grade Transparency',
                icon: <Shield className="h-5 w-5 text-shield-warning" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            You maintain total control. We do not require you to input private keys into a CLI to recover these buffers. You sign the exact BPF Close instructions through your hardware or browser wallet extension natively.
                        </p>
                    </div>
                ),
            }
        ]
    }
};

export function EngineHowItWorksPage() {
    const { id } = useParams<{ id: string }>();

    useEffect(() => {
        document.title = 'How It Works | SolHunt';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'Learn how SolHunt recovery engines work — revoke approvals, reclaim rent, sweep dust, harvest LP fees, recover staking tickets, and more — all client-side.');
    }, []);

    // Route validation
    if (!id || !ENGINE_DETAILS_MAP[id]) {
        return <Navigate to="/404" replace />;
    }

    const engineInfo = ENGINE_METADATA.find(e => e.id.toString() === id);
    const details = ENGINE_DETAILS_MAP[id];

    return (
        <PageWrapper>
            <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm text-shield-muted hover:text-shield-text transition-colors mb-8"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </Link>

                <div className="mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shield-accent/10 border border-shield-accent/20 text-shield-accent text-xs font-semibold mb-4 uppercase tracking-wider">
                        <FileCode className="h-3.5 w-3.5" />
                        Technical Breakdown
                    </div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 text-shield-text">
                        {details.title}
                    </h1>
                    <p className="text-lg text-shield-muted max-w-2xl">
                        {details.subtitle}
                    </p>
                </div>

                <div className="space-y-8 mb-12">
                    {details.sections.map((section, idx) => (
                        <section key={idx} className="glass-card rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start border border-shield-border/50">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-shield-bg border border-shield-border/60 shadow-sm mt-1">
                                {section.icon}
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-shield-text mb-4">
                                    {section.heading}
                                </h2>
                                <div className="text-shield-muted text-sm sm:text-base">
                                    {section.content}
                                </div>
                            </div>
                        </section>
                    ))}
                </div>

                <section className="rounded-3xl border border-shield-border bg-shield-bg/50 p-6 sm:p-8 text-center mt-12 mb-4">
                    <h2 className="text-xl font-bold text-shield-text mb-3">Still have questions?</h2>
                    <p className="text-shield-muted text-sm sm:text-base max-w-xl mx-auto mb-6">
                        We build this tooling transparently so researchers and retail users alike can operate safely. Reach out to our technical team for a deeper discussion.
                    </p>
                    <div className="flex justify-center gap-4">
                        <a
                            href="https://twitter.com/solhuntdev"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DA1F2] px-6 py-2.5 font-semibold text-white shadow-lg shadow-[#1DA1F2]/20 hover:bg-[#1A91DA] transition-all hover:-translate-y-0.5 text-sm"
                        >
                            Message @solhuntdev
                        </a>
                        {engineInfo && (
                            <Link
                                to={engineInfo.route}
                                className="inline-flex items-center justify-center gap-2 flex-1 rounded-xl border border-shield-border/80 bg-shield-card px-4 py-2.5 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors sm:flex-none text-sm"
                            >
                                Back to {engineInfo.name}
                            </Link>
                        )}
                    </div>
                </section>
            </div>
        </PageWrapper>
    );
}
