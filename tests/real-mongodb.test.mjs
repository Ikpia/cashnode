import assert from "node:assert/strict";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ObjectId } from "mongodb-real";
import { __queueTransactions, __resetSolanaMock } from "./fakes/solana-web3.mjs";

process.env.MONGOMS_DOWNLOAD_DIR = path.join(process.cwd(), ".mongodb-binaries");

const PROGRAM_ID = "CashNodeEscrow111111111111111111111111111111";
const SENDER_ID = "64f000000000000000001001";
const AGENT_A_ID = "64f000000000000000001101";
const AGENT_B_ID = "64f000000000000000001102";
const SENDER_WALLET = "SenderWallet1111111111111111111111111111111";
const AGENT_WALLET = "AgentWallet11111111111111111111111111111111";
const ESCROW_ADDRESS = "EscrowPda11111111111111111111111111111111";

const IKEJA = {
  id: "lagos-ikeja-city-mall",
  area: "Ikeja City Mall, Alausa",
  address: "Obafemi Awolowo Way, Alausa, Ikeja, Lagos",
  latitude: 6.6141,
  longitude: 3.3571
};
const BENIN = {
  id: "edo-benin-obamarket",
  area: "Oba Market, Benin City",
  address: "Ring Road, Benin City, Edo",
  latitude: 6.3382,
  longitude: 5.6257
};
const ABUJA = {
  id: "fct-wuse-market",
  area: "Wuse Market, Abuja",
  address: "Sani Abacha Way, Wuse Zone 5, Abuja",
  latitude: 9.0765,
  longitude: 7.4951
};
const TEJUOSHO = {
  id: "lagos-tejuosho",
  area: "Tejuosho Shopping Complex, Yaba",
  address: "Ojuelegba Road, Yaba, Lagos",
  latitude: 6.50885,
  longitude: 3.36968
};

let mongoServer;
let testCounter = 0;
let adapter;

function objectId(value) {
  return new ObjectId(value);
}

function isoNow() {
  return new Date("2026-05-10T12:00:00.000Z");
}

function appUser(input) {
  const now = isoNow().toISOString();
  const agentProfile = input.role === "agent" ? agentProfileDocument(input) : null;

  return {
    id: input.id,
    firebaseUid: `firebase:${input.id}`,
    email: null,
    phoneNumber: input.phoneNumber,
    role: input.role,
    onboardingStatus: "active",
    displayName: input.name,
    walletAddress: input.walletAddress ?? null,
    agentProfile,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };
}

function agentProfileDocument(input) {
  const location = input.location ?? IKEJA;

  return {
    businessName: input.name,
    businessType: "POS kiosk",
    ownerName: input.name,
    serviceLocationId: location.id,
    serviceZone: location.area,
    serviceAddress: location.address,
    serviceLatitude: location.latitude,
    serviceLongitude: location.longitude,
    dailyCapacityNgn: input.dailyCapacityNgn ?? 500000,
    maxSinglePayoutNgn: input.maxSinglePayoutNgn ?? 250000,
    manualReviewRequired: input.manualReviewRequired ?? false,
    settlementRail: "Bank account",
    settlementBankCode: "044",
    settlementBankName: "Access Bank",
    settlementAccountNumber: "0123456789",
    settlementAccountName: input.name,
    isAvailable: input.isAvailable ?? true,
    activatedAt: isoNow()
  };
}

function userDocument(input) {
  const now = isoNow();
  const document = {
    _id: objectId(input.id),
    firebaseUid: `firebase:${input.id}`,
    phoneNumber: input.phoneNumber,
    role: input.role ?? "agent",
    onboardingStatus: input.onboardingStatus ?? "active",
    displayName: input.name,
    walletAddress: input.walletAddress,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };

  if ((input.role ?? "agent") === "agent") {
    document.agentProfile = agentProfileDocument(input);
  }

  return document;
}

function presenceDocument(input) {
  const seenAt = input.lastSeenAt ?? new Date();

  return {
    userId: objectId(input.userId),
    isOnline: input.isOnline ?? true,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    location: {
      type: "Point",
      coordinates: [input.location.longitude, input.location.latitude]
    },
    source: "browser",
    createdAt: seenAt,
    updatedAt: seenAt,
    lastSeenAt: seenAt,
    onlineSince: seenAt
  };
}

