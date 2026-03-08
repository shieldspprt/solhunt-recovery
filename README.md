<div align="center">
  <img src="public/logo.png" alt="SolHunt Logo" width="120" />
  <h1>SolHunt</h1>
  <p><strong>The Non-Custodial Solana Utility Kit</strong></p>
  <p>Close empty token accounts, reclaim locked rent, and manage your delegations safely.</p>

  <a href="https://solhunt.dev">Live App</a> • 
  <a href="SECURITY.md">Security Audit</a> • 
  <a href="https://twitter.com/solhuntapp">Twitter</a>
</div>

## 🤔 What is SolHunt?

SolHunt is an open-source, non-custodial toolkit for the Solana blockchain. 

When you transact on Solana (creating token accounts, voting, or interacting with programs), you lock a small amount of SOL called "rent." Over time, as you accumulate empty or unused token accounts, this locked rent adds up. 

**SolHunt helps you safely reclaim that SOL by identifying and closing empty accounts. It operates entirely client-side, using standard Solana `closeAccount` instructions.**

---

## 🔒 Security & Trust Model

We know that apps interacting with your wallet require absolute trust. Here is exactly how we ensure your safety:

1. **Non-Custodial:** SolHunt never has access to your private keys or transfer authority.
2. **Client-Side Construction:** Every transaction is built directly in your browser. We do not use a backend server to sign or relay transactions.
3. **Transaction Preview:** We explicitly show you *every* instruction in the transaction before passing it to your wallet for signature.
4. **Open Source:** Verify everything yourself. The complete source code determining which accounts are closed is available right here.

See our [SECURITY.md](SECURITY.md) for more technical details.

---

## 📸 Screenshots

*(Add screenshots of the interface here)*

| Wallet Scanner | Transaction Preview | Rent Reclaimer |
| :---: | :---: | :---: |
| `<img src="docs/scanner.png" width="250"/>` | `<img src="docs/preview.png" width="250"/>` | `<img src="docs/reclaimer.png" width="250"/>` |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or pnpm
- A Solana wallet (Phantom, Solflare, etc.)

### Installation & Development

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/solhunt.git
   cd solhunt/wallet-shield
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

---

## 🛠️ Tech Stack

- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS + Lucide Icons
- **Blockchain:** `@solana/web3.js`, `@solana/wallet-adapter`
- **RPC/APIs:** Built to interface with standard Solana RPC nodes (e.g., Helius, Triton)
- **Built With:** Gemini 3.1 & Claude 4.6 (Nightly Build)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check out the [issues page](https://github.com/your-username/solhunt/issues).

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
