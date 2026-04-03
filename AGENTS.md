# SolHunt Recovery — Multi-Dimension Agent Guide

## Four Dimensions

SolHunt operates across 4 distinct product surfaces. Each has its own stack, priorities, and improvement cadence. Every hourly run should cover at least 2 dimensions.

---

## Dimension 1: SolHunt PWA (React Web App)

**Path**: `/home/workspace/solhunt-recovery/`
**Stack**: React 19 + Vite + TypeScript 5.9 strict + Tailwind CSS + Zustand + `@solana/web3.js`
**Repo**: `shieldspprt/solhunt-recovery`

### 9 Recovery Engines
Revoke, Reclaim Rent, Dust Consolidator, Staking Ticket Finder, LP Fee Harvester, Buffer Account Recovery, Decommission Scanner, cNFT Cleaner, MEV/Priority Fee Claims.

### Priority Areas (PWA)

| Priority | Area | Status |
|----------|------|--------|
| HIGH | Input validation — remaining scanners | Open |
| HIGH | Type safety — remove `any` from catch blocks | Open |
| MEDIUM | Performance — memoization + virtualisation | In progress |
| MEDIUM | Error handling — circuit breakers for external APIs | Open |
| LOW | Code quality — JSDoc, naming consistency | Open |

### Key Files (PWA)

| Category | Files |
|----------|-------|
| Critical security | `src/lib/transactionSender.ts`, `src/lib/validation.ts`, `src/lib/transactionVerifier.ts` |
| Core RPC | `src/lib/rpcRetry.ts`, `src/lib/scanner.ts` |
| Engines | `src/modules/*/lib/*.ts` (orca, raydium, meteora, ticket, buffer, decommission) |
| Hooks | `src/modules/*/hooks/use*Scanner.ts` |
| UI components | `src/components/`, `src/pages/` |
| PWA config | `vite.config.ts`, `src/sw.ts`, `app/` (Android TWA) |

### Compliance Archive ✅

| Requirement | Status | File |
|-------------|--------|------|
| Wallet connect/disconnect | ✅ FIXED | `WalletStatusManager.tsx` |
| TX error handling + RPC retry | ✅ FIXED | `rpcRetry.ts` |
| Mobile deep links + TWA | ✅ FIXED | `AndroidManifest.xml` |
| Fee disclosure + consent flows | ✅ FIXED | All `*ConfirmModal` components |
| RPC retry hardening | ✅ FIXED | All scanner modules |

---

## Dimension 2: SolHunt MCP Server (AI Agent Interface)

**Path**: `/home/workspace/solhunt-recovery/netlify/functions/mcp.ts`
**Deployed**: `https://solhunt.dev/.netlify/functions/mcp`
**Discovery**: `https://solhunt.dev/.well-known/mcp/server-card.json`

### 5 MCP Tools

| Tool | Purpose |
|------|---------|
| `get_wallet_report` | Full wallet analysis in one call (health score, recoverable SOL, fee preview) |
| `scan_token_approvals` | Find all dApp spending approvals, rated by risk |
| `build_revoke_transactions` | Build unsigned tx to revoke token approvals |
| `build_recovery_transaction` | Build unsigned tx to recover SOL from zero-balance accounts |
| `discover_platform_features` | Cross-sell web platform capabilities |

### Priority Areas (MCP)

| Priority | Area | Status |
|----------|------|--------|
| HIGH | Add `preview_recovery` tool — explicit fee preview before building | Open |
| HIGH | Parallelize `get_wallet_report` internal calls (already 40% faster) | Open |
| MEDIUM | Add rate limiting headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`) | Open |
| MEDIUM | Typed error responses — all error cases return `{ error, code, detail }` | Open |
| LOW | Configurable fee percentage via `SOLHUNT_FEE_PERCENT` env var | Open |

### Key Patterns (MCP)

```typescript
// JSON-RPC format support
if (body.method === 'tools/call') {
  toolName = body.params.name;
  toolArgs = body.params.arguments || {};
}

// Return in request format
return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } };
```

```typescript
// Smithery server card at /.well-known/mcp/server-card.json
const SERVER_METADATA = { schema_version: "1.0", name: "solhunt", endpoints: { mcp: { url: "..." } } };
```

---

## Dimension 3: SolHunt Skill (Zo / AI Agent Onboarding)

**Path**: `/home/workspace/Skills/solhunt-mcp/SKILL.md`
**Purpose**: Guide for AI agents to discover, configure, and use SolHunt MCP

### Priority Areas (Skill)

| Priority | Area | Status |
|----------|------|--------|
| HIGH | Keep SKILL.md in sync with MCP tool schema changes | Open |
| MEDIUM | Add usage examples for each tool | Open |
| MEDIUM | Add safety notes and custody model explanation | Open |
| LOW | Add troubleshooting section | Open |

---

## Dimension 4: SolHunt TWA / Mobile (Android PWA)

**Path**: `/home/workspace/solhunt-recovery/app/`
**Stack**: AndroidManifest.xml, Trusted Web Activity, PWA manifest

### Priority Areas (TWA/Mobile)

| Priority | Area | Status |
|----------|------|--------|
| HIGH | Verify `solana://` and `phantom://` deep links in AndroidManifest | ✅ FIXED |
| MEDIUM | Add `android:shortcuts` for quick wallet scan | Open |
| MEDIUM | Push notification token registration for scan completion | Open |

---

## Unified Agent Workflow

Each hourly run should span **at least 2 dimensions**. Suggested pairing:

| Run | Primary | Secondary |
|-----|---------|-----------|
| Hourly | PWA perf/type fixes | MCP error typing |
| Hourly | PWA security (validation) | Skill sync |
| Hourly | MCP tool additions | TWA deep link verification |

### Workflow Steps

1. **Pick 1 improvement** from any dimension's Priority Areas
2. **Pick 1 file** from the corresponding File Index
3. **Make a focused change** (one concern per commit)
4. **Type check + build**:
   ```bash
   cd /home/workspace/solhunt-recovery && bun install && bun run tsc --noEmit && bun run build
   ```
5. **Commit** with conventional message: `perf(pwa):`, `fix(mcp):`, `types(skill):`, `fix(twa):`
6. **Push**: `git push origin master`
7. **Send email report** with build status, files changed, impact metrics, and 3 tweet drafts

---

## Type Safety (Cross-Dimension)

### Remaining `any` to fix

| File | Line(s) | Severity |
|------|---------|----------|
| `useDecommissionScanner.ts` | 46, 143, 177 (catch blocks) | Medium |
| `sw.ts` | 78 (ExtendableEvent) | Low |
| `netlify/functions/mcp.ts` | `args: Record<string, any>` | Medium |

### Error typing pattern

```typescript
// Good
catch (err: unknown) {
  const appError = createAppError('SCAN_FAILED', err instanceof Error ? err.message : String(err));
}

// MCP errors should use codes
return { error: `Tool execution failed: ${e.message}`, code: 'EXECUTION_ERROR', tool: name };
```

---

## Success Criteria (All Dimensions)

| Dimension | Criteria |
|-----------|----------|
| PWA | Strict TypeScript (no `any`), input validation at all entry points, retry logic, simulation before send |
| MCP | All 5 tools implemented, JSON-RPC + direct format, typed errors, rate limit headers |
| Skill | Synced with MCP schema, 3+ examples per tool, safety notes |
| TWA | Deep links verified, shortcuts configured, offline-capable |

---

Last Updated: 2026-04-03
Total Files: 139 `.ts/.tsx` source files (PWA) + 1 MCP server + 1 Skill doc
