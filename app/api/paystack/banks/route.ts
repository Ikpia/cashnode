import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { listPaystackNigerianBanks } from "@/lib/paystack";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const banks = await listPaystackNigerianBanks();
    return NextResponse.json({ banks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load banks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
