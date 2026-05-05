import { createHmac, randomBytes } from "node:crypto";

type BitnobQuoteResponseShape = {
  id?: string;
  quote_id?: string;
  status?: string;
  reference?: string;
  provider_settlement_id?: string;
  settlement_amount?: string | number;
  amount?: string | number;
  fees?: string | number;
  expires_at?: string;
  exchange_rate?: {
    rate?: string | number;
  };
};

type BitnobEnvelope = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

export type BitnobPayoutQuote = {
  quoteId: string;
  payoutId: string | null;
  status: string;
  reference: string;
  rate: number;
  settlementAmountNgn: number;
  amountToken: number;
  feesToken: number;
  expiresAt: string;
  raw: unknown;
  /** True when the Bitnob sandbox returned an empty body and a synthetic quote was used. */
  sandboxFallback?: true;
};

export type BitnobPayoutExecution = {
  quoteId: string;
  payoutId: string | null;
  status: string;
  reference: string;
  rate: number;
  settlementAmountNgn: number;
  amountToken: number;
  feesToken: number;
  providerSettlementId: string | null;
  expiresAt: string;
  initializedRaw: unknown;
  finalizedRaw: unknown;
};

const DEFAULT_BITNOB_BASE_URL = "https://sandboxapi.bitnob.co";
const QUOTE_ENDPOINT_CANDIDATES = ["/api/v1/payouts/quotes", "/api/payouts/quotes", "/api/payouts/quote", "/v1/payouts/quote"] as const;

class BitnobRequestError extends Error {
  status: number;
  requestPath: string;
  responsePayload: unknown;

  constructor(input: { message: string; status: number; requestPath: string; responsePayload?: unknown }) {
    super(input.message);
    this.name = "BitnobRequestError";
    this.status = input.status;
    this.requestPath = input.requestPath;
    this.responsePayload = input.responsePayload ?? null;
  }
}

function ensureRequiredEnv(value: string | undefined, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is required for Bitnob integration.`);
  }

  return value.trim();
}

function parseNumeric(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Bitnob quote did not return a valid ${label}.`);
  }

  return parsed;
}

function parseQuotePayload(payload: unknown): BitnobQuoteResponseShape {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return payload as BitnobQuoteResponseShape;
}

function pickFirstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function unwrapBitnobResponse(payload: unknown): BitnobQuoteResponseShape {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const envelope = payload as BitnobEnvelope;
  const data = envelope.data;

  if (!data || typeof data !== "object") {
    return parseQuotePayload(payload);
  }

  const dataObject = data as Record<string, unknown>;

  if (dataObject.payout && typeof dataObject.payout === "object") {
    return parseQuotePayload(dataObject.payout);
  }

  return parseQuotePayload(data);
}

function generateSignature(input: {
  clientId: string;
  secret: string;
  timestamp: string;
  nonce: string;
  requestBody: string;
}) {
  const signingString = `${input.clientId}:${input.timestamp}:${input.nonce}:${input.requestBody}`;
  return createHmac("sha256", input.secret).update(signingString).digest("hex");
}

function isRouteMismatchError(error: unknown) {
  return error instanceof BitnobRequestError && (error.status === 404 || error.status === 405);
}

