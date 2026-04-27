import { ObjectId, type Collection, type WithId } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { findPickupLocation } from "@/lib/pickup-locations";

export type UserRole = "sender" | "agent" | "receiver";
export type OnboardingStatus = "new" | "onboarding" | "active";
export type AgentBusinessType = "POS kiosk" | "Mini-mart" | "Agency bank";
export type AgentSettlementRail = "USDC wallet" | "Bank account" | "Mobile money";
export type AgentLockPeriod = "30 days" | "60 days" | "90 days";

type AgentProfileDocument = {
  businessName: string;
  businessType: AgentBusinessType;
  ownerName: string;
  serviceLocationId: string;
  serviceZone: string;
  serviceAddress: string;
  serviceLatitude: number;
  serviceLongitude: number;
  dailyCapacityNgn: number;
  settlementRail: AgentSettlementRail;
  stakeAmountUsd: number;
  lockPeriod: AgentLockPeriod;
  isAvailable: boolean;
  activatedAt: Date;
};

export type AgentProfileInput = {
  businessName?: string;
  businessType?: AgentBusinessType;
  ownerName?: string;
  serviceLocationId?: string;
  serviceZone?: string;
  dailyCapacityNgn?: number | string;
  settlementRail?: AgentSettlementRail;
  stakeAmountUsd?: number | string;
  lockPeriod?: AgentLockPeriod;
  isAvailable?: boolean;
};

type UserDocument = {
  firebaseUid: string;
  phoneNumber: string;
  role: UserRole;
  onboardingStatus: OnboardingStatus;
  displayName?: string;
  walletAddress?: string;
  agentProfile?: AgentProfileDocument;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
};

export type AppAgentProfile = {
  businessName: string;
  businessType: AgentBusinessType;
  ownerName: string;
  serviceLocationId: string;
  serviceZone: string;
  serviceAddress: string;
  serviceLatitude: number;
  serviceLongitude: number;
  dailyCapacityNgn: number;
  settlementRail: AgentSettlementRail;
  stakeAmountUsd: number;
  lockPeriod: AgentLockPeriod;
  isAvailable: boolean;
  activatedAt: string;
};

export type AppUser = {
  id: string;
  firebaseUid: string;
  phoneNumber: string;
  role: UserRole;
  onboardingStatus: OnboardingStatus;
  displayName: string;
  walletAddress: string | null;
  agentProfile: AppAgentProfile | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};

const COLLECTION_NAME = "users";
let userIndexSetupPromise: Promise<void> | null = null;

async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const db = await getMongoDb();
  const collection = db.collection<UserDocument>(COLLECTION_NAME);

  if (!userIndexSetupPromise) {
    userIndexSetupPromise = collection
      .createIndexes([
        { key: { firebaseUid: 1 }, name: "firebase_uid_unique", unique: true },
        { key: { phoneNumber: 1 }, name: "phone_number_lookup", unique: true },
        { key: { role: 1, updatedAt: -1 }, name: "role_updated_lookup" }
      ])
      .then(() => undefined);
  }

  await userIndexSetupPromise;
  return collection;
}

function ensureObjectId(userId: string) {
  if (!ObjectId.isValid(userId)) {
    throw new Error("Invalid user id.");
  }

  return new ObjectId(userId);
}

function toAppAgentProfile(agentProfile?: AgentProfileDocument): AppAgentProfile | null {
  if (!agentProfile) {
    return null;
  }

  return {
    businessName: agentProfile.businessName,
    businessType: agentProfile.businessType,
    ownerName: agentProfile.ownerName,
    serviceLocationId: agentProfile.serviceLocationId,
    serviceZone: agentProfile.serviceZone,
    serviceAddress: agentProfile.serviceAddress,
    serviceLatitude: agentProfile.serviceLatitude,
    serviceLongitude: agentProfile.serviceLongitude,
    dailyCapacityNgn: agentProfile.dailyCapacityNgn,
    settlementRail: agentProfile.settlementRail,
    stakeAmountUsd: agentProfile.stakeAmountUsd,
    lockPeriod: agentProfile.lockPeriod,
    isAvailable: agentProfile.isAvailable,
    activatedAt: agentProfile.activatedAt.toISOString()
  };
}

