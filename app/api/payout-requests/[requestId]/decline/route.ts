import { NextResponse } from "next/server";
import { hasAgentCapability } from "@/lib/agent-capability";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { declinePayoutRequest } from "@/lib/payout-requests";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  const user = await getCurrentSessionUser();

  if (!user || !hasAgentCapability(user)) {
    return NextResponse.json({ error: "Only signed-in agents can decline requests." }, { status: 403 });
  }

  try {
    const { requestId } = await context.params;
    const payoutRequest = await declinePayoutRequest({
      requestId,
      agentUser: user
    });

    return NextResponse.json({ request: payoutRequest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to decline payout request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