async function bitnobFetch(input: {
  requestPath: string;
  method: "POST";
  body?: Record<string, unknown>;
}) {
  const baseUrl = (process.env.BITNOB_BASE_URL?.trim() || DEFAULT_BITNOB_BASE_URL).replace(/\/+$/, "");
  const secret = ensureRequiredEnv(process.env.BITNOB_SECRET_KEY, "BITNOB_SECRET_KEY");
  const bodyString = input.body ? JSON.stringify(input.body) : "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const clientId = process.env.BITNOB_CLIENT_ID?.trim();

  if (clientId) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString("hex");
    headers["X-Auth-Client"] = clientId;
    headers["X-Auth-Timestamp"] = timestamp;
    headers["X-Auth-Nonce"] = nonce;
    headers["X-Auth-Signature"] = generateSignature({
      clientId,
      secret,
      timestamp,
      nonce,
      requestBody: bodyString
    });
  } else {
    // Legacy bearer token mode used by some Bitnob sandbox accounts.
    headers.Authorization = `Bearer ${secret}`;
  }

  const response = await fetch(`${baseUrl}${input.requestPath}`, {
    method: input.method,
    headers,
    body: input.body ? bodyString : undefined,
    cache: "no-store"
  });

  const rawText = await response.text().catch(() => "");
  let payload: unknown = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    const errorMessage =
      (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string" && payload.message) ||
      (typeof payload === "string" && payload.trim()) ||
      `Bitnob request failed with status ${response.status} on ${input.requestPath}.`;
    throw new BitnobRequestError({
      message: errorMessage,
      status: response.status,
      requestPath: input.requestPath,
      responsePayload: payload
    });
  }

  return payload;
}

async function bitnobFetchWithCandidates(input: {
  requestPaths: readonly string[];
  method: "POST";
  body?: Record<string, unknown>;
}) {
  let lastRouteMismatch: BitnobRequestError | null = null;

  for (const requestPath of input.requestPaths) {
    try {
      return await bitnobFetch({
        requestPath,
        method: input.method,
        body: input.body
      });
    } catch (error) {
      if (isRouteMismatchError(error)) {
        lastRouteMismatch = error;
        continue;
      }

      throw error;
    }
  }

  throw lastRouteMismatch ?? new Error("Bitnob request failed because no matching endpoint was found.");
}

function parseStatus(value: unknown, fallback = "QUOTE") {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim().toUpperCase();
}

function parseBitnobPayoutSnapshot(payload: unknown, fallbackReference = "") {
  const payout = unwrapBitnobResponse(payload);
  const quoteId = payout.quote_id || payout.id;
  const payoutId = payout.id ?? null;
  const status = parseStatus(payout.status);
  const rate = parseNumeric(payout.exchange_rate?.rate, "exchange rate");
  const settlementAmountNgn = parseNumeric(payout.settlement_amount, "settlement amount");
  const amountToken = parseNumeric(payout.amount, "crypto amount");
  const feesToken = Math.max(0, Number(payout.fees ?? 0));
  const reference = payout.reference || fallbackReference;
  const providerSettlementId =
    typeof payout.provider_settlement_id === "string" && payout.provider_settlement_id.trim()
      ? payout.provider_settlement_id.trim()
      : null;
  const expiresAtRaw = payout.expires_at;

  if (!quoteId || !expiresAtRaw || !reference) {
    throw new Error("Bitnob payout response is missing quote id, reference, or expiry.");
  }

  const expiresAt = new Date(expiresAtRaw);

  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("Bitnob payout response returned an invalid expiry time.");
  }

  return {
    quoteId,
    payoutId,
    status,
    reference,
    rate,
    settlementAmountNgn: Math.round(settlementAmountNgn),
    amountToken,
    feesToken,
    providerSettlementId,
    expiresAt: expiresAt.toISOString()
  };
}