function toAppUser(document: WithId<UserDocument>): AppUser {
  return {
    id: document._id.toHexString(),
    firebaseUid: document.firebaseUid,
    phoneNumber: document.phoneNumber,
    role: document.role,
    onboardingStatus: document.onboardingStatus,
    displayName: document.displayName ?? "",
    walletAddress: document.walletAddress ?? null,
    agentProfile: toAppAgentProfile(document.agentProfile),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    lastLoginAt: document.lastLoginAt.toISOString()
  };
}

function ensureRole(value: unknown): UserRole {
  if (value !== "sender" && value !== "agent" && value !== "receiver") {
    throw new Error("A valid role is required.");
  }

  return value;
}

function deriveDisplayName(phoneNumber: string, role: UserRole) {
  const suffix = role === "sender" ? "Sender" : role === "agent" ? "Agent" : "Receiver";
  return `${phoneNumber.slice(0, 4)} ${suffix}`;
}

function ensureRequiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function ensureAgentBusinessType(value: unknown): AgentBusinessType {
  const normalizedValue = ensureRequiredText(value, "Business type");

  if (normalizedValue !== "POS kiosk" && normalizedValue !== "Mini-mart" && normalizedValue !== "Agency bank") {
    throw new Error("Unsupported business type.");
  }

  return normalizedValue;
}

function ensureAgentSettlementRail(value: unknown): AgentSettlementRail {
  const normalizedValue = ensureRequiredText(value, "Settlement rail");

  if (normalizedValue !== "USDC wallet" && normalizedValue !== "Bank account" && normalizedValue !== "Mobile money") {
    throw new Error("Unsupported settlement rail.");
  }

  return normalizedValue;
}

function ensureAgentLockPeriod(value: unknown): AgentLockPeriod {
  const normalizedValue = ensureRequiredText(value, "Stake lock period");

  if (normalizedValue !== "30 days" && normalizedValue !== "60 days" && normalizedValue !== "90 days") {
    throw new Error("Unsupported stake lock period.");
  }

  return normalizedValue;
}

