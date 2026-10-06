import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ObjectId, getMongoDb, __resetMongo } from "mongodb";
import { __resetSolanaMock } from "./fakes/solana-web3.mjs";
import { getAgentPresenceByUserId, upsertAgentPresenceOnline } from "../lib/agent-presence.ts";
import { previewNearestEligibleAgentForPickup } from "../lib/payout-requests.ts";

const IKEJA = {
  id: "lagos-ikeja-city-mall",
  area: "Ikeja City Mall, Alausa",
  address: "Obafemi Awolowo Way, Alausa, Ikeja, Lagos",
  latitude: 6.6141,
  longitude: 3.3571
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

function agentUserDocument(input) {
  const now = new Date("2026-05-10T12:00:00.000Z");

  return {
    _id: new ObjectId(input.id),
    firebaseUid: `firebase:${input.id}`,
    phoneNumber: input.phoneNumber,
    role: "agent",
    onboardingStatus: "active",
    displayName: input.name,
    walletAddress: `${input.name.replace(/\s+/g, "")}Wallet111111111111111111111111111`,
    agentProfile: {
      businessName: input.name,
      businessType: "POS kiosk",
      ownerName: input.name,
      serviceLocationId: input.location.id,
      serviceZone: input.location.area,
      serviceAddress: input.location.address,
      serviceLatitude: input.location.latitude,
      serviceLongitude: input.location.longitude,
      dailyCapacityNgn: 500000,
      maxSinglePayoutNgn: 250000,
      manualReviewRequired: false,
      settlementRail: "Bank account",
      settlementBankCode: "044",
      settlementBankName: "Access Bank",
      settlementAccountNumber: "0123456789",
      settlementAccountName: input.name,
      isAvailable: true,
      activatedAt: now
    },
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };
}

async function seedAgent(input) {
  const db = await getMongoDb();
  await db.collection("users").insertOne(agentUserDocument(input));
}

beforeEach(() => {
  __resetMongo();
  __resetSolanaMock();
});

describe("geo agent matching", () => {
  it("stores and backfills GeoJSON as [lng, lat] using real Nigerian coordinates", async () => {
    const userId = "64f000000000000000000031";
    const db = await getMongoDb();
    await db.collection("agent_presence").insertOne({
      userId: new ObjectId(userId),
      isOnline: true,
      latitude: IKEJA.latitude,
      longitude: IKEJA.longitude,
      source: "browser",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      onlineSince: new Date()
    });

    await getAgentPresenceByUserId(userId);
    await getAgentPresenceByUserId(userId);
    let stored = await db.collection("agent_presence").findOne({ userId: new ObjectId(userId) });

    assert.deepEqual(stored.location, {
      type: "Point",
      coordinates: [IKEJA.longitude, IKEJA.latitude]
    });

    await upsertAgentPresenceOnline({
      userId,
      latitude: ABUJA.latitude,
      longitude: ABUJA.longitude
    });
    stored = await db.collection("agent_presence").findOne({ userId: new ObjectId(userId) });

    assert.deepEqual(stored.location.coordinates, [ABUJA.longitude, ABUJA.latitude]);
  });

  it("keeps the 180s stale-presence filter in the geo query and falls back to registered hub coordinates", async () => {
    const lagosFallbackAgentId = "64f000000000000000000041";
    const abujaAgentId = "64f000000000000000000042";
    const db = await getMongoDb();

    await seedAgent({
      id: lagosFallbackAgentId,
      phoneNumber: "+2348000000041",
      name: "Lagos Fallback Agent",
      location: TEJUOSHO
    });
    await seedAgent({
      id: abujaAgentId,
      phoneNumber: "+2348000000042",
      name: "Abuja Hub Agent",
      location: ABUJA
    });

    await db.collection("agent_presence").insertOne({
      userId: new ObjectId(abujaAgentId),
      isOnline: true,
      latitude: IKEJA.latitude,
      longitude: IKEJA.longitude,
      location: {
        type: "Point",
        coordinates: [IKEJA.longitude, IKEJA.latitude]
      },
      source: "browser",
      createdAt: new Date(Date.now() - 600000),
      updatedAt: new Date(Date.now() - 600000),
      lastSeenAt: new Date(Date.now() - 600000),
      onlineSince: new Date(Date.now() - 600000)
    });

    const preview = await previewNearestEligibleAgentForPickup({
      pickupArea: IKEJA.id,
      tokenAmount: 25,
      tokenType: "USDT"
    });
    const presenceCollection = db.collection("agent_presence");
    const geoQuery = presenceCollection.__lastFindFilter;

    assert.equal(preview.nearestAgent.name, "Lagos Fallback Agent");
    assert.deepEqual(geoQuery.location.$near.$geometry.coordinates, [IKEJA.longitude, IKEJA.latitude]);
    assert.ok(geoQuery.lastSeenAt.$gte instanceof Date);
  });

  it("creates agent presence geo indexes safely on startup", async () => {
    const userId = "64f000000000000000000051";
    const db = await getMongoDb();

    await upsertAgentPresenceOnline({
      userId,
      latitude: IKEJA.latitude,
      longitude: IKEJA.longitude
    });

    const indexNames = db.collection("agent_presence").__indexes.map((index) => index.name);

    assert.ok(indexNames.includes("user_id_unique"));
    assert.ok(indexNames.includes("online_last_seen_lookup"));
    assert.ok(indexNames.includes("location_2dsphere"));
  });
});