function getBitnobBeneficiaryPayload() {
  const rawBeneficiaryJson = process.env.BITNOB_PAYOUT_BENEFICIARY_JSON?.trim();

  if (!rawBeneficiaryJson) {
    throw new Error("BITNOB_PAYOUT_BENEFICIARY_JSON is required for conversion execution.");
  }

  try {
    const parsed = JSON.parse(rawBeneficiaryJson) as unknown;

    if (!parsed || typeof parsed !== "object") {
      throw new Error("BITNOB_PAYOUT_BENEFICIARY_JSON must be a valid JSON object.");
    }

    const beneficiary = parsed as Record<string, unknown>;
    const destinationType = pickFirstString([beneficiary.destination_type, beneficiary.destinationType]) || "bank";
    const country = pickFirstString([beneficiary.country]) || "NG";
    const accountName = pickFirstString([beneficiary.account_name, beneficiary.accountName, beneficiary.name]);
    const accountNumber = pickFirstString([beneficiary.account_number, beneficiary.accountNumber]);
    const bankCode = pickFirstString([beneficiary.bank_code, beneficiary.bankCode]);
    const bankName = pickFirstString([beneficiary.bank_name, beneficiary.bankName]);

    if (destinationType === "bank" && accountName && accountNumber && bankCode) {
      return {
        ...beneficiary,
        destination_type: "bank",
        country,
        account_name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        ...(bankName ? { bank_name: bankName } : {})
      } satisfies Record<string, unknown>;
    }

    if (pickFirstString([beneficiary.destination_type, beneficiary.account_name, beneficiary.account_number])) {
      return {
        ...beneficiary,
        ...(beneficiary.country ? {} : { country })
      } satisfies Record<string, unknown>;
    }

    throw new Error(
      "BITNOB_PAYOUT_BENEFICIARY_JSON must use Bitnob's beneficiary fields or include legacy bank fields like name, accountNumber, and bankCode."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid BITNOB_PAYOUT_BENEFICIARY_JSON.";
    throw new Error(`Unable to parse BITNOB_PAYOUT_BENEFICIARY_JSON: ${message}`);
  }
}

export async function createBitnobUsdtNgnQuote(input: {
  tokenAmount: number;
  reference: string;
}): Promise<BitnobPayoutQuote> {
  const amount = parseNumeric(input.tokenAmount, "token amount");

  if (typeof input.reference !== "string" || !input.reference.trim()) {
    throw new Error("Bitnob quote reference is required.");
  }

  const requestBody = {
    amount: amount.toFixed(2),
    country: "NG",
    from_asset: "USDT",
    to_currency: "NGN",
    source: "offchain",
    reference: input.reference.trim()
  };

  const rawPayload = await bitnobFetchWithCandidates({
    method: "POST",
    requestPaths: QUOTE_ENDPOINT_CANDIDATES,
    body: requestBody
  });

  if (!rawPayload) {
    // Bitnob sandbox returns empty 200 responses. Use a synthetic quote so the
    // full payout creation flow can proceed for demo/testing purposes.
    const isSandbox = (process.env.BITNOB_BASE_URL || DEFAULT_BITNOB_BASE_URL).includes("sandbox");

    if (!isSandbox) {
      throw new Error(
        "Bitnob returned an empty response to the quote request. " +
          "Please verify your BITNOB_CLIENT_ID / BITNOB_SECRET_KEY and try again."
      );
    }

    const SANDBOX_NGN_RATE = 1620;
    const syntheticSettlement = Math.round(amount * SANDBOX_NGN_RATE);
    const syntheticExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const syntheticQuoteId = `SBX_${input.reference.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16)}`;

    return {
      quoteId: syntheticQuoteId,
      payoutId: null,
      status: "QUOTE",
      reference: input.reference.trim(),
      rate: SANDBOX_NGN_RATE,
      settlementAmountNgn: syntheticSettlement,
      amountToken: amount,
      feesToken: 0,
      expiresAt: syntheticExpiry,
      raw: null,
      sandboxFallback: true
    };
  }

  const quote = unwrapBitnobResponse(rawPayload);
  const quoteId = quote.quote_id || quote.id;
  const payoutId = quote.id ?? null;
  const status = parseStatus(quote.status);
  const rate = parseNumeric(quote.exchange_rate?.rate, "exchange rate");
  const settlementAmountNgn = parseNumeric(quote.settlement_amount, "settlement amount");
  const amountToken = parseNumeric(quote.amount, "crypto amount");
  const feesToken = Math.max(0, Number(quote.fees ?? 0));
  const expiresAtRaw = quote.expires_at;

  if (!quoteId || !expiresAtRaw) {
    throw new Error("Bitnob quote response is missing quote id or expiry.");
  }

  const expiresAt = new Date(expiresAtRaw);

  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("Bitnob quote response returned an invalid expiry time.");
  }

  return {
    quoteId,
    payoutId,
    status,
    reference: quote.reference || input.reference.trim(),
    rate,
    settlementAmountNgn: Math.round(settlementAmountNgn),
    amountToken,
    feesToken,
    expiresAt: expiresAt.toISOString(),
    raw: rawPayload
  };
}

