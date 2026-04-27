import { redirect } from "next/navigation";
import AuthScreen from "@/components/auth-screen";
import { getCurrentSessionUser, getUserEntryPath } from "@/lib/auth-session";

type SearchParams =
  Promise<Record<string, string | string[] | undefined>>;

export default async function AuthPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const sessionUser = await getCurrentSessionUser();

  if (sessionUser) {
    redirect(getUserEntryPath(sessionUser));
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const modeValue = resolvedSearchParams.mode;
  const mode = (Array.isArray(modeValue) ? modeValue[0] : modeValue) === "signup" ? "signup" : "signin";

  return <AuthScreen mode={mode} />;
}
