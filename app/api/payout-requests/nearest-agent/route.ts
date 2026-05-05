import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { previewNearestEligibleAgentForPickup } from "@/lib/payout-requests";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const pickupArea = searchParams.get("pickupArea") ?? "";
    const tokenAmount = Number(searchParams.get("tokenAmount") ?? "0");
    const tokenType = (searchParams.get("tokenType") ?? "USDT") as "USDT";

    const preview = await previewNearestEligibleAgentForPickup({
      pickupArea,
      tokenAmount,
      tokenType
    });

    return NextResponse.json({ preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to preview nearest eligible agent.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
