export type BufferStatus =
    | 'closeable'     // Authority is the connected wallet — safe to close
    | 'active'        // In use by a current deployment — DO NOT close
    | 'foreign'       // Authority is a different wallet — not ours
    | 'unknown';      // Cannot determine state

export interface BufferAccount {
    address: string;                  // Buffer account pubkey
    authorityAddress: string;         // Who can close this buffer
    dataLengthBytes: number;          // Size of bytecode stored
    lamports: number;                 // Total SOL locked (rent + buffer)
    recoverableSOL: number;           // What user gets back after fee
    loaderProgram: 'v2' | 'v3';       // BPFLoader2 or BPFLoaderUpgradeable
    status: BufferStatus;
    createdAt: number;                // Timestamp for recency heuristic
    label: string | null;             // Optional tag
}

export interface BufferScanResult {
    scannedAt: number;
    buffers: BufferAccount[];
    closeableBuffers: BufferAccount[];
    totalLockedSOL: number;
    totalRecoverableSOL: number;
}

export type BufferScanStatus =
    | 'idle'
    | 'scanning'
    | 'scan_complete'
    | 'error';

export type BufferCloseStatus =
    | 'idle'
    | 'awaiting_confirmation'
    | 'closing'
    | 'complete'
    | 'error';

export interface BufferCloseResult {
    success: boolean;
    closedCount: number;
    failedCount: number;
    reclaimedSOL: number;
    signatures: string[];
    errorMessage: string | null;
}

export interface BufferCloseEstimate {
    selectedCount: number;
    totalLamports: number;
    totalSOL: number;
    serviceFeeSOL: number;
    networkFeeSOL: number;
    userReceivesSOL: number;
}