function assignedAgentSnapshot(input) {
  const location = input.location ?? IKEJA;

  return {
    userId: objectId(input.id),
    name: input.name,
    phoneNumber: input.phoneNumber,
    rating: 4.9,
    transferCount: 0,
    acceptedAt: isoNow(),
    distanceKm: 1,
    serviceLocationId: location.id,
    serviceZone: location.area,
    serviceAddress: location.address,
    serviceLatitude: location.latitude,
    serviceLongitude: location.longitude,
    locationSource: "registered_hub"
  };
}

function payoutDocument(overrides = {}) {
  const now = isoNow();

  return {
    _id: objectId(overrides.id ?? "650000000000000000001001"),
    reference: overrides.reference ?? "CN-REAL01",
    senderUserId: objectId(overrides.senderUserId ?? SENDER_ID),
    senderName: "Sender",
    senderPhone: "+2348000001001",
    receiverName: "Receiver",
    receiverPhone: overrides.receiverPhone ?? "+2348111111001",
    pickupArea: overrides.pickupArea ?? IKEJA.area,
    pickupLocation: overrides.pickupLocation ?? IKEJA.address,
    pickupLatitude: overrides.pickupLatitude ?? IKEJA.latitude,
    pickupLongitude: overrides.pickupLongitude ?? IKEJA.longitude,
    notes: "",
    tokenType: "USDT",
    tokenAmount: overrides.tokenAmount ?? 50,
    estimatedLocalAmount: overrides.estimatedLocalAmount ?? 77500,
    localCurrency: "NGN",
    platformFeeToken: 0.1,
    agentFeeToken: 2.5,
    totalToken: 52.6,
    collectionCode: "123456",
    status: overrides.status ?? "open",
    assignedAgent: overrides.assignedAgent,
    excludedAgentUserIds: overrides.excludedAgentUserIds,
    escrow: overrides.escrow,
    createdAt: now,
    updatedAt: now
  };
}

function signature(label) {
  return `${label.replace(/[^A-Za-z1-9]/g, "A")}${"1".repeat(88)}`.slice(0, 88);
}

function transaction({ signer = SENDER_WALLET, action = "create" } = {}) {
  return {
    meta: { err: null },
    transaction: {
      message: {
        accountKeys: [signer, ESCROW_ADDRESS, PROGRAM_ID, "OtherAccount111111111111111111111111111111"],
        instructions: [{ programId: PROGRAM_ID, accounts: [ESCROW_ADDRESS], action }]
      },
      signatures: [signature(action)]
    },
    requiredSigners: [signer]
  };
}

function escrowDocument(status = "pending_signature") {
  return {
    provider: "solana",
    cluster: "devnet",
    programId: PROGRAM_ID,
    status,
    escrowAddress: ESCROW_ADDRESS,
    referenceSeed: "a".repeat(64),
    senderWallet: SENDER_WALLET,
    agentWallet: null,
    amountTokenUnits: 50000000,
    agentFeeTokenUnits: 2500000,
    platformFeeTokenUnits: 100000,
    createdAt: isoNow(),
    updatedAt: isoNow()
  };
}

async function loadRealModules(cacheKey) {
  const payoutRequests = await import(`../lib/payout-requests.ts?real-mongo=${cacheKey}`);
  const agentPresence = await import(`../lib/agent-presence.ts?real-mongo=${cacheKey}`);
  return { payoutRequests, agentPresence };
}

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      launchTimeout: 60000
    }
  });
});

