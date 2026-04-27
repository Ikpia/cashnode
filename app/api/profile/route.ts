import { NextResponse } from "next/server";
import { getCurrentSessionUser, getUserEntryPath } from "@/lib/auth-session";
import { getUserFirstName } from "@/lib/user-greeting";
import type { AgentProfileInput } from "@/lib/users";
import { updateUserProfile } from "@/lib/users";

export const runtime = "nodejs";

type ProfileBody = {
  displayName?: string;
  walletAddress?: string | null;
  onboardingStatus?: "new" | "onboarding" | "active";
  agentProfile?: AgentProfileInput;
};

export async function GET() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      ...user,
      firstName: getUserFirstName(user)
    },
    redirectPath: getUserEntryPath(user)
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ProfileBody;
    const updatedUser = await updateUserProfile({
      userId: user.id,
      displayName: body.displayName,
      walletAddress: body.walletAddress,
      onboardingStatus: body.onboardingStatus,
      agentProfile: body.agentProfile
    });

    return NextResponse.json({
      user: {
        ...updatedUser,
        firstName: getUserFirstName(updatedUser)
      },
      redirectPath: getUserEntryPath(updatedUser)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
