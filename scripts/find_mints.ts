import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const connection = new Connection(process.env.VITE_RPC_URL || 'https://api.mainnet-beta.solana.com');

    try {
        const saberProgram = new PublicKey('SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ');
        const saberAccounts = await connection.getProgramAccounts(saberProgram, {
            dataSlice: { offset: 0, length: 150 },
            limit: 10
        });
        console.log(`Saber accounts: ${saberAccounts.length}`);
        saberAccounts.filter(a => a.account.data.length > 50).forEach((acc, i) => {
            // Pool mint is often at a specific offset. For Saber Swap, it's typically pool_mint.
            // The layout of Saber SwapInfo (395 bytes): 
            // is_initialized(1), nonce(1), initial_amp(8), target_amp(8), start_ramping_timestamp(8), stop_ramping_timestamp(8),
            // future_admin_deadline(8), future_admin_key(32), admin_key(32), token_a(32), token_b(32), pool_mint(32)...
            // 1+1+8+8+8+8+8+32+32+32+32 = 170.
            if (acc.account.data.length >= 202) {
                const poolMint = new PublicKey(acc.account.data.subarray(170, 202)).toString();
                console.log(`Saber Pool ${i} - Mint:`, poolMint);
            }
        });
    } catch (e) { console.error('Saber error:', e.message); }

    try {
        const friktionProgram = new PublicKey('VoLT1mJz1sbnxwq5Fv2SXjdVDgPXrb9tJyC8WpMDkSY');
        const friktionAccounts = await connection.getProgramAccounts(friktionProgram, {
            dataSlice: { offset: 0, length: 200 },
            filters: [{ dataSize: 673 }],
            limit: 5
        });
        console.log(`Friktion accounts: ${friktionAccounts.length}`);
        friktionAccounts.forEach((acc, i) => {
            // VoltVault is 673 bytes.
            // Let's just print a few public keys to see if one is fcUSD.
            // offset 64 is often vault mint or something. Let's print out 32-byte chunks.
            const chunk = acc.account.data;
            for (let j = 0; j + 32 <= chunk.length; j += 32) {
                const pk = new PublicKey(chunk.subarray(j, j + 32)).toString();
                if (pk !== '11111111111111111111111111111111') console.log(`  Friktion ${i} offset ${j}:`, pk);
            }
        });
    } catch (e) { console.error('Friktion error:', e.message); }

    try {
        const atrixProgram = new PublicKey('HvwYjjzPbXWpykgVZhqvvfeeSmZGZPvmCQAWyBMEZnEH');
        const atrixAccounts = await connection.getProgramAccounts(atrixProgram, {
            dataSlice: { offset: 0, length: 150 },
            limit: 5
        });
        console.log(`Atrix accounts: ${atrixAccounts.length}`);
    } catch (e) { console.error('Atrix error:', e.message); }
}

main();
