# CashNode Build Plan

## 1. Build Objective

The objective of this build plan is to take CashNode from concept to a demo-ready hackathon MVP by the Colosseum Frontier Hackathon submission deadline on **May 11, 2026**.

This plan assumes work begins on **April 23, 2026** and focuses on shipping a credible MVP, not a production financial network.

## 2. Definition of Success

By submission day, the project should have:

- a clear product story
- a documented architecture
- a working Solana program on devnet
- a sender-facing request creation flow
- an agent-facing request acceptance and completion flow
- an end-to-end demo scenario
- a concise pitch narrative and recorded demo

## 3. Delivery Philosophy

The build must prioritize:

- end-to-end completeness over extra features
- demo reliability over production complexity
- one narrow corridor or city simulation over broad promises
- clear storytelling over technical sprawl

## 4. Workstreams

The project will run across five workstreams:

### 4.1 Product and Documentation

- clarify problem statement
- define scope
- write product narrative
- prepare submission assets

### 4.2 Smart Contract and Protocol Logic

- model agent staking
- model payout requests
- implement lifecycle transitions
- test escrow and settlement rules

### 4.3 Frontend Experience

- sender dashboard
- agent dashboard
- request status views
- demo flow pages

### 4.4 Off-Chain App Services

- indexing and read models
- optional notification scaffolding
- protocol activity feed

### 4.5 Demo and Submission

- demo script
- demo data setup
- video recording
- pitch write-up

## 5. Timeline Overview

### Phase 1: Planning and Documentation
**April 23, 2026 to April 24, 2026**

Goals:

- finalize product concept
- document overview
- document architecture
- document build plan
- define MVP scope and non-goals

Outputs:

- `PROJECT_OVERVIEW.md`
- `ARCHITECTURE.md`
- `BUILD_PLAN.md`

### Phase 2: Technical Setup and Contract Scaffold
**April 25, 2026 to April 27, 2026**

Goals:

- initialize repository structure
- install Solana and Anchor tooling
- create Next.js app shell
- scaffold program accounts and instructions

Outputs:

- working project structure
- initial Anchor program
- initial frontend app

### Phase 3: Core Protocol Implementation
**April 28, 2026 to May 1, 2026**

Goals:

- implement agent registration
- implement request creation
- implement request acceptance
- implement completion and cancellation logic
- test state transitions

Outputs:

- working contract lifecycle
- test coverage for major flows

### Phase 4: Frontend and Integration
**May 2, 2026 to May 5, 2026**

Goals:

- build sender UI
- build agent UI
- wire frontend to Solana program
- add request status views
- add demo-friendly role switching or multiple sessions

Outputs:

- interactive MVP UI
- integrated on-chain flows

### Phase 5: Demo Hardening and UX Polish
**May 6, 2026 to May 8, 2026**

Goals:

- improve error handling
- clean up visual flow
- add demo state visibility
- make the app mobile-friendly
- verify reliability on devnet

Outputs:

- polished demo path
- stable demo build

### Phase 6: Submission Preparation
**May 9, 2026 to May 11, 2026**

Goals:

- record demo video
- prepare submission copy
- refine pitch messaging
- gather screenshots
- rehearse end-to-end demo

Outputs:

- submission-ready project
- final demo assets

## 6. Day-by-Day Execution Plan

### April 23, 2026

- review concept and constraints
- write project overview
- write architecture draft
- write build plan

### April 24, 2026

- refine docs
- define MVP user journeys
- confirm folder structure
- confirm core contract instructions

### April 25, 2026

- initialize codebase
- set up Next.js app
- set up Anchor workspace
- verify local tooling

### April 26, 2026

- define on-chain account structures
- define request state machine
- scaffold program instructions

### April 27, 2026

- connect tests and local/devnet config
- validate basic build pipeline

### April 28, 2026

- implement agent registration flow
- implement stake handling

### April 29, 2026

- implement payout request creation
- implement escrow flow

### April 30, 2026

- implement agent acceptance flow
- implement request assignment logic

### May 1, 2026

- implement confirmation and completion flow
- implement cancellation path

### May 2, 2026

- build sender dashboard
- add wallet connection

### May 3, 2026

- build agent dashboard
- show open requests and accepted requests

### May 4, 2026

- connect frontend actions to contract calls
- add request timeline and status rendering

### May 5, 2026

- build receiver confirmation page or operator simulation flow
- validate end-to-end transaction path

### May 6, 2026

- improve UX and empty states
- improve loading and error messaging

### May 7, 2026

- test entire demo path multiple times
- fix integration bugs

### May 8, 2026

- create demo seed data
- finalize screenshots and visual polish

### May 9, 2026

- write pitch summary
- write technical explanation
- outline business model clearly

### May 10, 2026

- record demo video
- rehearse spoken explanation

### May 11, 2026

- final QA
- final submission
- contingency buffer for last-minute fixes

## 7. Recommended Time Allocation

If working solo, use a simple percentage-based allocation:

- 30% smart contract and protocol logic
- 25% frontend and wallet integration
- 15% off-chain services and indexing
- 15% testing and demo hardening
- 15% documentation, pitch, and submission assets

If working with one teammate:

- Builder 1 owns protocol and integration
- Builder 2 owns frontend and demo UX

## 8. MVP Scope Lock

To avoid scope creep, the build should stay locked to these must-have features:

- agent registration
- request creation
- request acceptance
- payout confirmation
- settlement display
- sender and agent dashboard

Nice-to-have features that should not block submission:

- SMS integration
- maps integration
- richer analytics
- advanced agent ranking
- dispute workflow

## 9. Testing Plan

### 9.1 Smart Contract Testing

- valid state transitions
- invalid state transitions
- fee calculations
- unauthorized actions
- expiry and cancellation behavior

### 9.2 Frontend Testing

- wallet connect flow
- form validation
- loading and error states
- success path rendering

### 9.3 Demo Testing

- full sender to agent flow
- multi-browser or multi-role demo
- devnet reliability checks
- fallback demo script if RPC is unstable

## 10. Risks and Mitigations

### Risk: Smart contract complexity slows progress

Mitigation:

- keep the state machine small
- avoid advanced token mechanics unless necessary
- use devnet-friendly settlement for the MVP

### Risk: Frontend takes too long

Mitigation:

- use a simple dashboard layout
- avoid design rabbit holes
- prioritize clarity over visual complexity

### Risk: Devnet instability affects demo

Mitigation:

- keep a recorded backup demo
- preload seed data
- rehearse with realistic timing

### Risk: Scope creep

Mitigation:

- revisit scope lock daily
- cut optional features early
- optimize for complete flow, not breadth

## 11. Final Submission Checklist

- project overview is clear
- architecture is documented
- build plan is documented
- codebase builds successfully
- core flows work on devnet
- screenshots are captured
- demo video is recorded
- submission form copy is ready
- business model is easy to explain
- problem and local relevance are clearly stated

## 12. Build Summary

The strongest path for CashNode is to move in layers:

1. lock the idea and scope
2. implement the contract core
3. wrap it in a usable dashboard
4. polish the demo story
5. submit with confidence

The goal is not to build every future feature by May 11, 2026. The goal is to prove the core insight: neighborhood cash agents can become programmable liquidity nodes for stablecoin-powered payouts.
