# CashNode Architecture

## 1. Architecture Goal

CashNode's architecture is designed to support a hackathon MVP that proves one core workflow:

1. a sender creates a cash payout request
2. an agent accepts and fulfills that request
3. the protocol settles the agent after confirmation

The architecture should be simple enough to build quickly, but structured enough to evolve into a real protocol.

## 2. High-Level System View

```text
+-------------------+        +-------------------------+
| Sender Web App    |        | Agent Dashboard         |
| Next.js           |        | Next.js                 |
+---------+---------+        +------------+------------+
          |                               |
          +---------------+---------------+
                          |
                          v
                +-------------------------+
                | App Services Layer      |
                | Next.js API Routes      |
                | / server actions        |
                +-----------+-------------+
                            |
            +---------------+--------------------+
            |                                    |
            v                                    v
+-------------------------+         +-------------------------+
| Solana Program          |         | Off-Chain Support       |
| Anchor / Rust           |         | Indexing, notifications |
| Canonical transaction   |         | geolocation, caching    |
| state and settlement    |         +-------------------------+
+------------+------------+
             |
             v
 +-------------------------+
 | Solana Accounts / PDAs  |
 | agent, request, vaults  |
 +-------------------------+
```

## 3. Architecture Principles

- Keep canonical financial state on-chain.
- Keep convenience and UI state off-chain.
- Make the receiver flow as lightweight as possible.
- Design for one city and one corridor first.
- Build for demo reliability before production complexity.

## 4. Major Components

## 4.1 Frontend Layer

The frontend will be built with Next.js and TypeScript.

Main interfaces:

- Sender dashboard
- Agent dashboard
- Admin or demo monitor page

Responsibilities:

- wallet connection for sender and agent roles
- request creation forms
- request tracking
- agent request queue
- completion flow
- network status display

Why Next.js:

- fast setup
- flexible routing
- good fit for dashboard UI
- supports server-side and client-side patterns
- can host lightweight API routes for orchestration

## 4.2 App Services Layer

The services layer is the bridge between the frontend and blockchain interactions that should not live directly in the browser.

For the hackathon MVP, this can be implemented inside Next.js API routes or server actions.

Responsibilities:

- preparing transaction payloads
- validating request input before submission
- generating or managing receiver pickup codes if needed off-chain
- indexing protocol activity for UI consumption
- optional notification triggering
- optional geolocation filtering

This layer should not be the source of truth for money movement. It exists to improve app usability.

## 4.3 Solana Program

The Solana program is the core of CashNode.

It manages:

- agent registration
- stake tracking
- payout request creation
- escrow state
- request lifecycle transitions
- fee logic
- settlement conditions

The program should be written with Anchor to reduce boilerplate and improve development speed.

## 4.4 Off-Chain Support Services

Some functions are better handled off-chain in the MVP:

- notification delivery
- request indexing for fast UI rendering
- map and location lookup
- activity logs
- analytics

Recommended approach for MVP:

- use a lightweight off-chain store for mirrored read models
- keep on-chain data canonical
- treat off-chain data as cache, not truth

Possible tooling:

- Supabase or PostgreSQL for indexed reads
- background job worker for notifications
- RPC listener or polling service for program events

## 5. Core On-Chain Entities

## 5.1 Agent Account

Represents a registered liquidity agent.

Suggested fields:

- agent public key
- stake amount
- active or inactive status
- service area or region code
- reputation summary
- completed request count
- current available capacity

Purpose:

- prove commitment through stake
- determine if agent can accept requests
- form the basis of reputation and discovery

## 5.2 Request Account

Represents a single payout request.

Suggested fields:

- request id
- sender public key
- amount
- target region
- recipient reference
- pickup code hash or verification reference
- status
- assigned agent
- created timestamp
- expiry timestamp

Purpose:

- record request lifecycle
- provide a transparent state machine
- connect sender, receiver, and agent for settlement

## 5.3 Escrow Vault

Stores locked value while the request is in progress.

Purpose:

- prevent premature settlement
- guarantee funds are reserved
- release value only when rules are satisfied

Implementation note:

- for the MVP, use a simplified devnet-compatible token or SOL-backed escrow path if stablecoin integration would slow delivery
- for the full version, move to SPL token custody with stablecoin settlement

## 5.4 Treasury or Fee Vault

Stores protocol fees collected from completed transactions.

Purpose:

- isolate protocol revenue
- simplify accounting
- support fee reporting in the demo

## 6. Request Lifecycle

The protocol is easiest to reason about as a state machine.

### 6.1 States

- Draft or local form state
- Pending
- Accepted
- Ready for pickup
- Paid out
- Completed
- Cancelled
- Expired
- Disputed

For the hackathon MVP, we can collapse the lifecycle to:

- Pending
- Accepted
- PendingConfirmation
- Completed
- Cancelled

