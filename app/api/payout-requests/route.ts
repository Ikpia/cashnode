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
  pickupLocationDetail?: string;
  notes?: string;
  tokenType?: "USDT";
  tokenAmount?: number | string;
};

export async function GET() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [sentRequests, receiverRequests, availableRequests, assignedRequests] = await Promise.all([
    listSenderPayoutRequests(user.id),
    listReceiverPayoutRequests(user.phoneNumber),
    listAvailablePayoutRequests(user.agentProfile ? user : undefined),
    user.agentProfile ? listAssignedAgentPayoutRequests(user.id) : Promise.resolve([])
  ]);

  return NextResponse.json({
    sentRequests,
    receiverRequests,
    availableRequests,
    assignedRequests
  });
}

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Only signed-in users can create payout requests." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CreatePayoutBody;
    const payoutRequest = await createPayoutRequest({
      senderUser: user,
      receiverName: body.receiverName ?? "",
      receiverPhone: body.receiverPhone ?? "",
      pickupArea: body.pickupArea ?? "",
      pickupLocationDetail: body.pickupLocationDetail ?? "",
      notes: body.notes ?? "",
      tokenType: body.tokenType ?? "USDT",
      tokenAmount: typeof body.tokenAmount === "string" ? Number(body.tokenAmount) : Number(body.tokenAmount ?? 0)
    });

    return NextResponse.json({ request: payoutRequest }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payout request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
