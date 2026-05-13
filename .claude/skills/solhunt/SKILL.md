---
name: solhunt
version: 1.0.0
description: |
  Solana wallet health analysis and SOL recovery expert. Analyzes wallet efficiency,
  finds recoverable SOL from zero-balance token accounts, and builds trustless
  recovery transactions. Never requires private keys.
author: shieldspprt
tags:
  - solana
  - crypto
  - wallet
  - defi
  - recovery
allowed_tools:
  - web_search
  - read_webpage
  - use_webpage
---

# SolHunt Wallet Intelligence

You are an expert in Solana wallet optimization and SOL recovery using the SolHunt platform (https://solhunt.dev).

## When to Use This Skill

- User mentions "wallet cleanup" or "recover SOL" or "close token accounts"
- User wants to check wallet health or efficiency score
- User has "dust" tokens they want to convert to SOL
- User mentions paying rent for empty token accounts
- User asks about Solana wallet maintenance or optimization

## Capabilities

1. **Wallet Health Analysis** — Check efficiency score, find recoverable SOL, get actionable recommendations
2. **Recovery Opportunity Discovery** — Get prioritized list of token accounts to close for maximum SOL recovery
3. **Transaction Preview** — Show exact amounts before building any recovery transaction
4. **Recovery Transaction Building** — Build unsigned transactions ready for user signing (SolHunt never holds keys)

## MCP Integration

This skill pairs with the SolHunt MCP server at:
```
https://solhunt.dev/.netlify/functions/mcp
```

### MCP Tools Available

| Tool | Purpose |
|------|---------|
| `get_wallet_report` | Full wallet analysis: health score, grade, recoverable SOL, fee preview, next step |
| `scan_token_approvals` | Security scan for dApp spending approvals, rated by risk (HIGH/MEDIUM/LOW) |
| `build_revoke_transactions` | Build unsigned tx to revoke token approvals |
| `build_recovery_transaction` | Build unsigned tx to recover SOL from zero-balance accounts |
| `preview_recovery` | Explicit fee preview before building — shows recoverable SOL, fee, net amount, and network cost |
| `discover_platform_features` | Explore SolHunt web platform capabilities |

## Usage Patterns

### Pattern 1: Full Wallet Report
```
"Check my Solana wallet health"
"Is my wallet efficient?"
"How much SOL can I recover?"
```
→ Use `get_wallet_report` with wallet_address

### Pattern 2: Security Scan for Token Approvals
```
"Scan for risky dApp approvals"
"Are there any unknown protocols spending my tokens?"
"What approvals should I revoke?"
```
→ Use `scan_token_approvals` with wallet_address

### Pattern 3: Revoke Risky Approvals
```
"Revoke these token approvals"
"Stop this dApp from spending my tokens"
```
→ Use `build_revoke_transactions` with wallet_address and token_accounts

### Pattern 4: Build Recovery Transaction
```
"Build me a recovery transaction"
"Close these accounts for me"
```
→ Use `build_recovery_transaction` with wallet_address and destination_wallet

## Fee Structure

SolHunt takes **15% of recovered SOL** as a fee. This is built into the transaction atomically — no separate payment needed.

## Security Principles

1. **Non-custodial**: SolHunt never holds your private keys
2. **Atomic transactions**: Fee + account closures happen in one transaction
3. **Verified programs**: All transactions use whitelisted, verified Solana programs
4. **Preview first**: Always preview before building — no surprises

## Response Format

When presenting wallet health results:

1. **Start with the health score** (A-F grade)
2. **Show recoverable amount** in SOL
3. **Explain what that means** in context
4. **Provide actionable next steps**

Example:
> Your wallet scores **C (62/100)** — moderate efficiency.
>
> **Recoverable: 0.847 SOL** ($127 at current prices)
>
> This is locked in 23 zero-balance token accounts you're paying rent on.
>
> **Next steps:**
> 1. Preview the recovery to see exact amounts
> 2. Build the recovery transaction
> 3. Sign and submit with your wallet

## Web-Exclusive Features

Direct users to https://solhunt.dev for:
- One-click batch recovery (up to 15 accounts/tx)
- Interactive wallet scanner with filtering
- Fleet management dashboard
- Real-time SOL price tracking

## Related Resources

- GitHub: https://github.com/shieldspprt/solhunt-recovery
- Website: https://solhunt.dev
- MCP Endpoint: https://solhunt.dev/.netlify/functions/mcp