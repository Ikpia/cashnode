function getFirebaseErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code;

    if (typeof code === "string") {
      return code;
    }
  }

  if (error instanceof Error) {
    const match = error.message.match(/auth\/[a-z-]+/i);
    return match?.[0] ?? "";
  }

  return "";
}

export function getFriendlyFirebaseAuthMessage(error: unknown) {
  const errorCode = getFirebaseErrorCode(error);
  const rawMessage = error instanceof Error ? error.message : "";
  const normalizedCode = errorCode.trim().toLowerCase().replace(/[).:\s]+$/g, "");
  const normalizedMessage = rawMessage.trim().toLowerCase();

  if (
    normalizedCode.includes("operation-not-allowed") ||
    normalizedMessage.includes("auth/operation-not-allowed") ||
    normalizedMessage.includes("phone_provider_disabled")
  ) {
    return "Phone sign-in is not enabled yet. Turn on Phone in Firebase Authentication > Sign-in method.";
  }

  if (
    normalizedCode.includes("billing-not-enabled") ||
    normalizedMessage.includes("auth/billing-not-enabled") ||
    normalizedMessage.includes("billing_not_enabled")
  ) {
    return "Phone sign-in needs billing on this Firebase project. Enable billing for the project, or use Firebase test phone numbers while developing.";
  }

  if (normalizedCode.includes("invalid-phone-number") || normalizedMessage.includes("auth/invalid-phone-number")) {
    return "Enter a valid phone number with the country code so we can send your sign-in code.";
  }

  if (normalizedCode.includes("too-many-requests") || normalizedMessage.includes("auth/too-many-requests")) {
    return "Too many attempts right now. Please wait a little and try again.";
  }

  if (
    normalizedCode.includes("invalid-verification-code") ||
    normalizedMessage.includes("auth/invalid-verification-code")
  ) {
    return "That code does not look right. Check the SMS and try again.";
  }

  if (normalizedCode.includes("code-expired") || normalizedMessage.includes("auth/code-expired")) {
    return "That code has expired. Request a new one and try again.";
  }

  if (normalizedCode.includes("network-request-failed") || normalizedMessage.includes("auth/network-request-failed")) {
    return "Your connection dropped while signing in. Check your internet and try again.";
  }

  if (
    normalizedCode.includes("configuration-not-found") ||
    normalizedMessage.includes("auth/configuration-not-found")
  ) {
    return "Phone authentication is not fully configured for this app yet. Check your Firebase Auth setup.";
  }

  if (normalizedMessage.includes("recaptcha has already been rendered in this element")) {
    return "Security check is resetting. Please tap Send code once more.";
  }

  if (rawMessage) {
    return `We could not complete that step right now. ${rawMessage.replace(/^firebase:\s*/i, "").trim()}`;
  }

  return "We could not complete that step right now. Please try again.";
}
