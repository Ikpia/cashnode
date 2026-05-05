import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { resolvePaystackAccountName } from "@/lib/paystack";

export const runtime = "nodejs";

type ResolveAccountBody = {
  accountNumber?: string;
  bankCode?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ResolveAccountBody;
    const result = await resolvePaystackAccountName({
      accountNumber: body.accountNumber ?? "",
      bankCode: body.bankCode ?? ""
    });

    return NextResponse.json({ account: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve account details.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
