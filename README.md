# SignalForge

**Seek truth. Settle with evidence.**

SignalForge is a decentralized evidence evaluation platform built on [GenLayer](https://www.genlayer.com/). It allows users to create research questions, submit evidence URLs, and use GenLayer Intelligent Contracts to evaluate evidence and produce consensus-based outcomes.

## Overview

Online claims can be difficult to verify, especially when evidence is incomplete or conflicting. SignalForge provides an on-chain workflow for recording questions, collecting evidence, and evaluating outcomes transparently.

Instead of relying solely on a centralized authority, SignalForge uses GenLayer's intelligent contract execution to assess evidence against predefined resolution criteria.

## Features

- **On-chain questions:** Create research questions with descriptions and explicit resolution criteria.
- **Evidence submission:** Attach HTTPS evidence URLs to existing questions.
- **AI-assisted evaluation:** Use GenLayer Intelligent Contracts to evaluate submitted evidence.
- **Consensus-based resolution:** Record evaluation outcomes through GenLayer's execution and consensus process.
- **Transparent results:** View question status, verdict, confidence, explanation, and submitted evidence.
- **Wallet integration:** Connect with MetaMask to submit transactions.
- **Live contract data:** Read questions and evidence directly from the deployed contract.
- **Responsive research dashboard:** Browse, search, filter, and inspect questions.

## Built With

- **GenLayer StudioNet** — intelligent contract execution and consensus
- **Python** — Intelligent Contract implementation
- **Next.js** — frontend framework
- **React** — user interface
- **JavaScript** — frontend application logic
- **genlayer-js** — GenLayer client SDK
- **MetaMask** — wallet connection and transaction signing

## Deployed Contract

| Property | Value |
|---|---|
| Network | GenLayer StudioNet |
| Chain ID | `61999` |
| Contract | `0x2677F2F9D806e7511BC2B88b8c5FA516F4793312` |
| Explorer | [View SignalForge contract](https://explorer-studio.genlayer.com/address/0x2677F2F9D806e7511BC2B88b8c5FA516F4793312) |

## How It Works

1. **Create a question:** Enter a title, description, and resolution criteria.
2. **Submit evidence:** Add one or more HTTPS URLs relevant to the question.
3. **Request resolution:** Submit a transaction asking the Intelligent Contract to evaluate the evidence.
4. **Evaluate through GenLayer:** The contract executes its evidence-evaluation logic using GenLayer's intelligent execution and consensus mechanisms.
5. **Review the outcome:** Inspect the on-chain status, verdict, confidence, and explanation.

A transaction timeout does not necessarily mean the transaction failed. Always check the transaction and refresh the question's on-chain state before retrying.

## Intelligent Contract Interface

The deployed contract exposes the following functions:

| Function | Purpose |
|---|---|
| `create_question(title, description, criteria)` | Creates a research question |
| `submit_evidence(question_id, evidence_url)` | Records an evidence URL |
| `resolve_question(question_id)` | Evaluates submitted evidence and resolves the question |
| `get_question_count()` | Returns the number of questions |
| `get_question(question_id)` | Retrieves question details |
| `get_evidence(question_id)` | Retrieves evidence URLs for a question |

## Run Locally

### Prerequisites

- Node.js and npm
- Git
- MetaMask browser extension
- A wallet configured for GenLayer StudioNet

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/signalforge.git
cd signalforge
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x2677F2F9D806e7511BC2B88b8c5FA516F4793312
```

The frontend includes this contract address as a fallback, but configuring the environment variable makes the deployment configuration explicit.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

SignalForge can be deployed using Vercel.

1. Push the project to a GitHub repository.
2. Import the repository into [Vercel](https://vercel.com/).
3. Configure `NEXT_PUBLIC_CONTRACT_ADDRESS` in the project's environment variables.
4. Deploy the application.
5. Verify wallet connection, contract reads, evidence submission, and question resolution on the deployed website.

The frontend connects to the existing deployed contract; frontend deployments do not require redeploying the contract unless the contract itself changes.

## Security and Limitations

- Evidence URLs are external resources and may change or become unavailable.
- Evaluation results depend on the contract's evaluation logic and the GenLayer execution and consensus process.
- A verdict is an evaluation outcome, not a universal guarantee that a claim is objectively true.
- Never commit private keys, wallet seed phrases, or secret credentials to GitHub.
- Confirm transaction status in the GenLayer explorer when confirmation is delayed.

## Roadmap

- Improve RPC reliability and automatic retries.
- Improve transaction tracking and pending-state feedback.
- Expand evidence sources and evaluation criteria.
- Improve question discovery and result presentation.
- Add richer evaluation history and transparency features.

## Contributing

Contributions, bug reports, and feature suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request describing the changes.

## License

Choose and add an appropriate open-source license before distributing the project under one.

---

**SignalForge — Evidence in. Consensus out.**