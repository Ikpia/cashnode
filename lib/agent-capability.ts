type AgentCapabilityUser = {
  onboardingStatus?: "new" | "onboarding" | "active";
  agentProfile?: unknown | null;
};

export function hasAgentCapability(user: AgentCapabilityUser | null | undefined) {
  return Boolean(user && user.onboardingStatus === "active" && user.agentProfile);
}