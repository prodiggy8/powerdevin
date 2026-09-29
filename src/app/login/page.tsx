import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

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

  // Without credentials Entra answers the redirect with AADSTS900144 on its own
  // domain, so the button is stopped here instead.
  const configured = Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  );

  return (
    <main className="flex min-h-svh w-full items-start justify-center px-6 pt-24 md:items-center md:pt-0">
      <div className="flex w-full max-w-sm flex-col gap-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-10 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">PowerDevin</h1>
            <p className="text-sm text-muted-foreground">
              Internal operations console
            </p>
          </div>
        </div>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription>
              Use the Microsoft account issued by your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p
                role="alert"
                className="border-l-2 border-destructive pl-3 text-sm text-destructive"
              >
                {AUTH_ERRORS[error] ?? "Sign-in failed. Please try again."}
              </p>
            ) : null}
            {configured ? null : (
              <p
                role="alert"
                className="border-l-2 border-destructive pl-3 text-sm text-destructive"
              >
                {AUTH_ERRORS.Configuration}
              </p>
            )}
            <form
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", {
                  redirectTo: callbackUrl ?? "/",
                });
              }}
            >
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={!configured}
              >
                <MicrosoftLogo />
                Continue with Microsoft
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Staff accounts only. Access is managed by an admin.
        </p>
      </div>
    </main>
  );
}
