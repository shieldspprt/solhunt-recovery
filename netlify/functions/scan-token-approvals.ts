// netlify/functions/scan-token-approvals.ts
// Scans a Solana wallet for token approvals/delegations (dApps with spending rights)
// Returns: list of delegations with risk scores

import { Handler } from '@netlify/functions';
import { Connection, PublicKey } from '@solana/web3.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// Known safe delegates (protocols that are generally trustworthy)
const KNOWN_DELEGATES = new Set([
  // DEX / AMM
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoiQ6BUdfdS4', // Jupiter
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // Raydium
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', // Meteora
  'SSwpkEEcbUqx4vtoEByFjZenhFkMExbcVTQ9pPb54h8', // Marinade
  // Staking
  'MarBmsSgKXdrM1JAEYQdKpxQ1J1mxih9w5LExV6ZF1P', // Marinade stake
  // Bridges
  'wormDTUJ6AWPNvk59vGQbGHCyyYWXvtTzCZ3xL4U2Gz', // Wormhole
]);

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface TokenApproval {
  tokenAccountAddress: string;
  mint: string;
  delegate: string;
  delegatedAmount: string;
  ownerBalance: number;
  decimals: number;
  tokenSymbol: string;
  programId: string;
  riskLevel: RiskLevel;
  isKnownDelegate: boolean;
}

interface ApprovalScanResult {
  walletAddress: string;
  totalApprovals: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalExposedValueUSD: number; // estimated
  approvals: TokenApproval[];
  scannedAt: string;
  recommendation: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// ── Risk Assessment ──────────────────────────────────────────────────────────

function assessRisk(
  delegate: string,
  delegatedAmount: string,
  ownerBalance: number,
  isKnownDelegate: boolean
): RiskLevel {
  // High risk: unknown delegate with unlimited or large approval
  if (!isKnownDelegate) {
    const amount = BigInt(delegatedAmount);
    // u64::MAX or very large numbers indicate unlimited approval
    if (amount > BigInt('18446744073709551615') / BigInt(100) || // > 1% of max u64
        (ownerBalance > 0 && amount > BigInt(Math.floor(ownerBalance * 0.9)))) {
      return 'HIGH';
    }
    return 'MEDIUM';
  }
  
  // Known delegates are generally low risk
  return 'LOW';
}

// ── Main handler ──────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  const address = event.queryStringParameters?.address?.trim();

  if (!address) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Missing address parameter' })
    };
  }

  if (!isValidSolanaAddress(address)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Invalid Solana wallet address'
      })
    };
  }

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const pubkey = new PublicKey(address);

    // Fetch token accounts from both Token and Token-2022 programs
    const [tokenAccounts, token2022Accounts] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(
        pubkey,
        { programId: new PublicKey(TOKEN_PROGRAM_ID) },
        'confirmed'
      ).catch(() => ({ value: [] })),
      connection.getParsedTokenAccountsByOwner(
        pubkey,
        { programId: new PublicKey(TOKEN_2022_PROGRAM_ID) },
        'confirmed'
      ).catch(() => ({ value: [] }))
    ]);

    const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];
    
    const approvals: TokenApproval[] = [];
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;
    let totalExposedValue = 0;

    for (const { pubkey: accountPubkey, account } of allAccounts) {
      const parsed = account.data.parsed;
      const info = parsed?.info;
      
      if (!info) continue;

      // Check if there's a delegate
      const delegate = info.delegate;
      if (!delegate) continue; // No approval set

      const delegatedAmount = info.delegatedAmount?.amount ?? '0';
      const uiAmount = info.tokenAmount?.uiAmount ?? 0;
      const decimals = info.tokenAmount?.decimals ?? 0;
      const mint = info.mint;
      
      // Skip if delegation is effectively zero
      if (delegatedAmount === '0') continue;

      const isKnownDelegate = KNOWN_DELEGATES.has(delegate);
      const riskLevel = assessRisk(delegate, delegatedAmount, uiAmount, isKnownDelegate);
      
      // Count by risk level
      if (riskLevel === 'HIGH') highRiskCount++;
      else if (riskLevel === 'MEDIUM') mediumRiskCount++;
      else lowRiskCount++;

      // Estimate exposed value (very rough approximation)
      if (uiAmount > 0) {
        totalExposedValue += uiAmount;
      }

      approvals.push({
        tokenAccountAddress: accountPubkey.toBase58(),
        mint,
        delegate,
        delegatedAmount,
        ownerBalance: uiAmount,
        decimals,
        tokenSymbol: 'UNKNOWN', // Would need token metadata lookup
        programId: parsed.type === 'token' ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID,
        riskLevel,
        isKnownDelegate
      });
    }

    // Sort by risk level: HIGH first, then MEDIUM, then LOW
    approvals.sort((a, b) => {
      const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });

    // Generate recommendation
    let recommendation = 'Your wallet is secure. No token approvals found.';
    if (approvals.length > 0) {
      if (highRiskCount > 0) {
        recommendation = `URGENT: ${highRiskCount} high-risk approval(s) found. Unknown dApps have unlimited spending rights. Revoke immediately.`;
      } else if (mediumRiskCount > 0) {
        recommendation = `CAUTION: ${mediumRiskCount} medium-risk approval(s). Review and revoke unnecessary permissions.`;
      } else {
        recommendation = `GOOD: ${lowRiskCount} low-risk approval(s) to known protocols. Monitor periodically.`;
      }
    }

    const result: ApprovalScanResult = {
      walletAddress: address,
      totalApprovals: approvals.length,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      totalExposedValueUSD: totalExposedValue, // Note: rough estimate
      approvals,
      scannedAt: new Date().toISOString(),
      recommendation
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result
      })
    };

  } catch (error: any) {
    console.error('scan-token-approvals error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Scan failed. RPC may be rate limited. Try again shortly.'
      })
    };
  }
};
