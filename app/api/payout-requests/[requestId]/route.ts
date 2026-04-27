import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { getPayoutRequestByIdForUser } from "@/lib/payout-requests";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { requestId } = await context.params;
    const payoutRequest = await getPayoutRequestByIdForUser(requestId, user);

    if (!payoutRequest) {
      return NextResponse.json({ error: "Payout request not found." }, { status: 404 });
    }

    return NextResponse.json({ request: payoutRequest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load payout request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