export async function executeBitnobUsdtNgnPayout(input: {
  quote: BitnobPayoutQuote;
  requestReference: string;
}) {
  if (!input.quote.quoteId) {
    throw new Error("Bitnob quote id is required before payout execution.");
  }

  if (!input.requestReference.trim()) {
    throw new Error("Payout request reference is required.");
  }

  // Sandbox fallback: skip real API calls and return a synthetic initialized result.
  if (input.quote.sandboxFallback) {
    return {
      quoteId: input.quote.quoteId,
      payoutId: null,
      status: "INITIALIZED",
      reference: input.requestReference.trim(),
      rate: input.quote.rate,
      settlementAmountNgn: input.quote.settlementAmountNgn,
      amountToken: input.quote.amountToken,
      feesToken: input.quote.feesToken,
      providerSettlementId: null,
      expiresAt: input.quote.expiresAt,
      initializedRaw: null,
      finalizedRaw: null
    } satisfies BitnobPayoutExecution;
  }

  const paymentReason = process.env.BITNOB_PAYMENT_REASON?.trim() || "family_support";
  const callbackUrl = process.env.BITNOB_PAYOUT_CALLBACK_URL?.trim();
  const beneficiary = getBitnobBeneficiaryPayload();
  const quoteId = input.quote.quoteId;
  const reference = input.requestReference.trim();
  const initializeBody: Record<string, unknown> = {
    quote_id: quoteId,
    reference,
    payment_reason: paymentReason,
    beneficiary
  };

  if (callbackUrl) {
    initializeBody.callback_url = callbackUrl;
  }

  const initializedPayload = await bitnobFetchWithCandidates({
    method: "POST",
    requestPaths: [
      "/api/v1/payouts/initialize",
      `/api/v1/payouts/${encodeURIComponent(quoteId)}/initialize`,
      "/api/payouts/initialize",
      `/api/payouts/${encodeURIComponent(quoteId)}/initialize`
    ],
    body: initializeBody
  });
  const initializedSnapshot = parseBitnobPayoutSnapshot(initializedPayload, reference);

  const finalizeBody = {
    quote_id: quoteId,
    reference
  };

  const finalizedPayload = await bitnobFetchWithCandidates({
    method: "POST",
    requestPaths: [
      "/api/v1/payouts/finalize",
      `/api/v1/payouts/${encodeURIComponent(quoteId)}/finalize`,
      "/api/payouts/finalize",
      `/api/payouts/${encodeURIComponent(quoteId)}/finalize`
    ],
    body: finalizeBody
  });
  const finalizedSnapshot = parseBitnobPayoutSnapshot(finalizedPayload, reference);

  return {
    quoteId: finalizedSnapshot.quoteId,
    payoutId: finalizedSnapshot.payoutId ?? initializedSnapshot.payoutId,
    status: finalizedSnapshot.status,
    reference: finalizedSnapshot.reference || initializedSnapshot.reference,
    rate: finalizedSnapshot.rate,
    settlementAmountNgn: finalizedSnapshot.settlementAmountNgn,
    amountToken: finalizedSnapshot.amountToken,
    feesToken: finalizedSnapshot.feesToken,
    providerSettlementId: finalizedSnapshot.providerSettlementId ?? initializedSnapshot.providerSettlementId,
    expiresAt: finalizedSnapshot.expiresAt,
    initializedRaw: initializedPayload,
    finalizedRaw: finalizedPayload
  } satisfies BitnobPayoutExecution;
}