### 6.2 Lifecycle Flow

```text
Sender creates request
        |
        v
     Pending
        |
        v
Agent accepts request
        |
        v
     Accepted
        |
        v
Agent pays receiver and marks payout
        |
        v
PendingConfirmation
        |
   +----+----+
   |         |
   v         v
Completed   Cancelled
```

## 7. Interaction Flows

## 7.1 Agent Registration Flow

1. Agent connects wallet.
2. Agent submits registration details.
3. Agent deposits required stake.
4. Program creates agent account and marks availability.
5. UI reflects active agent status.

## 7.2 Sender Request Flow

1. Sender connects wallet.
2. Sender enters amount and receiver details.
3. Frontend validates input.
4. Sender signs the request transaction.
5. Program creates request account and locks value in escrow.
6. Request becomes visible to eligible agents.

## 7.3 Agent Fulfillment Flow

1. Agent views available requests.
2. Agent accepts a request.
3. Receiver is given a pickup instruction and code.
4. Agent pays cash to the receiver.
5. Agent marks payout complete.
6. Receiver confirms or the demo operator simulates confirmation.
7. Program releases settlement and fees.

## 7.4 Cancellation Flow

1. Request expires or fulfillment fails.
2. Authorized cancellation is triggered.
3. Program updates request status.
4. Funds are returned according to protocol rules.
5. If applicable, penalties are applied to the agent.

## 8. Component Responsibilities

## 8.1 What Lives On-Chain

- request state
- agent stake
- escrow state
- assignment state
- fee rules
- settlement transitions

## 8.2 What Lives Off-Chain

- UI session state
- rich agent profile details
- search indexes
- notifications
- analytics
- map coordinates and convenience metadata

This split keeps the protocol trustworthy without overloading the chain with non-essential UI data.

## 9. APIs and Integration Points

The MVP can expose lightweight internal APIs through Next.js.

Possible endpoints:

- `POST /api/requests/create`
- `GET /api/requests/open`
- `POST /api/agents/register`
- `POST /api/requests/accept`
- `POST /api/requests/confirm`
- `GET /api/dashboard/summary`

These endpoints can:

- validate payloads
- call blockchain SDK logic
- read from indexed protocol mirrors
- support demo dashboards

## 10. External Dependencies

### 10.1 Blockchain Stack

- Solana devnet
- Anchor framework
- `@solana/web3.js`
- wallet adapter packages

### 10.2 Frontend Stack

- Next.js
- TypeScript
- Tailwind CSS if needed for speed

### 10.3 Optional Support Services

- Supabase or PostgreSQL
- SMS provider such as Termii or Twilio
- Maps or geocoding provider
- Solana RPC provider

## 11. Security Considerations

The MVP is not production-grade finance infrastructure, but its design should still show mature thinking.

Key protections:

- escrow must be program-controlled
- only valid state transitions are allowed
- only assigned agents can confirm fulfillment
- confirmation codes should not be stored in plain text if avoidable
- expiry windows should exist for open requests
- stake should create economic accountability

Additional production considerations:

- KYC and AML
- transaction monitoring
- role-based admin controls
- dispute resolution process
- rate limiting and anti-fraud systems

## 12. Observability and Demo Reliability

To make the hackathon demo strong, the system should expose a simple activity timeline.

Recommended views:

- sender request history
- agent fulfillment history
- protocol event log
- request status board for the demo

This will make it easier to show the full story live, even if some pieces are simulated.

## 13. Recommended Folder Structure

```text
cashnode/
├─ app/
│  ├─ (sender)/
│  ├─ (agent)/
│  ├─ admin/
│  └─ api/
├─ components/
├─ lib/
│  ├─ solana/
│  ├─ validation/
│  └─ services/
├─ programs/
│  └─ cashnode/
├─ tests/
├─ docs/
└─ scripts/
```

If the repository stays lightweight for now, these docs can live at the root until the codebase grows.

## 14. Deployment Model

For the MVP:

- frontend deployed on Vercel or local demo environment
- Solana program deployed to devnet
- RPC provider used for reads and writes
- optional off-chain store deployed quickly with Supabase

For a live demo:

- sender flow runs in browser
- agent flow runs in a second browser session
- receiver flow can be simulated through a code entry page or operator panel

## 15. Future Evolution

After the MVP, the architecture can evolve toward:

- multi-city routing
- stablecoin token support with SPL tokens
- agent reputation scoring
- compliance modules
- partner APIs
- embedded payout channels for payroll and remittance companies

## 16. Architecture Summary

CashNode should be built as a hybrid system:

- Solana handles trust, escrow, and settlement
- Next.js handles user experience
- lightweight off-chain services handle indexing and notifications

That split gives us the best balance of speed, credibility, and hackathon execution.
