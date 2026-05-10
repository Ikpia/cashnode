# CashNode Project Overview

## 1. Executive Summary

CashNode is a last-mile cash-out liquidity protocol built on Solana that enables stablecoin senders to deliver local cash through trusted neighborhood agents.

Instead of forcing recipients to understand wallets, exchanges, seed phrases, or on-chain transfers, CashNode uses the infrastructure people already trust in African cities: POS agents and mobile money operators. A sender locks value on-chain, an approved agent fulfills the payout in cash, and the protocol settles the agent automatically after payout confirmation.

The core idea is simple:

1. A sender creates a payout request and locks funds.
2. A nearby agent accepts the request and prepares local cash.
3. The recipient goes to that agent and confirms with a code.
4. The agent is settled on-chain and earns a fee.

CashNode is designed as infrastructure, not just a remittance app. The long-term vision is to turn every compliant cash agent into a liquidity node that can bridge digital dollars and local cash.

## 2. Project Vision

CashNode exists to make stablecoin-powered money movement useful in cash-heavy markets.

Today, digital dollars move globally, but the hardest part is still the last mile:

- getting value out of a wallet and into someone's hand
- doing it quickly
- doing it safely
- doing it without assuming the recipient is crypto-native

CashNode solves that last-mile gap by creating a protocol where local agents provide physical liquidity while Solana provides secure coordination, escrow, and settlement.

## 3. Problem Statement

### 3.1 The Real Problem

Cross-border transfers into African markets are still painful because the final step is broken. Even when funds can move digitally, recipients often need local cash or a familiar fiat experience.

Current options have major issues:

- traditional remittance rails are expensive and slow
- crypto rails are difficult for non-technical users
- peer-to-peer cash-out flows are risky and inconsistent
- bank and mobile money off-ramps are fragmented by country and provider

### 3.2 What Users Experience Today

For senders:

- high remittance fees
- delayed settlement
- poor transparency
- corridor-specific friction

For recipients:

- no wallet literacy
- fear of scams
- difficulty converting crypto to usable cash
- no dependable local pickup experience

For local agents:

- idle cash inventory
- no structured way to earn from stablecoin liquidity
- no trustworthy protocol to connect them with verified demand

### 3.3 Why This Matters in Africa

In many African cities, informal and semi-formal cash infrastructure is stronger than digital off-ramp infrastructure. POS agents already serve as neighborhood financial access points. CashNode treats that reality as an advantage instead of trying to replace it.

## 4. Proposed Solution

CashNode is a protocol-backed agent payout network.

The protocol coordinates three actors:

- Sender: initiates the transfer and funds it with stable value
- Agent: supplies local cash and earns a service fee
- Receiver: collects local cash using a verification code

The protocol handles:

- request creation
- escrow
- agent selection
- payout confirmation
- settlement
- basic dispute safety rules

In the hackathon MVP, we will use Solana for transaction coordination and escrow logic, and we will simulate stablecoin-backed settlement with a devnet-friendly flow. The demo will prove the model end-to-end before full production integrations.

## 5. How CashNode Works

### 5.1 End-to-End Flow

1. A sender opens the CashNode app and enters the receiver's details, payout amount, and pickup area.
2. The sender funds the request, and the protocol locks the value in escrow.
3. Nearby registered agents with enough liquidity can view and accept the request.
4. Once accepted, the receiver gets a pickup instruction and confirmation code.
5. The receiver visits the agent and presents the code.
6. The agent pays out local cash.
7. The protocol marks the request as complete after confirmation.
8. The agent receives settlement and fees from the locked funds.

### 5.2 Core Product Principle

The recipient should not need to interact with crypto directly.

That design choice is central to the product. CashNode hides blockchain complexity from the receiver while still using blockchain for secure settlement and transparent coordination.

### 5.3 Nearest-Agent Dispatch Model

CashNode should work like a liquidity dispatch network, not a generic marketplace board.

For every payout request:

- the sender chooses the pickup area closest to the receiver
- the system looks for the nearest live eligible POS agent to that pickup point
- eligible means the agent is active, verified, online, sharing fresh device location, and has enough local cash capacity to cover the request
- if a matching agent is found, the request is routed to that agent immediately
- if no eligible agent is available, the request can remain open until network capacity catches up

To make "nearest" reliable in practice:

- agents must go live from their dashboard
- the app uses the device's current GPS location as the dispatch source
- background heartbeats keep that location fresh across normal navigation, quick app switches, reconnects, and page visibility changes
- if the heartbeat goes stale, the agent drops out of automatic matching until live presence resumes

This makes the sender experience feel closer to ride-hailing dispatch than manual peer discovery. The sender is not choosing an agent directly; CashNode is choosing the best nearby cash-out node for the receiver.

## 6. Who CashNode Serves

