import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { getAgentPresenceByUserId, markAgentPresenceOffline, upsertAgentPresenceOnline } from "@/lib/agent-presence";

export const runtime = "nodejs";

type PresenceBody = {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
};

export async function GET() {
  const user = await getCurrentSessionUser();

  if (!user || user.role !== "agent") {
    return NextResponse.json({ error: "Only signed-in agents can read presence." }, { status: 403 });
  }

  const presence = await getAgentPresenceByUserId(user.id);

  return NextResponse.json({
    presence
  });
}

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user || user.role !== "agent") {
    return NextResponse.json({ error: "Only signed-in agents can update presence." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as PresenceBody;
    const presence = await upsertAgentPresenceOnline({
      userId: user.id,
      latitude: body.latitude ?? Number.NaN,
      longitude: body.longitude ?? Number.NaN,
      accuracyMeters: body.accuracyMeters
    });

    return NextResponse.json({
      presence
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update agent presence.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const user = await getCurrentSessionUser();

  if (!user || user.role !== "agent") {
    return NextResponse.json({ error: "Only signed-in agents can update presence." }, { status: 403 });
  }

  const presence = await markAgentPresenceOffline(user.id);

  return NextResponse.json({
    presence
  });
}
