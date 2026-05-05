type PaystackEnvelope<T = unknown> = {
  status?: boolean;
  message?: string;
  data?: T;
};

type PaystackRecipientData = {
  recipient_code?: string;
};

type PaystackTransferData = {
  transfer_code?: string;
  reference?: string;
  status?: string;
  amount?: number;
  currency?: string;
};

type PaystackBankData = {
  id?: number;
  name?: string;
  code?: string;
  active?: boolean;
  type?: string;
};

type PaystackResolveAccountData = {
  account_number?: string;
  account_name?: string;
  bank_id?: number;
};

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function ensurePaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();

  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is required for transfer settlement.");
  }

  return secret;
}

async function paystackFetch<T>(input: {
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${input.path}`, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${ensurePaystackSecret()}`,
      "Content-Type": "application/json"
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as PaystackEnvelope<T> | null;

  if (!response.ok || !payload?.status) {
    const message =
      (payload && typeof payload.message === "string" && payload.message) || "Paystack request failed.";
    throw new Error(message);
  }

  if (!payload.data) {
    throw new Error("Paystack returned no data payload.");
  }

  return payload.data;
}

export async function createPaystackTransferRecipient(input: {
  name: string;
  accountNumber: string;
  bankCode: string;
  description?: string;
}) {
  const data = await paystackFetch<PaystackRecipientData>({
    path: "/transferrecipient",
    method: "POST",
    body: {
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
      description: input.description ?? "CashNode POS settlement recipient"
    }
  });

  if (!data.recipient_code) {
    throw new Error("Paystack did not return a recipient code.");
  }

  return {
    recipientCode: data.recipient_code
  };
}

export async function initiatePaystackTransfer(input: {
  recipientCode: string;
  amountNgn: number;
  reference: string;
  reason: string;
}) {
  if (!Number.isFinite(input.amountNgn) || input.amountNgn <= 0) {
    throw new Error("Paystack transfer amount must be positive.");
  }

  const amountKobo = Math.round(input.amountNgn * 100);
  const data = await paystackFetch<PaystackTransferData>({
    path: "/transfer",
    method: "POST",
    body: {
      source: "balance",
      amount: amountKobo,
      recipient: input.recipientCode,
      reason: input.reason,
      currency: "NGN",
      reference: input.reference
    }
  });

  return {
    transferCode: data.transfer_code ?? null,
    reference: data.reference ?? input.reference,
    status: (data.status ?? "").toLowerCase(),
    amount: typeof data.amount === "number" ? data.amount / 100 : input.amountNgn,
    currency: data.currency ?? "NGN"
  };
}

export async function verifyPaystackTransfer(reference: string) {
  const data = await paystackFetch<PaystackTransferData>({
    path: `/transfer/verify/${encodeURIComponent(reference)}`,
    method: "GET"
  });

  return {
    status: (data.status ?? "").toLowerCase(),
    transferCode: data.transfer_code ?? null,
    reference: data.reference ?? reference
  };
}

export async function listPaystackNigerianBanks() {
  const data = await paystackFetch<PaystackBankData[]>({
    path: "/bank?country=nigeria&use_cursor=false&perPage=500",
    method: "GET"
  });

  const normalizedBanks = data
    .filter((bank) => bank.active !== false && typeof bank.name === "string" && typeof bank.code === "string")
    .map((bank) => ({
      id: bank.id ?? null,
      name: bank.name!.trim(),
      code: bank.code!.trim(),
      type: bank.type ?? null
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const seenCodes = new Set<string>();
  const uniqueBanks = normalizedBanks.filter((bank) => {
    if (seenCodes.has(bank.code)) {
      return false;
    }

    seenCodes.add(bank.code);
    return true;
  });

  return uniqueBanks;
}

export async function resolvePaystackAccountName(input: { accountNumber: string; bankCode: string }) {
  const accountNumber = input.accountNumber.trim();
  const bankCode = input.bankCode.trim();

  if (!/^\d{10}$/.test(accountNumber)) {
    throw new Error("Account number must be exactly 10 digits.");
  }

  if (!bankCode) {
    throw new Error("Bank code is required.");
  }

  const data = await paystackFetch<PaystackResolveAccountData>({
    path: `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    method: "GET"
  });

  if (!data.account_name) {
    throw new Error("Unable to resolve account name for this bank account.");
  }

  return {
    accountNumber: data.account_number ?? accountNumber,
    accountName: data.account_name
  };
}
