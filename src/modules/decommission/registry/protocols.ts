import { DeadProtocol } from '../types';
import { SABER_AMM_PROGRAM, FRIKTION_PROGRAM, ATRIX_PROGRAM, JET_PROGRAM } from '../constants';

export const DEAD_PROTOCOLS: DeadProtocol[] = [
    {
        id: 'saber_amm',
        name: 'Saber AMM',
        logoUri: '/logos/saber.png', // Or use an external URL if assets aren't local
        programId: SABER_AMM_PROGRAM,
        decommissionStatus: 'ui_dead',
        isRecoverable: true,
        recoveryUrl: null,
        withdrawalMethod: {
            type: 'direct_program_call',
            instructions: ['remove_liquidity']
        },
        positionTokenMints: [
            {
                mint: '2poo1w1DL6yd2WNTCnNTzDqkC6MBXq7axo77P16yrBuf',
                symbol: 'USDC-USDT-LP',
                decimals: 6,
                positionType: 'lp_token',
                poolOrVaultAddress: '8P2h4L5qCvyhB14hYjH5zXzQv6G4h6eW8s1v5b3hL7yG', // placeholder pool
                underlyingTokenA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                underlyingTokenB: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT
            }
        ]
    },
    {
        id: 'friktion_volts',
        name: 'Friktion Volts',
        logoUri: '/logos/friktion.png',
        programId: FRIKTION_PROGRAM,
        decommissionStatus: 'ui_dead',
        isRecoverable: true,
        recoveryUrl: 'https://friktion.fi/recovery',
        withdrawalMethod: {
            type: 'redirect'
        },
        positionTokenMints: [
            {
                mint: 'cxxShYRVcepDudXhe7U62QHGN8XwzN6A24jG2R1jH4J',
                symbol: 'fcSOL Volt',
                decimals: 9,
                positionType: 'vault_share',
                underlyingTokenA: 'So11111111111111111111111111111111111111112'
            }
        ]
    },
    {
        id: 'atrix_pools',
        name: 'Atrix Protocol',
        logoUri: '/logos/atrix.png',
        programId: ATRIX_PROGRAM,
        decommissionStatus: 'partially_dead',
        isRecoverable: true,
        recoveryUrl: null,
        withdrawalMethod: {
            type: 'unknown'
        },
        positionTokenMints: [
            {
                mint: 'AtrixLp111111111111111111111111111111111111', // placeholder
                symbol: 'ALP Token',
                decimals: 6,
                positionType: 'lp_token'
            }
        ]
    },
    {
        id: 'jet_protocol',
        name: 'Jet Protocol',
        logoUri: '/logos/jet.png',
        programId: JET_PROGRAM,
        decommissionStatus: 'winding_down',
        isRecoverable: true,
        recoveryUrl: null,
        withdrawalMethod: {
            type: 'unknown' // Spec mentions Jet is winding down, might need manual check
        },
        positionTokenMints: [
            {
                mint: 'JetLp11111111111111111111111111111111111111', // placeholder
                symbol: 'Jet Deposit',
                decimals: 6,
                positionType: 'lending_receipt'
            }
        ]
    },
    {
        id: 'saber_governance',
        name: 'Saber Protocol (SBR)',
        logoUri: '/logos/saber.png',
        programId: 'sbr1111111111111111111111111111111111111111',
        decommissionStatus: 'fully_dead',
        isRecoverable: false,
        recoveryUrl: null,
        withdrawalMethod: {
            type: 'no_recovery'
        },
        positionTokenMints: [
            {
                mint: 'Saber2gLauYim4Mvftnrasomsv6NvAuncvMEZwcLpD1', // SBR token
                symbol: 'SBR',
                decimals: 6,
                positionType: 'governance'
            }
        ]
    }
];
