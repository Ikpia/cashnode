import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ObjectId, getMongoDb, __resetMongo } from "mongodb";
import { __resetAuthSession, __setCurrentSessionUser } from "./fakes/auth-session.mjs";
import { __getTransactionCalls, __queueTransactions, __resetSolanaMock } from "./fakes/solana-web3.mjs";
import { POST as recordEscrowPost } from "../app/api/payout-requests/[requestId]/escrow/record/route.ts";

const PROGRAM_ID = "CashNodeEscrow111111111111111111111111111111";
const SENDER_ID = "64f000000000000000000001";
const AGENT_ID = "64f000000000000000000002";
const SENDER_WALLET = "SenderWallet1111111111111111111111111111111";
const AGENT_WALLET = "AgentWallet11111111111111111111111111111111";
const ESCROW_ADDRESS = "EscrowPda11111111111111111111111111111111";

function signature(label) {
  const safeLabel = label.replace(/[0OlI]/g, "A");
  return `${safeLabel}${"1".repeat(88)}`.slice(0, 88);
}

function actorUser(id, phoneNumber = "+2348000000000") {
  return {
    id,
    firebaseUid: `firebase:${id}`,
    email: null,
    phoneNumber,
    role: id === AGENT_ID ? "agent" : "sender",
    onboardingStatus: "active",
    displayName: "Test User",
    walletAddress: id === AGENT_ID ? AGENT_WALLET : SENDER_WALLET,
    agentProfile: id === AGENT_ID ? { businessName: "Agent", manualReviewRequired: false } : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
}

function payoutDocument(overrides = {}) {
  const now = new Date("2026-05-10T12:00:00.000Z");

  return {
    _id: new ObjectId(overrides.id ?? "650000000000000000000001"),
    reference: "CN-TEST01",
    senderUserId: new ObjectId(SENDER_ID),
    senderName: "Sender",
    senderPhone: "+2348000000000",
    receiverName: "Receiver",
    receiverPhone: "+2348111111111",
    pickupArea: "Ikeja City Mall, Alausa",
    pickupLocation: "Obafemi Awolowo Way, Alausa, Ikeja, Lagos",
    pickupLatitude: 6.6141,
    pickupLongitude: 3.3571,
    notes: "",
    tokenType: "USDT",
    tokenAmount: 25,
    estimatedLocalAmount: 40500,
    localCurrency: "NGN",
    platformFeeToken: 0.05,
    agentFeeToken: 2.5,
    totalToken: 27.55,
    collectionCode: "123456",
    status: overrides.status ?? "open",
    assignedAgent: overrides.assignedAgent ?? {
      userId: new ObjectId(AGENT_ID),
      name: "Agent",
      phoneNumber: "+2348222222222",
      rating: 4.9,
      transferCount: 3,
      acceptedAt: now,
      distanceKm: 1,
      serviceLocationId: "lagos-ikeja-city-mall",
      serviceZone: "Ikeja City Mall, Alausa",
      serviceAddress: "Obafemi Awolowo Way, Alausa, Ikeja, Lagos",
      serviceLatitude: 6.6141,
      serviceLongitude: 3.3571,
      locationSource: "registered_hub"
    },
    escrow: {
      provider: "solana",
      cluster: "devnet",
      programId: PROGRAM_ID,
      status: overrides.escrowStatus ?? "pending_signature",
      escrowAddress: ESCROW_ADDRESS,
      referenceSeed: "a".repeat(64),
      senderWallet: SENDER_WALLET,
      agentWallet: overrides.agentWallet ?? null,
      amountTokenUnits: 25000000,
      agentFeeTokenUnits: 2500000,
      platformFeeTokenUnits: 50000,
      createdAt: now,
      updatedAt: now
    },
    createdAt: now,
    updatedAt: now,
    ...overrides.document
  };
}

function transaction({ signer, programId = PROGRAM_ID, escrowAddress = ESCROW_ADDRESS, action = "create", err = null } = {}) {
  return {
    meta: { err },
    transaction: {
      message: {
        accountKeys: [signer, escrowAddress, programId, "OtherAccount111111111111111111111111111111"],
        instructions: [{ programId, accounts: [escrowAddress], action }]
      },
      signatures: [signature(action)]
    },
    requiredSigners: [signer]
  };
}

async function seedRequest(document = payoutDocument()) {
  const db = await getMongoDb();
  await db.collection("payout_requests").insertOne(document);
  return document._id.toHexString();
}

async function loadRequest(id) {
  const db = await getMongoDb();
  return db.collection("payout_requests").findOne({ _id: new ObjectId(id) });
}

async function postRecord({ requestId, action = "create", sig = signature("create"), walletAddress = SENDER_WALLET }) {
  const request = new Request(`http://cashnode.test/api/payout-requests/${requestId}/escrow/record`, {
    method: "POST",
    body: JSON.stringify({
      action,
      signature: sig,
      walletAddress,
      escrowAddress: ESCROW_ADDRESS,
      referenceSeed: "a".repeat(64)
    })
  });

  const response = await recordEscrowPost(request, {
    params: Promise.resolve({ requestId })
  });
  const body = await response.json();

  return { response, body };
}

beforeEach(() => {
  __resetMongo();
  __resetSolanaMock();
  __resetAuthSession();
  __setCurrentSessionUser(actorUser(SENDER_ID));
});

describe("escrow signature verification before status advancement", () => {
  it("keeps a missing on-chain signature pending and returns a retryable 202", async () => {
    const requestId = await seedRequest();
    __queueTransactions([null]);

    const { response, body } = await postRecord({ requestId });
    const stored = await loadRequest(requestId);

    assert.equal(response.status, 202);
    assert.equal(body.retryable, true);
    assert.equal(stored.escrow.status, "pending_signature");
    assert.equal(stored.escrow.pendingSignature.signature, signature("create"));
  });

  it("rejects a confirmed failed transaction and leaves status unchanged", async () => {
    const requestId = await seedRequest();
    __queueTransactions([transaction({ signer: SENDER_WALLET, err: { InstructionError: [0, "Custom"] } })]);

    const { response, body } = await postRecord({ requestId });
    const stored = await loadRequest(requestId);

    assert.equal(response.status, 400);
    assert.match(body.error, /failed/i);
    assert.equal(stored.escrow.status, "pending_signature");
  });

  it("rejects a transaction signed by the wrong wallet for sender and agent actions", async () => {
    const cases = [
      { action: "create", actor: SENDER_ID, walletAddress: SENDER_WALLET, escrowStatus: "pending_signature", wrongSigner: AGENT_WALLET },
      { action: "cancel", actor: SENDER_ID, walletAddress: SENDER_WALLET, escrowStatus: "funded", wrongSigner: AGENT_WALLET },
      { action: "accept", actor: AGENT_ID, walletAddress: AGENT_WALLET, escrowStatus: "funded", wrongSigner: SENDER_WALLET },
      { action: "mark_paid", actor: AGENT_ID, walletAddress: AGENT_WALLET, escrowStatus: "accepted", wrongSigner: SENDER_WALLET, agentWallet: AGENT_WALLET }
    ];

    for (const [index, testCase] of cases.entries()) {
      __resetMongo();
      __resetSolanaMock();
      __setCurrentSessionUser(actorUser(testCase.actor));

      const requestId = await seedRequest(
        payoutDocument({
          id: `65000000000000000000010${index}`,
          escrowStatus: testCase.escrowStatus,
          agentWallet: testCase.agentWallet ?? null
        })
      );
      __queueTransactions([transaction({ signer: testCase.wrongSigner, action: testCase.action })]);

      const { response, body } = await postRecord({
        requestId,
        action: testCase.action,
        sig: signature(`bad${index}`),
        walletAddress: testCase.walletAddress
      });
      const stored = await loadRequest(requestId);

      assert.equal(response.status, 400, testCase.action);
      assert.match(body.error, /signer/i, testCase.action);
      assert.equal(stored.escrow.status, testCase.escrowStatus, testCase.action);
    }
  });

  it("rejects a transaction that does not include the expected escrow account or program", async () => {
    const requestId = await seedRequest();
    __queueTransactions([transaction({ signer: SENDER_WALLET, programId: "WrongProgram111111111111111111111111111111" })]);

    const { response, body } = await postRecord({ requestId });
    const stored = await loadRequest(requestId);

    assert.equal(response.status, 400);
    assert.match(body.error, /program|escrow/i);
    assert.equal(stored.escrow.status, "pending_signature");
  });

  it("advances valid transactions through the existing escrow transition rules", async () => {
    const cases = [
      { action: "create", actor: SENDER_ID, walletAddress: SENDER_WALLET, from: "pending_signature", to: "funded", field: "createSignature", signer: SENDER_WALLET, commitment: "confirmed" },
      { action: "accept", actor: AGENT_ID, walletAddress: AGENT_WALLET, from: "funded", to: "accepted", field: "acceptSignature", signer: AGENT_WALLET, commitment: "confirmed" },
      { action: "mark_paid", actor: AGENT_ID, walletAddress: AGENT_WALLET, from: "accepted", to: "paid", field: "markPaidSignature", signer: AGENT_WALLET, agentWallet: AGENT_WALLET, commitment: "confirmed" },
      { action: "complete", actor: SENDER_ID, walletAddress: SENDER_WALLET, from: "paid", to: "completed", field: "completeSignature", signer: SENDER_WALLET, agentWallet: AGENT_WALLET, commitment: "finalized" },
      { action: "cancel", actor: SENDER_ID, walletAddress: SENDER_WALLET, from: "funded", to: "cancelled", field: "cancelSignature", signer: SENDER_WALLET, commitment: "confirmed" }
    ];

    for (const [index, testCase] of cases.entries()) {
      __resetMongo();
      __resetSolanaMock();
      __setCurrentSessionUser(actorUser(testCase.actor));

      const requestId = await seedRequest(
        payoutDocument({
          id: `65000000000000000000020${index}`,
          escrowStatus: testCase.from,
          agentWallet: testCase.agentWallet ?? null
        })
      );
      const sig = signature(`ok${index}`);
      __queueTransactions([transaction({ signer: testCase.signer, action: testCase.action })]);

      const { response } = await postRecord({
        requestId,
        action: testCase.action,
        sig,
        walletAddress: testCase.walletAddress
      });
      const stored = await loadRequest(requestId);
      const [call] = __getTransactionCalls();

      assert.equal(response.status, 200, testCase.action);
      assert.equal(call.options.commitment, testCase.commitment, testCase.action);
      assert.equal(call.options.maxSupportedTransactionVersion, 0, testCase.action);
      assert.equal(stored.escrow.status, testCase.to, testCase.action);
      assert.equal(stored.escrow[testCase.field], sig, testCase.action);
    }
  });

  it("rejects replaying the same signature on a different request or action", async () => {
    const reusedSignature = signature("reuse");
    const firstRequestId = await seedRequest(payoutDocument({ id: "650000000000000000000011" }));
    const secondRequestId = await seedRequest(payoutDocument({ id: "650000000000000000000012" }));
    __queueTransactions([
      transaction({ signer: SENDER_WALLET, action: "create" }),
      transaction({ signer: SENDER_WALLET, action: "create" })
    ]);

    const first = await postRecord({ requestId: firstRequestId, sig: reusedSignature });
    const second = await postRecord({ requestId: secondRequestId, sig: reusedSignature });
    const secondStored = await loadRequest(secondRequestId);

    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 400);
    assert.match(second.body.error, /replay|already used|signature/i);
    assert.equal(secondStored.escrow.status, "pending_signature");

    __resetSolanaMock();
    __setCurrentSessionUser(actorUser(AGENT_ID));
    __queueTransactions([transaction({ signer: AGENT_WALLET, action: "accept" })]);

    const sameRequestDifferentAction = await postRecord({
      requestId: firstRequestId,
      action: "accept",
      sig: reusedSignature,
      walletAddress: AGENT_WALLET
    });

    assert.equal(sameRequestDifferentAction.response.status, 400);
    assert.match(sameRequestDifferentAction.body.error, /already used|signature/i);
  });

  it("keeps RPC errors retryable without marking the signature invalid or advancing status", async () => {
    const requestId = await seedRequest();
    __queueTransactions([new Error("RPC timeout")]);

    const { response, body } = await postRecord({ requestId });
    const stored = await loadRequest(requestId);

    assert.equal(response.status, 202);
    assert.equal(body.retryable, true);
    assert.equal(stored.escrow.status, "pending_signature");
    assert.equal(stored.escrow.pendingSignature.signature, signature("create"));
    assert.equal(stored.escrow.pendingSignature.invalid, undefined);
  });

  it("advances a pending signature exactly once when parallel retries confirm it", async () => {
    const requestId = await seedRequest();
    const pendingSignature = signature("retry");
    __queueTransactions([null]);

    const pending = await postRecord({ requestId, sig: pendingSignature });
    assert.equal(pending.response.status, 202);

    __queueTransactions([
      transaction({ signer: SENDER_WALLET, action: "create" }),
      transaction({ signer: SENDER_WALLET, action: "create" })
    ]);

    const [firstRetry, secondRetry] = await Promise.all([
      postRecord({ requestId, sig: pendingSignature }),
      postRecord({ requestId, sig: pendingSignature })
    ]);
    const stored = await loadRequest(requestId);

    assert.equal(stored.escrow.status, "funded");
    assert.equal(stored.escrow.createSignature, pendingSignature);
    assert.equal([firstRetry.response.status, secondRetry.response.status].filter((status) => status === 200).length, 1);
  });
});
