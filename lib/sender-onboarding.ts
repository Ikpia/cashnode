import { ObjectId, type Collection, type WithId } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";

export type FundingRail = "USDC" | "Bank transfer" | "Card";
export type SenderOnboardingStatus = "basics_saved" | "otp_sent" | "otp_verified" | "completed";

type SenderFundingState = {
  rail: FundingRail;
  walletNote: string;
};

type SenderAuthState = {
  provider: "firebase";
  firebaseUid?: string;
  verifiedPhoneNumber?: string;
  phoneVerifiedAt?: Date;
  lastCodeSentAt?: Date;
};

type SenderOnboardingDocument = {
  fullName: string;
  mobileNumber: string;
  country: string;
  corridor: string;
  status: SenderOnboardingStatus;
  auth?: SenderAuthState;
  funding?: SenderFundingState;
  createdAt: Date;
  updatedAt: Date;
};

export type SenderOnboardingRecord = {
  onboardingId: string;
  fullName: string;
  mobileNumber: string;
  country: string;
  corridor: string;
  status: SenderOnboardingStatus;
  otpVerified: boolean;
  fundingRail: FundingRail | null;
  walletNote: string;
  createdAt: string;
  updatedAt: string;
};

const COLLECTION_NAME = "sender_onboarding";
let indexSetupPromise: Promise<void> | null = null;

async function getSenderOnboardingCollection(): Promise<Collection<SenderOnboardingDocument>> {
  const db = await getMongoDb();
  const collection = db.collection<SenderOnboardingDocument>(COLLECTION_NAME);

  if (!indexSetupPromise) {
    indexSetupPromise = collection
      .createIndexes([
        { key: { mobileNumber: 1, updatedAt: -1 }, name: "mobile_updated_lookup" },
        { key: { status: 1, updatedAt: -1 }, name: "status_updated_lookup" }
      ])
      .then(() => undefined);
  }

  await indexSetupPromise;
  return collection;
}

function toRecord(document: WithId<SenderOnboardingDocument>): SenderOnboardingRecord {
  return {
    onboardingId: document._id.toHexString(),
    fullName: document.fullName,
    mobileNumber: document.mobileNumber,
    country: document.country,
    corridor: document.corridor,
    status: document.status,
    otpVerified: Boolean(document.auth?.phoneVerifiedAt),
    fundingRail: document.funding?.rail ?? null,
    walletNote: document.funding?.walletNote ?? "",
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString()
  };
}

function ensureObjectId(onboardingId: string) {
  if (!ObjectId.isValid(onboardingId)) {
    throw new Error("Invalid onboarding id.");
  }

  return new ObjectId(onboardingId);
}

function ensureRequiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function normalizePhoneNumber(value: unknown) {
  const normalizedValue = ensureRequiredText(value, "Mobile number").replace(/[\s()-]/g, "");

  if (!/^\+[1-9]\d{7,14}$/.test(normalizedValue)) {
    throw new Error("Use an international phone number in E.164 format, for example +2348000000000.");
  }

  return normalizedValue;
}

function ensureFundingRail(value: unknown): FundingRail {
  const normalizedValue = ensureRequiredText(value, "Funding rail");

  if (normalizedValue !== "USDC" && normalizedValue !== "Bank transfer" && normalizedValue !== "Card") {
    throw new Error("Unsupported funding rail.");
  }

  return normalizedValue;
}

export async function getSenderOnboardingRecord(onboardingId: string) {
  const collection = await getSenderOnboardingCollection();
  const document = await collection.findOne({ _id: ensureObjectId(onboardingId) });
  return document ? toRecord(document) : null;
}

