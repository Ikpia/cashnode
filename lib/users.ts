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
  serviceLocationDetail?: string;
  serviceZone: string;
  serviceAddress: string;
  serviceLatitude: number;
  serviceLongitude: number;
  dailyCapacityNgn: number;
  maxSinglePayoutNgn: number;
  manualReviewRequired: boolean;
  settlementRail: AgentSettlementRail;
  settlementBankCode?: string;
  settlementBankName?: string;
  settlementAccountNumber?: string;
  settlementAccountName?: string;
  paystackRecipientCode?: string;
  stakeAmountUsd?: number;
  lockPeriod?: AgentLockPeriod;
  isAvailable: boolean;
  activatedAt: Date;
};

export type AgentProfileInput = {
  businessName?: string;
  businessType?: AgentBusinessType;
  ownerName?: string;
  serviceLocationId?: string;
  serviceLocationDetail?: string;
  serviceZone?: string;
  dailyCapacityNgn?: number | string;
  maxSinglePayoutNgn?: number | string;
  manualReviewRequired?: boolean;
  settlementRail?: AgentSettlementRail;
  settlementBankCode?: string;
  settlementBankName?: string;
  settlementAccountNumber?: string;
  settlementAccountName?: string;
  paystackRecipientCode?: string | null;
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
  serviceLocationDetail: string | null;
  serviceZone: string;
  serviceAddress: string;
  serviceLatitude: number;
  serviceLongitude: number;
  dailyCapacityNgn: number;
  maxSinglePayoutNgn: number;
  manualReviewRequired: boolean;
  settlementRail: AgentSettlementRail;
  settlementBankCode: string | null;
  settlementBankName: string | null;
  settlementAccountNumber: string | null;
  settlementAccountName: string | null;
  paystackRecipientCode: string | null;
  stakeAmountUsd: number | null;
  lockPeriod: AgentLockPeriod | null;
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
    serviceLocationDetail: agentProfile.serviceLocationDetail ?? null,
    serviceZone: agentProfile.serviceZone,
    serviceAddress: agentProfile.serviceAddress,
    serviceLatitude: agentProfile.serviceLatitude,
    serviceLongitude: agentProfile.serviceLongitude,
    dailyCapacityNgn: agentProfile.dailyCapacityNgn,
    maxSinglePayoutNgn: agentProfile.maxSinglePayoutNgn ?? agentProfile.dailyCapacityNgn,
    manualReviewRequired: agentProfile.manualReviewRequired === true,
    settlementRail: agentProfile.settlementRail,
    settlementBankCode: agentProfile.settlementBankCode ?? null,
    settlementBankName: agentProfile.settlementBankName ?? null,
    settlementAccountNumber: agentProfile.settlementAccountNumber ?? null,
    settlementAccountName: agentProfile.settlementAccountName ?? null,
    paystackRecipientCode: agentProfile.paystackRecipientCode ?? null,
    stakeAmountUsd: typeof agentProfile.stakeAmountUsd === "number" ? agentProfile.stakeAmountUsd : null,
    lockPeriod: agentProfile.lockPeriod ?? null,
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

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function normalizeBankCode(value: unknown) {
  const normalizedValue = normalizeOptionalText(value).replace(/\s+/g, "");

  if (!normalizedValue) {
    return "";
  }

  if (!/^[0-9A-Za-z]{2,10}$/.test(normalizedValue)) {
    throw new Error("Settlement bank code is invalid.");
  }

  return normalizedValue;
}

function normalizeAccountNumber(value: unknown) {
  const normalizedValue = normalizeOptionalText(value).replace(/\s+/g, "");

  if (!normalizedValue) {
    return "";
  }

  if (!/^\d{6,16}$/.test(normalizedValue)) {
    throw new Error("Settlement account number must be 6-16 digits.");
  }

  return normalizedValue;
}

function buildAgentProfile(input: AgentProfileInput, existingProfile?: AgentProfileDocument): AgentProfileDocument {
  const businessName = ensureRequiredText(input.businessName, "Business name");
  const ownerName = ensureRequiredText(input.ownerName, "Owner name");
  const businessType = ensureAgentBusinessType(input.businessType);
  const settlementRail = input.settlementRail
    ? ensureAgentSettlementRail(input.settlementRail)
    : existingProfile?.settlementRail ?? "Bank account";
  const settlementBankCode = normalizeBankCode(input.settlementBankCode ?? existingProfile?.settlementBankCode ?? "");
  const settlementBankName = normalizeOptionalText(input.settlementBankName ?? existingProfile?.settlementBankName ?? "");
  const settlementAccountNumber = normalizeAccountNumber(
    input.settlementAccountNumber ?? existingProfile?.settlementAccountNumber ?? ""
  );
  const settlementAccountName = normalizeOptionalText(input.settlementAccountName ?? existingProfile?.settlementAccountName ?? "");
  const paystackRecipientCode = normalizeOptionalText(input.paystackRecipientCode ?? existingProfile?.paystackRecipientCode ?? "");
  const serviceLocationDetail = normalizeOptionalText(input.serviceLocationDetail ?? existingProfile?.serviceLocationDetail ?? "");
  const dailyCapacityNgn = Math.round(normalizeCurrencyAmount(input.dailyCapacityNgn, "Daily cash capacity"));
  const maxSinglePayoutNgn = Math.round(
    normalizeCurrencyAmount(input.maxSinglePayoutNgn ?? existingProfile?.maxSinglePayoutNgn ?? dailyCapacityNgn, "Max single payout")
  );
  const manualReviewRequired = normalizeBoolean(input.manualReviewRequired, existingProfile?.manualReviewRequired ?? false);
  const stakeAmountUsd =
    input.stakeAmountUsd !== undefined
      ? normalizeCurrencyAmount(input.stakeAmountUsd, "Stake amount")
      : existingProfile?.stakeAmountUsd;
  const lockPeriod = input.lockPeriod
    ? ensureAgentLockPeriod(input.lockPeriod)
    : existingProfile?.lockPeriod;
  const serviceLocation = findPickupLocation(input.serviceLocationId ?? input.serviceZone ?? "");

  if (!serviceLocation) {
    throw new Error("Select a valid primary pickup hub for this agent.");
  }

  if (maxSinglePayoutNgn > dailyCapacityNgn) {
    throw new Error("Max single payout cannot be above daily cash capacity.");
  }

  if (!settlementBankCode || !settlementAccountNumber || !settlementAccountName) {
    throw new Error("Settlement bank code, account number, and account name are required.");
  }

  return {
    businessName,
    ownerName,
    businessType,
    serviceLocationId: serviceLocation.id,
    serviceLocationDetail: serviceLocationDetail || undefined,
    serviceZone: serviceLocation.area,
    serviceAddress: serviceLocationDetail ? `${serviceLocationDetail}, near ${serviceLocation.address}` : serviceLocation.address,
    serviceLatitude: serviceLocation.latitude,
    serviceLongitude: serviceLocation.longitude,
    dailyCapacityNgn,
    maxSinglePayoutNgn,
    manualReviewRequired,
    settlementRail,
    settlementBankCode: settlementBankCode || undefined,
    settlementBankName: settlementBankName || undefined,
    settlementAccountNumber: settlementAccountNumber || undefined,
    settlementAccountName: settlementAccountName || undefined,
    paystackRecipientCode: paystackRecipientCode || undefined,
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
      onboardingStatus: "active",
      "agentProfile.isAvailable": true,
      "agentProfile.manualReviewRequired": { $ne: true }
    })
    .sort({ updatedAt: -1 })
    .toArray();

  return documents.map(toAppUser);
}

