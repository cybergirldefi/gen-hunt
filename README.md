# GenHunt — AI Cybersecurity Quiz on GenLayer

**GenHunt** is an on-chain cybersecurity training game built on GenLayer Bradbury Testnet. An AI generates fresh quiz questions every session, tracks your progress across 8 difficulty levels, and records everything on-chain — no backend, no database.

---

## How It Works

1. Connect your MetaMask wallet (GenLayer Bradbury network)
2. Pick a level and start a quiz session
3. Answer 5 AI-generated questions on that level's topic
4. Score 4/5 or better to pass and earn XP
5. Climb the leaderboard and unlock harder levels

Every question is generated live by the AI at quiz time — no static question bank, no repeated questions.

---

## Levels

| # | Rank | Topic | XP Reward | Pass Score |
|---|------|-------|-----------|------------|
| 1 | Rookie | Basic Web3 Safety | 100 XP | 4/5 |
| 2 | Operative | Wallets & Keys | 150 XP | 4/5 |
| 3 | Analyst | DeFi & Rug Pulls | 200 XP | 4/5 |
| 4 | Auditor | Smart Contract Vulns | 250 XP | 4/5 |
| 5 | Elite | Advanced Exploits | 300 XP | 4/5 |
| 6 | Phantom | Zero-day & Side-channels | 400 XP | 4/5 |
| 7 | Ghost | Social Engineering & OSINT | 500 XP | 4/5 |
| 8 | Shadow | Nation-state & APT Attacks | 750 XP | 5/5 |

---

## Tech Stack

- **Smart Contract:** Python Intelligent Contract on GenLayer Bradbury Testnet
- **AI:** GenLayer's `eq_principle.prompt_non_comparative` — generates and evaluates answers
- **Frontend:** React + Vite
- **Wallet:** MetaMask (GenLayer Bradbury, Chain ID 4221)

---

## Contract

| | |
|---|---|
| **Network** | GenLayer Bradbury Testnet |
| **Chain ID** | 4221 |
| **Contract** | `0x7C3396749E59BE3cC246a8e157a7bed29BE155E1` |
| **Explorer** | [View on Explorer](https://explorer-bradbury.genlayer.com/address/0x7C3396749E59BE3cCC246a8e157a7bed29BE155E1) |
| **RPC** | `https://rpc-bradbury.genlayer.com` |

---

## Running Locally

```bash
npm install
npm run dev
```

Requires Node.js 18+ and MetaMask with GenLayer Bradbury network added.

---

## What Makes It Different

Standard quiz apps use static question databases. GenHunt generates every question fresh using GenLayer's AI consensus — multiple validators agree on both the question and whether your answer is correct. There's no admin who can change the rules, no hardcoded answer key, and no way to cheat by looking up the answers in the contract.

---

Built for the GenLayer Bradbury Builder Program.