function normalizeCurrencyAmount(value: unknown, label: string) {
  const rawValue =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value
        : "";
  const normalizedValue = rawValue.replace(/[^0-9.]/g, "");
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} must be a valid positive amount.`);
  }

  return Math.round(parsedValue * 100) / 100;
}

function buildAgentProfile(input: AgentProfileInput, existingProfile?: AgentProfileDocument): AgentProfileDocument {
  const businessName = ensureRequiredText(input.businessName, "Business name");
  const ownerName = ensureRequiredText(input.ownerName, "Owner name");
  const businessType = ensureAgentBusinessType(input.businessType);
  const settlementRail = ensureAgentSettlementRail(input.settlementRail);
  const stakeAmountUsd = normalizeCurrencyAmount(input.stakeAmountUsd, "Stake amount");
  const dailyCapacityNgn = Math.round(normalizeCurrencyAmount(input.dailyCapacityNgn, "Daily cash capacity"));
  const lockPeriod = ensureAgentLockPeriod(input.lockPeriod);
  const serviceLocation = findPickupLocation(input.serviceLocationId ?? input.serviceZone ?? "");

  if (!serviceLocation) {
    throw new Error("Select a valid primary pickup hub for this agent.");
  }

  return {
    businessName,
    ownerName,
    businessType,
    serviceLocationId: serviceLocation.id,
    serviceZone: serviceLocation.area,
    serviceAddress: serviceLocation.address,
    serviceLatitude: serviceLocation.latitude,
    serviceLongitude: serviceLocation.longitude,
    dailyCapacityNgn,
    settlementRail,
    stakeAmountUsd,
    lockPeriod,
    isAvailable: input.isAvailable !== false,
    activatedAt: existingProfile?.activatedAt ?? new Date()
  };
}

export async function getUserByFirebaseUid(firebaseUid: string) {
  const collection = await getUsersCollection();
  const document = await collection.findOne({ firebaseUid });
  return document ? toAppUser(document) : null;
}

export async function getUserById(userId: string) {
  const collection = await getUsersCollection();
  const document = await collection.findOne({ _id: ensureObjectId(userId) });
  return document ? toAppUser(document) : null;
}

export async function getUserByPhoneAndRole(phoneNumber: string, role: UserRole) {
  const collection = await getUsersCollection();
  const document = await collection.findOne({ phoneNumber, role });
  return document ? toAppUser(document) : null;
}

export async function listActiveAgentUsers() {
  const collection = await getUsersCollection();
  const documents = await collection
    .find({
      role: "agent",
      onboardingStatus: "active",
      "agentProfile.isAvailable": true
    })
    .sort({ updatedAt: -1 })
    .toArray();

  return documents.map(toAppUser);
}

export async function upsertUserFromFirebaseLogin(input: {
  firebaseUid: string;
  phoneNumber: string;
  requestedRole: UserRole;
}) {
  const collection = await getUsersCollection();
  const now = new Date();
  const requestedRole = ensureRole(input.requestedRole);

  let existingUser = await collection.findOne({ firebaseUid: input.firebaseUid });

  if (!existingUser) {
    existingUser = await collection.findOne({ phoneNumber: input.phoneNumber });
  }

  if (!existingUser) {
    const insertResult = await collection.insertOne({
      firebaseUid: input.firebaseUid,
      phoneNumber: input.phoneNumber,
      role: requestedRole,
      onboardingStatus: "new",
      displayName: deriveDisplayName(input.phoneNumber, requestedRole),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    });

    const createdUser = await collection.findOne({ _id: insertResult.insertedId });

    if (!createdUser) {
      throw new Error("Failed to create the user record.");
    }

    return toAppUser(createdUser);
  }

  await collection.updateOne(
    { _id: existingUser._id },
    {
      $set: {
        firebaseUid: input.firebaseUid,
        phoneNumber: input.phoneNumber,
        updatedAt: now,
        lastLoginAt: now
      }
    }
  );

  const updatedUser = await collection.findOne({ _id: existingUser._id });

  if (!updatedUser) {
    throw new Error("Failed to update the user record.");
  }

  return toAppUser(updatedUser);
}

export async function updateUserProfile(input: {
  userId: string;
  displayName?: string;
  walletAddress?: string | null;
  onboardingStatus?: OnboardingStatus;
  agentProfile?: AgentProfileInput;
}) {
  const collection = await getUsersCollection();
  const now = new Date();
  const _id = ensureObjectId(input.userId);
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("User record not found.");
  }

  const nextDisplayName =
    typeof input.displayName === "string" && input.displayName.trim()
      ? input.displayName.trim()
      : document.displayName ?? "";
  const nextWalletAddress =
    input.walletAddress === undefined ? document.walletAddress : input.walletAddress?.trim() || undefined;
  const nextOnboardingStatus =
    input.onboardingStatus === "new" || input.onboardingStatus === "onboarding" || input.onboardingStatus === "active"
      ? input.onboardingStatus
      : document.onboardingStatus;
  const nextAgentProfile =
    input.agentProfile !== undefined
      ? buildAgentProfile(input.agentProfile, document.agentProfile)
      : document.agentProfile;

  await collection.updateOne(
    { _id },
    {
      $set: {
        displayName: nextDisplayName,
        walletAddress: nextWalletAddress,
        onboardingStatus: nextOnboardingStatus,
        ...(nextAgentProfile ? { agentProfile: nextAgentProfile } : {}),
        updatedAt: now
      }
    }
  );

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to update the user profile.");
  }

  return toAppUser(updatedDocument);
}