after(async () => {
  if (adapter) {
    await adapter.__closeRealMongoConnection();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  testCounter += 1;
  __resetSolanaMock();
  adapter = await import(`./real-mongodb-adapter.mjs?real-mongo=${testCounter}`);
  adapter.__setRealMongoConnection({
    uri: mongoServer.getUri(),
    dbName: `cashnode_real_${testCounter}`
  });
});

describe("real MongoDB safeguards", () => {
  it("uses real 2dsphere $near ordering while filtering excluded, over-capacity, and stale agents", async () => {
    const { payoutRequests } = await loadRealModules(testCounter);
    const db = await adapter.getMongoDb();
    const badAssignedId = "64f000000000000000001201";
    const lagosExcludedId = "64f000000000000000001202";
    const overCapacityId = "64f000000000000000001203";
    const stalePresenceId = "64f000000000000000001204";
    const beninId = "64f000000000000000001205";
    const abujaId = "64f000000000000000001206";
    const requestId = "650000000000000000001101";

    await db.collection("users").insertMany([
      userDocument({ id: badAssignedId, phoneNumber: "+2348000001201", name: "Unavailable Agent", location: IKEJA, isAvailable: false }),
      userDocument({ id: lagosExcludedId, phoneNumber: "+2348000001202", name: "Excluded Lagos Agent", location: IKEJA }),
      userDocument({ id: overCapacityId, phoneNumber: "+2348000001203", name: "Over Capacity Agent", location: TEJUOSHO }),
      userDocument({ id: stalePresenceId, phoneNumber: "+2348000001204", name: "Stale Abuja Agent", location: ABUJA }),
      userDocument({ id: beninId, phoneNumber: "+2348000001205", name: "Benin Live Agent", location: BENIN }),
      userDocument({ id: abujaId, phoneNumber: "+2348000001206", name: "Abuja Live Agent", location: ABUJA })
    ]);
    await db.collection("agent_presence").insertMany([
      presenceDocument({ userId: lagosExcludedId, location: IKEJA }),
      presenceDocument({ userId: overCapacityId, location: TEJUOSHO }),
      presenceDocument({ userId: stalePresenceId, location: IKEJA, lastSeenAt: new Date(Date.now() - 600000) }),
      presenceDocument({ userId: beninId, location: BENIN }),
      presenceDocument({ userId: abujaId, location: ABUJA })
    ]);
    await db.collection("payout_requests").insertMany([
      payoutDocument({
        id: requestId,
        status: "accepted",
        assignedAgent: assignedAgentSnapshot({
          id: badAssignedId,
          name: "Unavailable Agent",
          phoneNumber: "+2348000001201",
          location: IKEJA
        }),
        excludedAgentUserIds: [objectId(lagosExcludedId)]
      }),
      payoutDocument({
        id: "650000000000000000001102",
        status: "accepted",
        assignedAgent: assignedAgentSnapshot({
          id: overCapacityId,
          name: "Over Capacity Agent",
          phoneNumber: "+2348000001203",
          location: TEJUOSHO
        }),
        estimatedLocalAmount: 490000
      })
    ]);

    const refreshed = await payoutRequests.getPayoutRequestById(requestId);

    assert.equal(refreshed.assignedAgent.name, "Benin Live Agent");
    assert.equal(refreshed.assignedAgent.locationSource, "live_presence");
  });

  it("falls back to registered hub coordinates when fresh live presence is missing", async () => {
    const { payoutRequests } = await loadRealModules(testCounter);
    const db = await adapter.getMongoDb();
    const lagosFallbackId = "64f000000000000000001211";
    const staleAbujaId = "64f000000000000000001212";

    await db.collection("users").insertMany([
      userDocument({ id: lagosFallbackId, phoneNumber: "+2348000001211", name: "Lagos Hub Fallback", location: TEJUOSHO }),
      userDocument({ id: staleAbujaId, phoneNumber: "+2348000001212", name: "Stale Abuja Agent", location: ABUJA })
    ]);
    await db.collection("agent_presence").insertOne(
      presenceDocument({ userId: staleAbujaId, location: IKEJA, lastSeenAt: new Date(Date.now() - 600000) })
    );

    const preview = await payoutRequests.previewNearestEligibleAgentForPickup({
      pickupArea: IKEJA.id,
      tokenAmount: 50,
      tokenType: "USDT"
    });

    assert.equal(preview.nearestAgent.name, "Lagos Hub Fallback");
  });

  it("backfills only valid legacy coordinates before creating the 2dsphere index", async () => {
    const { agentPresence } = await loadRealModules(testCounter);
    const db = await adapter.getMongoDb();
    const validUserId = "64f000000000000000001221";
    const badLatitudeUserId = "64f000000000000000001222";
    const badLongitudeUserId = "64f000000000000000001223";
    const stringCoordinateUserId = "64f000000000000000001224";
    const now = new Date();

    await db.collection("agent_presence").insertMany([
      {
        userId: objectId(validUserId),
        isOnline: true,
        latitude: IKEJA.latitude,
        longitude: IKEJA.longitude,
        source: "browser",
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        onlineSince: now
      },
      {
        userId: objectId(badLatitudeUserId),
        isOnline: true,
        latitude: 999,
        longitude: IKEJA.longitude,
        source: "browser",
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        onlineSince: now
      },
      {
        userId: objectId(badLongitudeUserId),
        isOnline: true,
        latitude: IKEJA.latitude,
        longitude: 999,
        source: "browser",
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        onlineSince: now
      },
      {
        userId: objectId(stringCoordinateUserId),
        isOnline: true,
        latitude: String(IKEJA.latitude),
        longitude: IKEJA.longitude,
        source: "browser",
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        onlineSince: now
      }
    ]);

    await agentPresence.getAgentPresenceByUserId(validUserId);
    const documents = await db.collection("agent_presence").find({}).toArray();
    const byUserId = new Map(documents.map((document) => [document.userId.toHexString(), document]));
    const indexNames = (await db.collection("agent_presence").indexes()).map((index) => index.name);

    assert.deepEqual(byUserId.get(validUserId).location.coordinates, [IKEJA.longitude, IKEJA.latitude]);
    assert.equal(byUserId.get(badLatitudeUserId).location, undefined);
    assert.equal(byUserId.get(badLongitudeUserId).location, undefined);
    assert.equal(byUserId.get(stringCoordinateUserId).location, undefined);
    assert.ok(indexNames.includes("location_2dsphere"));
  });

  it("stores GeoJSON as [lng, lat] with real Nigerian coordinates", async () => {
    const { agentPresence } = await loadRealModules(testCounter);
    const db = await adapter.getMongoDb();
    const userId = "64f000000000000000001231";

    await agentPresence.upsertAgentPresenceOnline({
      userId,
      latitude: ABUJA.latitude,
      longitude: ABUJA.longitude
    });
    const stored = await db.collection("agent_presence").findOne({ userId: objectId(userId) });

    assert.deepEqual(stored.location, {
      type: "Point",
      coordinates: [ABUJA.longitude, ABUJA.latitude]
    });
  });

  it("uses the real unique signature index to reject replayed escrow signatures", async () => {
    const { payoutRequests } = await loadRealModules(testCounter);
    const db = await adapter.getMongoDb();
    const reusedSignature = signature("realReplay");
    const firstRequestId = "650000000000000000001201";
    const secondRequestId = "650000000000000000001202";
    const sender = appUser({
      id: SENDER_ID,
      phoneNumber: "+2348000001001",
      name: "Sender",
      role: "sender",
      walletAddress: SENDER_WALLET
    });

    await db.collection("payout_requests").insertMany([
      payoutDocument({ id: firstRequestId, escrow: escrowDocument() }),
      payoutDocument({ id: secondRequestId, reference: "CN-REAL02", escrow: escrowDocument() })
    ]);
    __queueTransactions([transaction(), transaction()]);

    const results = await Promise.allSettled([
      payoutRequests.recordPayoutEscrowSignature({
        requestId: firstRequestId,
        actorUser: sender,
        action: "create",
        signature: reusedSignature,
        walletAddress: SENDER_WALLET
      }),
      payoutRequests.recordPayoutEscrowSignature({
        requestId: secondRequestId,
        actorUser: sender,
        action: "create",
        signature: reusedSignature,
        walletAddress: SENDER_WALLET
      })
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(await db.collection("escrow_signature_records").countDocuments({ signature: reusedSignature }), 1);
  });

  it("allows exactly one agent to accept the same open request across 10 parallel attempts", async () => {
    const { payoutRequests } = await loadRealModules(testCounter);
    const db = await adapter.getMongoDb();
    const requestId = "650000000000000000001301";
    const firstAgent = appUser({
      id: AGENT_A_ID,
      phoneNumber: "+2348000001101",
      name: "Parallel Agent A",
      role: "agent",
      location: IKEJA,
      walletAddress: AGENT_WALLET
    });
    const secondAgent = appUser({
      id: AGENT_B_ID,
      phoneNumber: "+2348000001102",
      name: "Parallel Agent B",
      role: "agent",
      location: TEJUOSHO,
      walletAddress: "AgentBWallet111111111111111111111111111111"
    });

    await db.collection("payout_requests").insertOne(payoutDocument({ id: requestId, status: "open" }));

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        payoutRequests.acceptPayoutRequest({
          requestId,
          agentUser: index % 2 === 0 ? firstAgent : secondAgent
        })
      )
    );
    const stored = await db.collection("payout_requests").findOne({ _id: objectId(requestId) });

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 9);
    assert.equal(stored.status, "accepted");
    assert.ok([AGENT_A_ID, AGENT_B_ID].includes(stored.assignedAgent.userId.toHexString()));
  });
});
