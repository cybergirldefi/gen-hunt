GenHunt

GenHunt is an adaptive cybersecurity training game built on GenLayer.

Live Contract

Network: GenLayer Bradbury Testnet

Contract address:

0x537435BCF19df608CDa0Ae1dc535bd2f4888D2C1

Contract source:

contracts/gen_hunt.py

Deployed contract SHA-256:

977555bcb9c1992af48fc038d078cdfa2ed904b1e9c7786d13e3a9f048910752

The contract source committed in this repository was retrieved directly from the deployed Bradbury contract.

Why GenLayer

GenHunt uses GenLayer for the part of the product that requires intelligence.

When a player starts a new level, the Intelligent Contract calls gl.eq_principle.prompt_non_comparative.

Validators evaluate the proposed quiz for:

topic relevance

level-appropriate difficulty

five materially different questions

four answer choices per question

exactly one factually correct answer

accurate answer keys

useful explanations

no ambiguity

no fabricated or misleading security information

Only an accepted quiz becomes the player's active training session.

Training Flow

Connect a wallet.

Set a callsign.

Select the current unlocked level.

GenLayer validators generate and validate five cybersecurity questions.

The accepted question IDs are stored in the player's active quiz.

The player answers all five questions.

Deterministic contract logic scores the answers.

Passing the level awards XP and unlocks progression.

Failed levels may be retried.

Completed levels cannot be replayed for additional rewards.

Practice Mode

Completed levels can be replayed in Practice Mode.

Practice Mode:

uses a previously completed on-chain quiz

requires no new transaction

awards 0 XP

does not change streaks

does not unlock levels

does not modify progression

Levels

Level

Name

Topic

1

Rookie

Basic Web3 Safety

2

Operative

Wallets & Keys

3

Analyst

DeFi & Rug Pulls

4

Auditor

Smart Contract Vulnerabilities

5

Elite

Advanced Exploits

6

Phantom

Zero-day & Side-channels

7

Ghost

Social Engineering & OSINT

8

Shadow

Nation-state & APT Attacks

Levels 1 through 7 require 4/5 correct answers to pass. Level 8 requires 5/5.

Security and Progression

Protections include:

completed quizzes cannot be submitted twice

completed levels cannot be reset to farm XP

active quizzes cannot be silently overwritten

failed attempts award zero XP

answers must contain exactly one entry per question

answers must be A, B, C, or D

missing question state aborts scoring

player state is isolated by wallet address

level progression is sequential

generated quiz structure is validated before storage

Quiz Resume

An active quiz remains stored on GenLayer.

The browser stores only temporary UI progress such as selected answers before final submission and the current question position.

After refresh, the player returns to the level-selection screen. An unfinished level is marked CONTINUE. Selecting that level restores the existing on-chain quiz instead of generating a new one.

Progress Board

The Progress Board displays the connected player's on-chain training record:

XP

current level

completed levels

accuracy

correct answers

best streak

level progression

The current contract does not enumerate every registered player, so GenHunt does not claim to provide a global leaderboard in this version.

Intelligent Contract Methods

Views

get_player(address)
Returns player progression and statistics.

get_question(q_id)
Returns a question and answer choices without exposing the correct answer before submission.

get_quiz_status(address, level)
Returns the current state of a player's quiz.

get_total_questions()
Returns the global question counter.

Writes

set_username(username)
Sets the player's callsign.

request_level_quiz(level)
Generates a new quiz using GenLayer validator consensus.

submit_quiz_answers(level, answers)
Scores the active quiz and updates progression.

retry_quiz(level)
Resets a failed or abandoned quiz. Successfully completed levels cannot be reset for additional rewards.

Frontend

The frontend uses the official genlayer-js SDK.

It supports:

Bradbury wallet network switching

official GenLayer contract reads

wallet-backed contract writes

full consensus for quiz generation

leader-only execution for deterministic writes where appropriate

accepted-state transaction waiting

automatic state refresh after transactions

wallet account-change handling

network-change handling

active quiz resume

local partial-answer persistence

Practice Mode

no handwritten GenLayer calldata or RLP logic

Local Development

npm install
npm run dev

Production build:

npm run build

Contract Testing

python3 -m venv .venv
source .venv/bin/activate
pip install -U genlayer-test pytest
pytest tests/direct/ -q

Current audited result:

27 passed

The test suite covers default player state, username validation, wallet isolation, level skipping, generated-question validation, invalid AI JSON, invalid question counts, duplicate questions, duplicate options, invalid answer keys, submitted-answer validation, successful progression, perfect-score rewards, failed-attempt behavior, retry behavior, duplicate submissions, missing question state, XP farming attempts, and duplicate reward claims.

Contract Validation

genvm-lint check contracts/gen_hunt.py

Current audited result:

Lint passed
Validation passed
Contract: GenHunt
Methods: 8 (4 view, 4 write)

Dependency Audit

npm audit

Current audited result:

found 0 vulnerabilities

Stack

GenLayer Intelligent Contracts

GenLayer Bradbury Testnet

genlayer-js

React

Vite

MetaMask / Rabby

genlayer-test

genvm-lint

Repository Structure

gen-hunt/
├── contracts/
│   └── gen_hunt.py
├── tests/
│   └── direct/
│       ├── test_gen_hunt.py
│       └── test_rewards.py
├── src/
│   ├── components/
│   └── lib/
├── gltest.config.yaml
├── package.json
└── README.md

Audit Status

27/27 contract tests passing

GenVM lint passing

GenVM validation passing

npm audit: 0 vulnerabilities

production build passing

exact deployed contract source included in the repository