### 6.1 Primary Users

Sender
-Wants to send value quickly and cheaply.
-May be abroad or may already hold stablecoins.

Agent
-Has local cash inventory.
-Wants to earn additional fee income.
-Needs a trustworthy matching and settlement system.

Receiver
-Needs local cash.
-May have low digital literacy.
-Should be able to receive funds with minimal steps.

### 6.2 Secondary Users

Protocol operator
-Oversees network rules and growth.
-Monitors network health and abuse signals.

Partner institutions
-Could later include remittance businesses, payroll providers, and merchant networks.

## 7. Value Proposition

### 7.1 For Senders

- faster than traditional remittance rails
- lower fees
- clearer delivery status
- cash delivery without relying on banks

### 7.2 For Receivers

- no wallet required
- no exchange account required
- simple code-based pickup
- local, familiar collection experience

### 7.3 For Agents

- earn payout fees
- turn idle cash into revenue-generating liquidity
- build on-chain reputation over time
- access a new category of financial demand

## 8. Why Solana

CashNode uses Solana because it is well-suited for a transaction-heavy coordination layer:

- low fees
- high throughput
- fast finality
- strong developer ecosystem
- good fit for escrow and stateful workflow logic

For the hackathon, Solana also gives us a credible path to build a real protocol rather than a mock-only frontend.

## 9. MVP Scope

### 9.1 In Scope for the Hackathon MVP

- sender creates a payout request
- agent registers and stakes liquidity
- request acceptance flow
- pickup code generation
- payout confirmation flow
- on-chain request state transitions
- simple sender and agent dashboards
- demo-ready devnet deployment

### 9.2 Out of Scope for the Hackathon MVP

- production KYC and compliance workflows
- full fiat banking integrations
- live FX routing
- real SMS provider integration if time runs out
- production-grade dispute resolution
- country-by-country regulatory packaging

## 10. Functional Requirements

### 10.1 Sender Requirements

- create a payout request
- specify amount and receiver details
- track request status
- cancel under defined conditions

### 10.2 Agent Requirements

- register as an agent
- stake liquidity
- view open requests
- accept a request
- confirm payout
- view earnings and history

### 10.3 Protocol Requirements

- maintain request state
- hold escrow
- release settlement only on valid completion
- reject invalid transitions
- support fee accounting

## 11. Non-Functional Requirements

- transaction flow should feel fast
- user interface must be simple and mobile-friendly
- core workflow should be demoable on devnet
- architecture should be extendable into a real production system
- trust assumptions should be clearly documented

## 12. Business Model

CashNode is viable because the protocol can monetize the movement and coordination of liquidity.

Potential revenue streams:

- protocol fee on each completed payout
- premium tools for high-volume agents
- partner API access for payroll and remittance companies
- treasury yield on idle protocol-controlled liquidity in future versions

The MVP will demonstrate fee logic and economic flow, even if revenue is simulated on devnet.

## 13. Competitive Positioning

CashNode is not trying to be "another remittance app."

Its wedge is the liquidity coordination layer:

- a protocol for agent-based cash-out
- a local network effect model
- cash-heavy market fit
- infrastructure that could later power multiple consumer and business applications

This makes it more defensible than a generic frontend-only transfer product.

## 14. Why This Can Win a Hackathon

CashNode stands out because it combines:

- a real market problem
- strong local relevance
- technically credible blockchain usage
- clear economic incentives
- a path from MVP to startup

It is also investor-legible. Stakeholders can understand how the network grows, why agents join, and where the moat could come from over time.

## 15. Risks and Assumptions

### 15.1 Assumptions

- agents are willing to participate if fee incentives are attractive
- users value cash pickup enough to justify the flow
- a staged rollout by corridor or city is realistic
- a lightweight MVP is enough to prove the concept

### 15.2 Risks

- agent fraud or payout disputes
- weak liquidity distribution in early network stages
- compliance complexity in production deployment
- UX friction if wallet interactions are exposed too early

### 15.3 MVP Strategy to Reduce Risk

- keep the first version narrow
- start with one city and a simulated corridor
- use explicit confirmation codes
- keep canonical transaction state on-chain
- separate the MVP from production compliance promises

## 16. Success Metrics for the MVP

The hackathon MVP will be considered successful if it demonstrates:

- successful agent registration
- successful request creation
- successful request acceptance
- successful payout confirmation
- successful settlement on devnet
- a clean demo showing sender, agent, and receiver roles

## 17. Deliverables

The initial project deliverables are:

- product overview
- architecture design
- build and execution plan
- smart contract scaffold
- frontend scaffold
- demo-ready pitch narrative

## 18. One-Sentence Summary

CashNode is a Solana-powered protocol that turns neighborhood cash agents into stablecoin cash-out nodes, making digital value usable in cash-first markets.
