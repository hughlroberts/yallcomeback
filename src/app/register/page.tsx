import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import { Button, Input, Label, Card } from "@/components/ui";

export const metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/account/bookings");
  const sp = await searchParams;

  async function registerAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    if (formData.get("acceptTerms") !== "on") {
      redirect("/register?error=terms");
    }
    if (!email || password.length < 8) {
      redirect("/register?error=invalid");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) redirect("/register?error=exists");

    const passwordHash = await hash(password, 10);
    await prisma.user.create({
      data: {
        name: name || null,
        email,
        passwordHash,
        role: "GUEST",
      },
    });

    await signIn("credentials", {
      email,
      password,
      redirectTo: "/account/bookings",
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <Card>
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-stone-500">
          Book stays and view your reservations.
        </p>
        {sp.error === "terms" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            You must agree to the Terms of Service and Privacy Policy.
          </p>
        ) : null}
        {sp.error === "exists" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            An account with that email already exists.
          </p>
        ) : null}
        {sp.error === "invalid" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Enter a valid email and a password of at least 8 characters.
          </p>
        ) : null}
        <form action={registerAction} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password (min 8 characters)</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              name="acceptTerms"
              required
              className="mt-1"
            />
            <span>
              I agree to the{" "}
              <a href="/terms" className="font-medium text-bonnet underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="font-medium text-bonnet underline">
                Privacy Policy
              </a>
              . Bookings are a contract with the host, not Yall Come Back.
            </span>
          </label>
          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-500">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-bonnet">
            Sign in
          </a>
        </p>
      </Card>
    </div>
  );
}
