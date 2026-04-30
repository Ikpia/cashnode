import { createHash, createHmac, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { getUserById, updateUserProfile, upsertUserFromFirebaseLogin, type AppUser } from "@/lib/users";

type AuthCredentialDocument = {
  userId: ObjectId;
  email: string;
  phoneNumber: string;
  pinHash: string;
  pinSalt: string;
  whatsappVerifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type WhatsappCodeDocument = {
  phoneNumber: string;
  codeHash: string;
  expiresAt: Date;
  createdAt: Date;
  consumedAt?: Date;
};

const CREDENTIALS_COLLECTION = "auth_credentials";
const WHATSAPP_CODES_COLLECTION = "auth_whatsapp_codes";
const WHATSAPP_CODE_EXPIRY_MS = 1000 * 60 * 10;
const WHATSAPP_CODE_RESEND_GAP_MS = 1000 * 45;
const JWT_ISSUER = "cashnode";

let indexesReadyPromise: Promise<void> | null = null;

function ensureObjectId(value: string, label = "id") {
  if (!ObjectId.isValid(value)) {
    throw new Error(`Invalid ${label}.`);
  }

  return new ObjectId(value);
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Email is required.");
  }

  const email = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  return email;
}

function normalizePhoneNumber(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Phone number is required.");
  }

  const phoneNumber = value.trim().replace(/[\s()-]/g, "");

  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    throw new Error("Use an international phone number in E.164 format, for example +2348000000000.");
  }

  return phoneNumber;
}

function ensurePin(value: unknown) {
  if (typeof value !== "string" || !/^\d{6}$/.test(value.trim())) {
    throw new Error("PIN must be exactly 6 digits.");
  }

  return value.trim();
}

function hashHex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + "=".repeat(padding), "base64");
}

function getJwtSecret() {
  if (process.env.AUTH_JWT_SECRET?.trim()) {
    return process.env.AUTH_JWT_SECRET.trim();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing AUTH_JWT_SECRET in production.");
  }

  return "cashnode-dev-jwt-secret-change-me";
}

function hashSecret(value: string, salt?: string) {
  const resolvedSalt = salt ?? randomUUID().replace(/-/g, "");
  const hash = scryptSync(value, resolvedSalt, 32).toString("hex");
  return { hash, salt: resolvedSalt };
}

