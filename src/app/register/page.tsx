import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import { Button, Input, Label, Card } from "@/components/ui";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/account/bookings");

  async function registerAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

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
