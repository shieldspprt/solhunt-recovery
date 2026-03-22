import { Handler } from '@netlify/functions';
import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RENT_PER_ACCOUNT_SOL = 0.00203928;
const MAX_ACCOUNTS_PER_TX = 15;
const FEE_PERCENT = 15;
const ESTIMATED_TX_COST_SOL = 0.000005; // 5000 lamports base fee, just an estimate
const FEE_WALLET = process.env.SOLHUNT_FEE_WALLET || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

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

  const wallet = event.queryStringParameters?.wallet?.trim();
  const maxAccountsStr = event.queryStringParameters?.max_accounts?.trim();
  const maxAccounts = maxAccountsStr ? parseInt(maxAccountsStr, 10) : 100;

  if (!wallet || !isValidSolanaAddress(wallet)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid or missing wallet address' })
    };
  }

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const pubkey = new PublicKey(wallet);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: new PublicKey(TOKEN_PROGRAM_ID) },
      'confirmed'
    );

    const closeable: string[] = [];

    for (const { pubkey: accountPubkey, account } of tokenAccounts.value) {
      const parsed = account.data.parsed;
      const amount = parsed?.info?.tokenAmount?.uiAmount ?? 0;
      const rawAmount = parsed?.info?.tokenAmount?.amount ?? '0';

      if (amount === 0 || rawAmount === '0') {
        closeable.push(accountPubkey.toBase58());
      }
    }

    // Limit by max_accounts
    const accountsToClose = closeable.slice(0, Math.min(closeable.length, maxAccounts));
    const numAccounts = accountsToClose.length;

    const grossRecoverableSol = numAccounts * RENT_PER_ACCOUNT_SOL;
    const solhuntFeeSol = grossRecoverableSol * (FEE_PERCENT / 100);
    const youReceiveSol = grossRecoverableSol - solhuntFeeSol;

    const batchesNeeded = Math.ceil(numAccounts / MAX_ACCOUNTS_PER_TX);
    const totalEstimatedTxCost = batchesNeeded * ESTIMATED_TX_COST_SOL;
    const netToYouSol = youReceiveSol - totalEstimatedTxCost;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        wallet: wallet,
        accounts_to_close: numAccounts,
        gross_recoverable_sol: parseFloat(grossRecoverableSol.toFixed(6)),
        solhunt_fee_sol: parseFloat(solhuntFeeSol.toFixed(6)),
        fee_percent: FEE_PERCENT,
        you_receive_sol: parseFloat(youReceiveSol.toFixed(6)),
        estimated_tx_cost_sol: parseFloat(totalEstimatedTxCost.toFixed(6)),
        net_to_you_sol: parseFloat(netToYouSol.toFixed(6)),
        batches_needed: batchesNeeded,
        fee_destination: FEE_WALLET,
        ready_to_execute: numAccounts > 0
      })
    };
  } catch (error: any) {
    console.error('preview-recovery error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to generate recovery preview. RPC may be rate limited.'
      })
    };
  }
};
