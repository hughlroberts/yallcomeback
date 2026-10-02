import { prisma } from "@/lib/db";
import { hasEmailTransport } from "@/lib/messaging";

export const EMAIL_VERIFY_REQUIRED_MESSAGE =
  "Confirm your email before you publish a listing. Check your inbox, or resend the link from Account → Login & security.";

export function needsEmailVerifyToPublish(opts: {
  emailVerifiedAt: Date | null | undefined;
  bypass?: boolean;
  emailTransport: boolean;
}): boolean {
  if (opts.bypass) return false;
  if (!opts.emailTransport) return false;
  return !opts.emailVerifiedAt;
}

export async function viewerCanPublishListings(opts: {
  userId: string;
  bypass?: boolean;
}): Promise<boolean> {
  return !(await mustBlockPublishForEmail(opts));
}

export async function mustBlockPublishForEmail(opts: {
  userId: string;
  bypass?: boolean;
}): Promise<boolean> {
  if (opts.bypass) return false;
  if (!hasEmailTransport()) return false;
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { emailVerifiedAt: true },
  });
  return needsEmailVerifyToPublish({
    emailVerifiedAt: user?.emailVerifiedAt,
    emailTransport: true,
  });
}

export async function assertEmailVerifiedForPublish(opts: {
  userId: string;
  bypass?: boolean;
}): Promise<void> {
  if (!(await mustBlockPublishForEmail(opts))) return;
  throw new Error(EMAIL_VERIFY_REQUIRED_MESSAGE);
}
