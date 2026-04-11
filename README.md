<div align="center">
  <img src="public/logo.png" alt="SolHunt Logo" width="120" />
  <h1>SolHunt</h1>
  <p><strong>The Premier Solana Recovery Protocol & Top-Notch Dev Tool</strong></p>
  <p>A top-notch dev tool and open-source execution framework designed to help people and AI agents recover their SOL from burner and old wallets super securely. Reclaim trapped liquidity, revoke dangerous delegations, and optimize Solana account state via our dApp or native MCP integrations.</p>

  <a href="https://solhunt.dev">Live App</a> • 
  <a href="https://github.com/shieldspprt/solhunt-recovery">GitHub</a> • 
  <a href="https://twitter.com/solhuntdev">Twitter</a>
</div>

[![SolHunt-Solana-Wallet-Intelligence MCP server](https://glama.ai/mcp/servers/shieldspprt/solhunt-recovery/badges/card.svg)](https://glama.ai/mcp/servers/shieldspprt/solhunt-recovery)

## 🛡️ The "Anti-Drainer" Architecture & Trust Model

In an ecosystem plagued by wallet drainers, **trust must be verified through code, not marketing.** SolHunt is aggressively transparent. We designed our architecture to provide absolute mathematical certainty that your principal assets cannot be stolen.

**How we prove we are not a drainer:**
1. **100% Client-Side Construction:** Every transaction payload is built directly in your browser. There is no backend server holding private keys, and no API that signs on your behalf.
2. **Instruction-Level Isolation:** Our transaction builders *strictly omit* transfer paradigms.
3. **AI Agent & LLM Friendly:** Native [MCP (Model Context Protocol)](https://modelcontextprotocol.io) support allows autonomous agents to scan and build recovery transactions safely and securely.
4. **No Hidden Authorities:** You sign the exact instructions. We never request persistent delegation or transfer authority over your main wallet.

---

## ⚙️ The Recovery Engines

SolHunt currently operates 9 production recovery engines (plus 1 in preview):

| Engine | Technical Execution | Action |
| :--- | :--- | :--- |
| **1. Revoke Permissions** | `spl-token Revoke` | Nullifies `delegate` and `delegate_amount` fields on SPL Token accounts, neutralising smart contract exploit vectors. |
| **2. Reclaim Rent** | `spl-token CloseAccount` | Dismantles empty token accounts, triggering the BPF runtime to refund the locked ~0.002 SOL rent exemption directly to your base address. |
| **3. Sweep Dust** | Jupiter / Raydium swap, or `spl-token Burn` + `CloseAccount` | Liquidates micro-balances via swap routing, or permanently burns unswappable tokens to reclaim rent. |
| **4. Claim Stakes** | Protocol-specific claim instructions | Parses `TicketAccountData` for unstaking delays (Marinade, Sanctum, Jito, BlazeStake) and executes protocol-specific claim instructions. |
| **5. Harvest LP Fees** | CLMM `collectFees` | Queries Orca, Raydium, and Meteora SDKs for Position NFTs and triggers pure fee harvests without touching principal liquidity. |
| **7. MEV & Priority Fees** | Jito Tip Distribution `claim` | Fetches Merkle Proofs from the Jito Kobe Network API and submits them to the Tip Distribution program to claim your share of MEV block-space tips. |
| **9. Dead Protocol Rescue** | Anchor IDL simulation | Identifies trapped LP positions in decommissioned DeFi protocols and constructs direct withdrawal instructions. |
| **10. Recover Program Buffers** *(preview)* | `BPFLoader Close` | Searches for orphaned deployment buffer accounts and executes `Close` to recover rent deposits from failed deployments (commonly 1–50 SOL). |

*(Engine numbers correspond to internal routing IDs and are non-sequential.)*

---

## 🛠️ Tech Stack & Development

Built for developers and researchers to verify, fork, and learn from.

- **Frontend:** React 19, Vite, Tailwind CSS, Zustand
- **Blockchain Execution:** `@solana/web3.js`, `@solana/wallet-adapter-react`, SPL Token Standard
- **Infrastructure:** Helius DAS API, Jupiter V6 Aggregator, Jito Kobe Network
- **Agent Intelligence:** Native MCP (Model Context Protocol) integration for autonomous agents and LLMs.

### Running Locally for Verification
We encourage all users to audit the code and run the client locally for maximum security verifiable execution.
```bash
git clone https://github.com/shieldspprt/solhunt-recovery.git
cd solhunt-recovery/wallet-shield
npm install
npm run dev
```

## 🤝 Contributing & License
Open to PRs. Licensed under MIT. See the code, verify the logic, and help us build a safer Solana ecosystem.

---
[Contact Support](https://x.com/solhuntdev) | [Website](https://solhunt.dev) | [GitHub](https://github.com/shieldspprt/solhunt-recovery)