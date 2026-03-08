// BPF Loader v2 (legacy)
export const BPF_LOADER_V2 = 'BPFLoader2111111111111111111111111111111111';

// BPF Loader Upgradeable (current standard)
export const BPF_LOADER_UPGRADEABLE = 'BPFLoaderUpgradeab1e11111111111111111111111';

// Program Buffer Config
export const BUFFER_CLOSE_FEE_PERCENT = 10;
export const BUFFER_MIN_RECOVERY_FOR_FEE = 0.05; // SOL
export const MAX_BUFFERS_PER_TX = 3;             // Buffer closes are large txs

// Safety constants
export const RECENT_BUFFER_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