export async function listAdminUsers() {
  const collection = await getUsersCollection();
  const documents = await collection.find({}).sort({ updatedAt: -1 }).limit(250).toArray();
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

export async function updateAdminUserAccount(input: {
  userId: string;
  onboardingStatus?: OnboardingStatus;
  isAvailable?: boolean;
}) {
  const collection = await getUsersCollection();
  const now = new Date();
  const _id = ensureObjectId(input.userId);
  const user = await collection.findOne({ _id });

  if (!user) {
    throw new Error("User record not found.");
  }

  const setPayload: Record<string, unknown> = {
    updatedAt: now
  };

  if (
    input.onboardingStatus === "new" ||
    input.onboardingStatus === "onboarding" ||
    input.onboardingStatus === "active"
  ) {
    setPayload.onboardingStatus = input.onboardingStatus;
  }

  if (typeof input.isAvailable === "boolean") {
    if (!user.agentProfile) {
      throw new Error("Only POS agent accounts can be marked available or unavailable.");
    }

    setPayload["agentProfile.isAvailable"] = input.isAvailable;
  }

  await collection.updateOne({ _id }, { $set: setPayload });

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to update the user account.");
  }

  return toAppUser(updatedDocument);
}

export async function updateAgentReviewStatus(input: { userId: string; approved: boolean }) {
  const collection = await getUsersCollection();
  const now = new Date();
  const _id = ensureObjectId(input.userId);
  const user = await collection.findOne({ _id });

  if (!user) {
    throw new Error("User record not found.");
  }

  if (!user.agentProfile) {
    throw new Error("Only POS agent applications can be reviewed.");
  }

  await collection.updateOne(
    { _id },
    {
      $set: {
        onboardingStatus: input.approved ? "active" : "onboarding",
        "agentProfile.manualReviewRequired": !input.approved,
        "agentProfile.isAvailable": input.approved,
        updatedAt: now
      }
    }
  );

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to update the POS agent review status.");
  }

  return toAppUser(updatedDocument);
}

export async function updateAgentSettlementRecipientCode(input: { userId: string; recipientCode: string }) {
  const collection = await getUsersCollection();
  const _id = ensureObjectId(input.userId);
  const user = await collection.findOne({ _id });

  if (!user) {
    throw new Error("User record not found.");
  }

  if (!user.agentProfile) {
    throw new Error("Agent profile not found.");
  }

  await collection.updateOne(
    { _id },
    {
      $set: {
        "agentProfile.paystackRecipientCode": input.recipientCode.trim(),
        updatedAt: new Date()
      }
    }
  );
}