function matchesSecret(value: string, salt: string, expectedHash: string) {
  const computedBuffer = Buffer.from(scryptSync(value, salt, 32).toString("hex"), "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (computedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(computedBuffer, expectedBuffer);
}

async function getCollections() {
  const db = await getMongoDb();
  const credentials = db.collection<AuthCredentialDocument>(CREDENTIALS_COLLECTION);
  const whatsappCodes = db.collection<WhatsappCodeDocument>(WHATSAPP_CODES_COLLECTION);

  if (!indexesReadyPromise) {
    indexesReadyPromise = Promise.all([
      credentials.createIndexes([
        { key: { userId: 1 }, name: "user_id_unique", unique: true },
        { key: { email: 1 }, name: "email_unique", unique: true },
        { key: { phoneNumber: 1 }, name: "phone_unique", unique: true }
      ]),
      whatsappCodes.createIndexes([
        { key: { phoneNumber: 1, createdAt: -1 }, name: "phone_created_lookup" },
        { key: { expiresAt: 1 }, name: "expires_lookup" }
      ])
    ]).then(() => undefined);
  }

  await indexesReadyPromise;
  return {
    credentials,
    whatsappCodes,
    db
  };
}

export async function sendWhatsappVerificationCode(phoneNumberInput: unknown) {
  const phoneNumber = normalizePhoneNumber(phoneNumberInput);
  const { whatsappCodes } = await getCollections();
  const now = new Date();

  const latestCode = await whatsappCodes.findOne(
    {
      phoneNumber
    },
    {
      sort: {
        createdAt: -1
      }
    }
  );

  if (latestCode && now.getTime() - latestCode.createdAt.getTime() < WHATSAPP_CODE_RESEND_GAP_MS) {
    throw new Error("Please wait a few seconds before requesting another code.");
  }

  const code = String(randomInt(0, 1000000)).padStart(6, "0");

  await whatsappCodes.insertOne({
    phoneNumber,
    codeHash: hashHex(`${phoneNumber}:${code}`),
    expiresAt: new Date(now.getTime() + WHATSAPP_CODE_EXPIRY_MS),
    createdAt: now
  });

  return {
    phoneNumber,
    expiresInSeconds: Math.floor(WHATSAPP_CODE_EXPIRY_MS / 1000),
    demoCode: process.env.NODE_ENV === "production" ? undefined : code
  };
}

async function consumeValidWhatsappCode(input: { phoneNumber: string; code: string }) {
  const { whatsappCodes } = await getCollections();
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const code = ensurePin(input.code);

  const now = new Date();
  const latestCode = await whatsappCodes.findOne(
    {
      phoneNumber,
      consumedAt: { $exists: false },
      expiresAt: { $gt: now }
    },
    {
      sort: {
        createdAt: -1
      }
    }
  );

  if (!latestCode) {
    throw new Error("No active WhatsApp verification code was found. Request a new code.");
  }

  const matches = latestCode.codeHash === hashHex(`${phoneNumber}:${code}`);

  if (!matches) {
    throw new Error("Invalid WhatsApp verification code.");
  }

  await whatsappCodes.updateOne(
    { _id: latestCode._id },
    {
      $set: {
        consumedAt: now
      }
    }
  );

  return now;
}

export async function signupWithWhatsAppPin(input: {
  fullName: unknown;
  email: unknown;
  phoneNumber: unknown;
  pin: unknown;
  whatsappCode: unknown;
}) {
  const fullName = typeof input.fullName === "string" && input.fullName.trim() ? input.fullName.trim() : "";

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  const email = normalizeEmail(input.email);
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const pin = ensurePin(input.pin);
  const whatsappCode = ensurePin(input.whatsappCode);
  const { credentials } = await getCollections();

  const existingCredential = await credentials.findOne({
    $or: [{ email }, { phoneNumber }]
  });

  if (existingCredential) {
    throw new Error("An account with this email or phone number already exists.");
  }

  const whatsappVerifiedAt = await consumeValidWhatsappCode({
    phoneNumber,
    code: whatsappCode
  });

  const baseUser = await upsertUserFromFirebaseLogin({
    firebaseUid: `local:${randomUUID()}`,
    phoneNumber,
    requestedRole: "sender"
  });
  const user = await updateUserProfile({
    userId: baseUser.id,
    displayName: fullName,
    onboardingStatus: "active"
  });
  const { hash: pinHash, salt: pinSalt } = hashSecret(pin);
  const now = new Date();

  await credentials.insertOne({
    userId: ensureObjectId(user.id, "user id"),
    email,
    phoneNumber,
    pinHash,
    pinSalt,
    whatsappVerifiedAt,
    createdAt: now,
    updatedAt: now
  });

  return user;
}

export async function authenticateWithPin(input: { identifier: unknown; pin: unknown }) {
  const identifier = typeof input.identifier === "string" ? input.identifier.trim() : "";

  if (!identifier) {
    throw new Error("Phone number or email is required.");
  }

  const pin = ensurePin(input.pin);
  const { credentials, db } = await getCollections();
  const credential = await credentials.findOne(
    identifier.includes("@")
      ? { email: normalizeEmail(identifier) }
      : { phoneNumber: normalizePhoneNumber(identifier) }
  );

  if (!credential || !matchesSecret(pin, credential.pinSalt, credential.pinHash)) {
    throw new Error("Invalid credentials.");
  }

  await db.collection("users").updateOne(
    { _id: credential.userId },
    {
      $set: {
        lastLoginAt: new Date(),
        updatedAt: new Date()
      }
    }
  );

  const user = await getUserById(credential.userId.toHexString());

  if (!user) {
    throw new Error("User account could not be loaded.");
  }

  return user;
}

export async function createLocalSession(userId: string, expiresInMs: number) {
  ensureObjectId(userId, "user id");

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = nowSeconds + Math.max(1, Math.floor(expiresInMs / 1000));
  const payload = {
    sub: userId,
    iat: nowSeconds,
    exp: expiresAtSeconds,
    iss: JWT_ISSUER
  };
  const headerEncoded = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = createHmac("sha256", getJwtSecret()).update(signatureInput).digest();
  return `${signatureInput}.${toBase64Url(signature)}`;
}

export async function getUserFromLocalSession(token: string): Promise<AppUser | null> {
  if (!token) {
    return null;
  }

  const tokenParts = token.split(".");

  if (tokenParts.length !== 3) {
    return null;
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = tokenParts;
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  const expectedSignature = createHmac("sha256", getJwtSecret()).update(signatureInput).digest();
  const providedSignature = fromBase64Url(signatureEncoded);

  if (providedSignature.length !== expectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return null;
  }

  let payload: { sub?: string; exp?: number; iss?: string } = {};

  try {
    payload = JSON.parse(fromBase64Url(payloadEncoded).toString("utf8")) as {
      sub?: string;
      exp?: number;
      iss?: string;
    };
  } catch {
    return null;
  }

  if (payload.iss !== JWT_ISSUER) {
    return null;
  }

  if (!payload.sub || typeof payload.sub !== "string") {
    return null;
  }

  if (!payload.exp || typeof payload.exp !== "number") {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (payload.exp <= nowSeconds) {
    return null;
  }

  return getUserById(payload.sub);
}

export async function clearLocalSession(token: string) {
  void token;
}
