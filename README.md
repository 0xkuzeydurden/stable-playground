# Stable Playground

A React and TypeScript playground for exploring wallet interactions on Stable Testnet. Built with Vite, Tailwind CSS, and viem.

## Features

- Connect an injected browser wallet and request a switch to Stable Testnet.
- View the connected account's balance, network block number, and GM/GN counters.
- Send GM/GN greetings through the configured contracts.
- Transfer native testnet gUSDT to a recipient.
- Deploy the included minimal ERC-20 and ERC-721 contracts with a name and symbol.
- Follow submitted transactions and deployed contracts in the configured explorer.

## Run locally

Install Node.js and pnpm, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

To type-check and build the static app, then preview the build:

```sh
pnpm build
pnpm preview
```

The build output is `dist/`.

## Network and configuration

The app is configured for **Stable Testnet**, chain ID **2201**, with **gUSDT** as the native test token. RPC, WebSocket, explorer, faucet, and contract addresses are defined in [`src/web3.ts`](src/web3.ts).

No environment variables or private keys are required by the current app. The network configuration is public client-side data. Use a browser wallet for signing; keep its private keys outside the project.

Transactions and contract deployments require approval in the connected wallet.

## Project scope

This is an experimental testnet application. Use test tokens and review the network, recipient, and transaction request in your wallet. RPC, faucet, and deployed-contract availability depend on external services. No live transaction verification or production-readiness guarantee is implied.
