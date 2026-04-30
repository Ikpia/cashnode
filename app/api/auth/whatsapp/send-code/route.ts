import { NextResponse } from "next/server";
import { sendWhatsappVerificationCode } from "@/lib/local-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await sendWhatsappVerificationCode(body.phoneNumber);

    return NextResponse.json({
      message: "WhatsApp verification code sent.",
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send WhatsApp verification code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
