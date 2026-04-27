import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { acceptPayoutRequest } from "@/lib/payout-requests";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  const user = await getCurrentSessionUser();

  if (!user || user.role !== "agent") {
    return NextResponse.json({ error: "Only signed-in agents can accept requests." }, { status: 403 });
  }

  try {
    const { requestId } = await context.params;
    const payoutRequest = await acceptPayoutRequest({
      requestId,
      agentUser: user
    });

    return NextResponse.json({ request: payoutRequest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept payout request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
