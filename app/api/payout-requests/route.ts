import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import {
  createPayoutRequest,
  listAssignedAgentPayoutRequests,
  listAvailablePayoutRequests,
  listReceiverPayoutRequests,
  listSenderPayoutRequests
} from "@/lib/payout-requests";

export const runtime = "nodejs";

type CreatePayoutBody = {
  receiverName?: string;
  receiverPhone?: string;
  pickupArea?: string;
  notes?: string;
  amountUsd?: number | string;
};

export async function GET() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (user.role === "sender") {
    const requests = await listSenderPayoutRequests(user.id);
    return NextResponse.json({ requests });
  }

  if (user.role === "agent") {
    const [availableRequests, assignedRequests] = await Promise.all([
      listAvailablePayoutRequests(user),
      listAssignedAgentPayoutRequests(user.id)
    ]);

    return NextResponse.json({ availableRequests, assignedRequests });
  }

  const requests = await listReceiverPayoutRequests(user.phoneNumber);
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user || user.role !== "sender") {
    return NextResponse.json({ error: "Only signed-in senders can create payout requests." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CreatePayoutBody;
    const payoutRequest = await createPayoutRequest({
      senderUser: user,
      receiverName: body.receiverName ?? "",
      receiverPhone: body.receiverPhone ?? "",
      pickupArea: body.pickupArea ?? "",
      notes: body.notes ?? "",
      amountUsd: typeof body.amountUsd === "string" ? Number(body.amountUsd) : Number(body.amountUsd ?? 0)
    });

    return NextResponse.json({ request: payoutRequest }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payout request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
