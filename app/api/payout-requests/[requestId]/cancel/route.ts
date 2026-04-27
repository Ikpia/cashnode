import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { cancelPayoutRequest } from "@/lib/payout-requests";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  const user = await getCurrentSessionUser();

  if (!user || user.role !== "sender") {
    return NextResponse.json({ error: "Only signed-in senders can cancel requests." }, { status: 403 });
  }

  try {
    const { requestId } = await context.params;
    const payoutRequest = await cancelPayoutRequest({
      requestId,
      senderUser: user
    });

    return NextResponse.json({ request: payoutRequest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel payout request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
