import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
    DecommissionScanResult,
    DecommissionScanProgress,
    DecommissionPositionItem,
    DeadProtocol,
} from '../types';
import { DEAD_PROTOCOLS } from '../registry/protocols';
import { estimatePositionValue } from './positionValueEstimator';
import { withRetry } from '@/lib/rpcRetry';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function scanForDeadProtocolPositions(
    walletAddress: string,
    connection: Connection,
    onProgress: (progress: DecommissionScanProgress) => void
): Promise<DecommissionScanResult> {

    const walletPubkey = new PublicKey(walletAddress);

    // Get all token accounts
    const tokenAccounts = await withRetry(() => connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { programId: TOKEN_PROGRAM_ID }
    ));

    const activeProtocols = DEAD_PROTOCOLS.filter(p => !!p.positionTokenMints?.length);
    const items: DecommissionPositionItem[] = [];
    let foundCount = 0;

    for (let pIndex = 0; pIndex < activeProtocols.length; pIndex++) {
        const protocol = activeProtocols[pIndex];
        onProgress({
            currentProtocol: protocol.name,
            processed: pIndex + 1,
            total: activeProtocols.length,
        });

        const protocolMints = new Set(protocol.positionTokenMints.map(t => t.mint));
        const matchedAccounts = tokenAccounts.value.filter(acc => {
            const parsedInfo = acc.account.data.parsed?.info;
            const amount = parsedInfo?.tokenAmount?.uiAmount;
            return amount && amount > 0 && protocolMints.has(parsedInfo?.mint);
        });

        if (matchedAccounts.length === 0) continue;

        for (const acc of matchedAccounts) {
            const parsedInfo = acc.account.data.parsed.info;
            const mint = parsedInfo.mint;
            const tokenDef = protocol.positionTokenMints.find(t => t.mint === mint);
            if (!tokenDef) continue; // Should not happen

            const uiBalance = parsedInfo.tokenAmount.uiAmount || 0;
            const rawBalance = parsedInfo.tokenAmount.amount || '0';

            const valueEst = await estimatePositionValue(tokenDef, uiBalance, protocol, connection);
            const isWorthless = protocol.decommissionStatus === 'fully_dead';
            const recoveryMethod = isWorthless ? 'none' : resolveRecoveryMethod(protocol);

            const urgency = computeUrgency(protocol.decommissionStatus);
            const canRecover = recoveryMethod === 'in_app' || recoveryMethod === 'redirect';

            items.push({
                tokenAccountAddress: acc.pubkey.toString(),
                tokenDef,
                protocol,
                rawBalance,
                uiBalance,
                estimatedValueUSD: valueEst.estimatedValueUSD,
                canRecover,
                recoveryMethod,
                redirectUrl: protocol.recoveryUrl,
                urgency,
                isSelected: canRecover,
            });
            foundCount++;
        }

        await delay(100);
    }

    // Sort: winding_down first -> ui_dead recoverable -> redirect -> unknown -> none
    items.sort((a, b) => {
        const order = { critical: 0, high: 1, normal: 2, none: 3 };
        return order[a.urgency] - order[b.urgency];
    });

    const recoverableItems = items.filter(i => i.canRecover);
    const totalUSD = recoverableItems
        .filter(i => i.estimatedValueUSD !== null)
        .reduce((sum, i) => sum + (i.estimatedValueUSD ?? 0), 0);

    return {
        scannedAt: new Date(),
        walletAddress,
        protocolsChecked: activeProtocols.length,
        positionsFound: items.length,
        recoverableCount: recoverableItems.length,
        redirectCount: items.filter(i => i.recoveryMethod === 'redirect').length,
        unknownCount: items.filter(i => i.recoveryMethod === 'unknown').length,
        confirmedWorthless: items.filter(i => i.recoveryMethod === 'none').length,
        totalRecoverableUSD: totalUSD > 0 ? totalUSD : null,
        windingDownCount: items.filter(i => i.urgency === 'critical').length,
        items,
    };
}

function resolveRecoveryMethod(protocol: DeadProtocol): DecommissionPositionItem['recoveryMethod'] {
    const wm = protocol.withdrawalMethod.type;
    if (wm === 'direct_program_call') return 'in_app';
    if (wm === 'redirect') return 'redirect';
    if (wm === 'no_recovery') return 'none';
    return 'unknown';
}

function computeUrgency(status: DeadProtocol['decommissionStatus']): DecommissionPositionItem['urgency'] {
    if (status === 'winding_down') return 'critical';
    if (status === 'ui_dead') return 'high';
    if (status === 'partially_dead') return 'normal';
    return 'none';
}
