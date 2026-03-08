const { Connection, PublicKey } = require('@solana/web3.js');
require('dotenv').config();

async function main() {
    const connection = new Connection(process.env.VITE_RPC_URL || 'https://api.mainnet-beta.solana.com');

    // Saber Program
    const saberProgram = new PublicKey('SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ');
    console.log('Fetching Saber pools...');
    const saberAccounts = await connection.getProgramAccounts(saberProgram, {
        filters: [
            { dataSize: 395 } // SwapInfo size roughly, let's just get any and look at signatures
        ],
        limit: 5
    }).catch(() => []);
    console.log('Saber accounts found:', saberAccounts.length);

    // Friktion
    const friktionProgram = new PublicKey('VoLT1mJz1sbnxwq5Fv2SXjdVDgPXrb9tJyC8WpMDkSY');
    console.log('Fetching Friktion volts...');
    const friktionAccounts = await connection.getProgramAccounts(friktionProgram, {
        filters: [
            { dataSize: 673 } // approximate volt size, but let's just fetch all without filter and slice
        ]
    }).catch(() => []);
    console.log('Friktion Volts found:', friktionAccounts.length);
}

main().catch(console.error);
