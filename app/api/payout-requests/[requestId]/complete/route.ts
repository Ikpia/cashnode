import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { completePayoutRequest } from "@/lib/payout-requests";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { requestId } = await context.params;
    const payoutRequest = await completePayoutRequest({
      requestId,
      actorUser: user
    });

    return NextResponse.json({ request: payoutRequest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete payout request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
