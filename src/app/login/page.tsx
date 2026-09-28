import { redirect } from "next/navigation";

import { auth, signIn } from "@/core/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MicrosoftLogo } from "./microsoft-logo";

const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already linked to a different sign-in method.",
  AccessDenied: "Your account does not have access to PowerDevin.",
  Configuration:
    "Microsoft sign-in is not configured yet. Check the Entra ID environment variables.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  const { callbackUrl, error } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to PowerDevin</CardTitle>
          <CardDescription>
            Internal operations console. Access is granted with your Microsoft
            account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive">
              {AUTH_ERRORS[error] ?? "Sign-in failed. Please try again."}
            </p>
          ) : null}
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", {
                redirectTo: callbackUrl ?? "/",
              });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              <MicrosoftLogo />
              Continue with Microsoft
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
