import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Shield, FileCode, Cpu, Server, Sparkles, AlertTriangle, Code2, Search, TrendingUp } from 'lucide-react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ENGINE_METADATA } from '@/config/constants';
import { usePageMeta } from '@/hooks/usePageMeta';

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
                icon: <Server className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
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
                icon: <Code2 className="h-5 w-5 text-shield-success" aria-hidden="true" />,
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
                icon: <Shield className="h-5 w-5 text-shield-warning" aria-hidden="true" />,
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
                icon: <Cpu className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Every account on Solana costs rent to store data. Token accounts, stake accounts, and program accounts must each hold a minimum rent deposit (~0.002 SOL per account) to keep the account alive on-chain.
                        </p>
                        <p>
                            When an account's balance reaches exactly zero, Solana automatically removes the account and returns its rent deposit. However, if a token account holds even 1 lamport (0.000000001 SOL), the account is immortal — you cannot close it until the balance is exactly zero.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Fractional Dust Problem',
                icon: <Sparkles className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            DEX trades often leave fractional dust (e.g., 0.000001 USDC) due to rounding. This is enough rent to keep your token account alive, holding ~0.002 SOL hostage.
                        </p>
                        <p>
                            By querying Jupiter for a swap quote and appending it to a closing transaction, SolHunt converts your dust to SOL before closing the account — letting you recover the full rent deposit.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'How It Works',
                icon: <FileCode className="h-5 w-5 text-shield-success" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            <strong>Step 1:</strong> Scan token accounts. Identify tokens with balances below typical value thresholds.
                        </p>
                        <p>
                            <strong>Step 2:</strong> For swappable dust: request a Jupiter swap quote for exact-out SOL. Append the swap instruction to the transaction.
                        </p>
                        <p>
                            <strong>Step 3:</strong> Append a <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">CloseAccount</code> instruction — SolanaCloseAccount program.
                        </p>
                        <p>
                            <strong>Step 4:</strong> Sign and submit. Rent exits the program account and returns to your wallet.
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
                icon: <Sparkles className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
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
                icon: <Server className="h-5 w-5 text-shield-success" aria-hidden="true" />,
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
                heading: 'Option 2: Burning via SPL Burn',
                icon: <AlertTriangle className="h-5 w-5 text-shield-warning" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            For deprecated tokens with no liquidity, we use the SPL Token <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">Burn</code> instruction to burn the entire supply. Burning reduces the total supply to zero and frees your wallet of the clutter. Note: after burning, the token account will still hold 1 lamport — you must separately recover rent from it.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'How to configure thresholds',
                icon: <FileCode className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            All thresholds are configurable via the Settings panel and persist across sessions. If you want to ignore a token entirely, use the checkbox to exclude it from future sweep scans.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '4': {
        title: 'LP Fee Harvester',
        subtitle: 'Harvest unclaimed LP fees from Raydium, Orca, and Meteora liquidity pools.',
        sections: [
            {
                heading: 'How LP Fees Accumulate',
                icon: <Sparkles className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            When you provide liquidity to a DEX pool, you earn a proportional share of trading fees. But if you withdraw your liquidity and forget to claim your uncollected fees before removal—the fees stay in the pool, and your LP token is burned.
                        </p>
                        <p>
                            SolHunt finds LP positions where you still have claimable fees and constructs the claim instructions for your wallet to sign, enabling you to harvest every last token of value.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Supported Protocols',
                icon: <Server className="h-5 w-5 text-shield-success" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            <strong>Raydium:</strong> Checks each liquidity pool for unclaimed fee rewards attributable to your LP token. If the farm is still active, it harvests and sends you your cut.
                        </p>
                        <p>
                            <strong>Orca:</strong> Similar flow — finds whirlpools where you have LP tokens and claim forms for your accrued (but unclaimed) fees.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '5': {
        title: 'Buffer Recovery',
        subtitle: 'Recover SOL from Solana program buffer accounts left behind by failed deployments.',
        sections: [
            {
                heading: 'What is a Buffer Account?',
                icon: <Server className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Solana programs are huge binaries. The CLI uploads them in fragments called <em>buffer accounts</em>, each costing rent proportional to their size (often 1–50+ SOL for large programs).
                        </p>
                        <p>
                            If <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">solana program deploy</code> times out or fails, the buffer account is orphaned with its enormous rent deposit locked inside.
                        </p>
                        <p>
                            Thousands of developers and AI agents have unintentionally locked massive capital in these abandoned fragments.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'How SolHunt Finds Them',
                icon: <Search className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Enter any program ID and SolHunt scans all buffer accounts that have ever been authored by that program. We check their current balance and determine if you are the authority.
                        </p>
                        <p>
                            If the buffer has no attached program and you control the authority key, SolHunt constructs a <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs"> RecoverBufferAccount </code> instruction so you can reclaim the entire rent deposit.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'How It Works',
                icon: <FileCode className="h-5 w-5 text-shield-success" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            <strong>Step 1:</strong> Enter the program ID you deployed. SolHunt lists all buffer accounts it can find — including ones whose program binary was already deployed or replaced.
                        </p>
                        <p>
                            <strong>Step 2:</strong> SolHunt pulls the raw account data from Solana RPC and checks the <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">buf.configh authority</code> field using a getProgramAccount call with a buffer-account filter.
                        </p>
                        <p>
                            <strong>Step 3:</strong> If your wallet matches the authority, we build the recovery transaction and open your wallet for signing.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '7': {
        title: 'MEV Blocker',
        subtitle: 'Protect your Solana transactions from sandwich attacks and front-running.',
        sections: [
            {
                heading: 'What is MEV?',
                icon: <AlertTriangle className="h-5 w-5 text-shield-warning" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            MEV — Maximal Extractable Value — is the profit a block builder extracts by reordering or inserting transactions around yours. On Solana, prefix auctions (submitting transactions with the same recent blockhash) let validators and block builders extract priority fees from traders.
                        </p>
                        <p>
                            Sandwich attacks reorder your trade to front-run it (raising your price) and back-run it (profiting at your expense). On Solana these are visible in the transaction supply and can be detected.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Priority Fee Optimizer',
                icon: <TrendingUp className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Solana allows priority fees on transactions. Setting too low means your transaction waits. Setting too high means you overpay. SolHunt monitors current network conditions and recommends dynamic priority fee ranges so you always pay the minimum needed to get included.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '9': {
        title: 'cNFT Cleaner',
        subtitle: 'Remove compression NFT accounts holding your wallet hostage on Solana.',
        sections: [
            {
                heading: 'Compression NFT Basics',
                icon: <Cpu className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            cNFTs use Solana's state compression to store thousands of NFTs in a single ledger account. Each tree (the on-chain merkle tree structure) holds the data for many NFTs and costs a minimum rent deposit per tree.
                        </p>
                        <p>
                            When you mint a compression NFT, a <em>Concurrent Merkle Tree</em> is created and the state updates are recorded in the correct顺序 (correct sequence). Each delegated delegate permission to a cNFT tree is stored as a separate account and costs rent.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'What Can Be Delegated',
                icon: <Shield className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            cNFT permissions work at the tree level or globally. Permissions can be granted to allow a specific account to mint, transfer, or burn compressed NFTs from your collection. These are stored as Bubblegum program accounts, and you can revoke them with SolHunt.
                        </p>
                    </div>
                ),
            }
        ]
    },
    '10': {
        title: 'Decommission Scanner',
        subtitle: 'Find validator accounts in wind-down or decommission announcements.',
        sections: [
            {
                heading: 'What is Validator Decommission?',
                icon: <AlertTriangle className="h-5 w-5 text-shield-warning" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            When a Solana validator is winding down, it announces this via on-chain voting. Delegators who don't deactivate before the validator is decommissioned may experience loss of vote account credits during the wind-down period, resulting in a penalty.
                        </p>
                    </div>
                ),
            },
            {
                heading: 'Finding Decommissioned Validators',
                icon: <Search className="h-5 w-5 text-shield-accent" aria-hidden="true" />,
                content: (
                    <div className="space-y-4">
                        <p>
                            Using Solana RPC and the Validator Information API, the Decommission Scanner identifies validators advertising a wind-down via their validator IP address. This lets you quickly find and reassign your stake before the decommission effects your staking rewards.
                        </p>
                    </div>
                ),
            }
        ]
    }
};

export function EngineHowItWorksPage() {
    const { id } = useParams<{ id: string }>();

    // Compute the title and description based on the route param. Memoize so
    // the effect re-runs only when `id` changes, not on every render.
    const metaTitle = id
        ? (ENGINE_DETAILS_MAP[id]?.title ?? ENGINE_METADATA.find(e => e.id.toString() === id)?.name ?? 'How It Works')
        : 'How It Works';

    const metaDescription = (() => {
        if (!id) return 'Learn how SolHunt recovery engines work — revoke approvals, reclaim rent, sweep dust, harvest LP fees, recover staking tickets, and more — all client-side.';
        const details = ENGINE_DETAILS_MAP[id];
        if (details) {
            return `${details.subtitle} ${details.sections.map((section: { heading: string }) => section.heading).join(', ')}.`;
        }
        const engineInfo = ENGINE_METADATA.find(e => e.id.toString() === id);
        return engineInfo?.description ?? 'Learn how SolHunt recovery engines work — revoke approvals, reclaim rent, sweep dust, harvest LP fees, recover staking tickets, and more — all client-side.';
    })();

    // Prevent search engines from indexing informational pages
    usePageMeta({
        title: metaTitle,
        description: metaDescription,
        noindex: true,
    }, [id]);

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
                    aria-label="Back to dashboard"
                    className="inline-flex items-center gap-2 text-sm text-shield-muted hover:text-shield-text transition-colors mb-8"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
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
                            aria-label="Contact SolHunt on X (Twitter) (opens in new tab)"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DA1F2] px-6 py-2.5 font-semibold text-white shadow-lg shadow-[#1DA1F2]/20 hover:bg-[#1A91DA] transition-all hover:-translate-y-0.5 text-sm"
                        >
                            Message @solhuntdev
                        </a>
                        {engineInfo && (
                            <Link
                                to={engineInfo.route}
                                aria-label={`Back to ${engineInfo.name} tool`}
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