export async function saveSenderBasics(input: {
  onboardingId?: string;
  fullName: string;
  mobileNumber: string;
  country: string;
  corridor: string;
}) {
  const collection = await getSenderOnboardingCollection();
  const now = new Date();
  const fullName = ensureRequiredText(input.fullName, "Full name");
  const mobileNumber = normalizePhoneNumber(input.mobileNumber);
  const country = ensureRequiredText(input.country, "Country");
  const corridor = ensureRequiredText(input.corridor, "Main corridor");

  if (!input.onboardingId) {
    const insertResult = await collection.insertOne({
      fullName,
      mobileNumber,
      country,
      corridor,
      status: "basics_saved",
      createdAt: now,
      updatedAt: now
    });

    const createdDocument = await collection.findOne({ _id: insertResult.insertedId });

    if (!createdDocument) {
      throw new Error("Failed to create sender onboarding record.");
    }

    return toRecord(createdDocument);
  }

  const _id = ensureObjectId(input.onboardingId);
  const existingDocument = await collection.findOne({ _id });

  if (!existingDocument) {
    throw new Error("Sender onboarding record not found.");
  }

  const mobileChanged = existingDocument.mobileNumber !== mobileNumber;
  const nextStatus = mobileChanged
    ? "basics_saved"
    : existingDocument.status === "completed" || existingDocument.status === "otp_verified" || existingDocument.status === "otp_sent"
      ? existingDocument.status
      : "basics_saved";

  await collection.updateOne(
    { _id },
    {
      $set: {
        fullName,
        mobileNumber,
        country,
        corridor,
        status: nextStatus,
        updatedAt: now
      },
      ...(mobileChanged ? { $unset: { auth: "" } } : {})
    }
  );

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to update sender onboarding record.");
  }

  return toRecord(updatedDocument);
}

export async function markSenderOtpSent(onboardingId: string) {
  const collection = await getSenderOnboardingCollection();
  const _id = ensureObjectId(onboardingId);
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Sender onboarding record not found.");
  }

  const now = new Date();

  await collection.updateOne(
    { _id },
    {
      $set: {
        status: "otp_sent",
        auth: {
          provider: "firebase",
          firebaseUid: document.auth?.firebaseUid,
          verifiedPhoneNumber: document.auth?.verifiedPhoneNumber,
          phoneVerifiedAt: document.auth?.phoneVerifiedAt,
          lastCodeSentAt: now
        },
        updatedAt: now
      }
    }
  );

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to mark sender OTP as sent.");
  }

  return toRecord(updatedDocument);
}

export async function verifySenderPhoneWithFirebase(input: {
  onboardingId: string;
  firebaseUid: string;
  verifiedPhoneNumber: string;
}) {
  const collection = await getSenderOnboardingCollection();
  const _id = ensureObjectId(input.onboardingId);
  const firebaseUid = ensureRequiredText(input.firebaseUid, "Firebase user id");
  const verifiedPhoneNumber = normalizePhoneNumber(input.verifiedPhoneNumber);
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Sender onboarding record not found.");
  }

  if (document.mobileNumber !== verifiedPhoneNumber) {
    throw new Error("The verified phone number does not match the sender record in MongoDB.");
  }

  const now = new Date();

  await collection.updateOne(
    { _id },
    {
      $set: {
        status: document.funding ? "completed" : "otp_verified",
        auth: {
          provider: "firebase",
          firebaseUid,
          verifiedPhoneNumber,
          phoneVerifiedAt: now,
          lastCodeSentAt: document.auth?.lastCodeSentAt
        },
        updatedAt: now
      }
    }
  );

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to save Firebase phone verification.");
  }

  return toRecord(updatedDocument);
}

export async function saveSenderFunding(input: {
  onboardingId: string;
  rail: FundingRail;
  walletNote?: string;
}) {
  const collection = await getSenderOnboardingCollection();
  const _id = ensureObjectId(input.onboardingId);
  const rail = ensureFundingRail(input.rail);
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Sender onboarding record not found.");
  }

  if (!document.auth?.phoneVerifiedAt) {
    throw new Error("Verify the sender before saving funding details.");
  }

  const now = new Date();

  await collection.updateOne(
    { _id },
    {
      $set: {
        funding: {
          rail,
          walletNote: typeof input.walletNote === "string" ? input.walletNote.trim() : ""
        },
        status: "completed",
        updatedAt: now
      }
    }
  );

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to save sender funding details.");
  }

  return toRecord(updatedDocument);
}
