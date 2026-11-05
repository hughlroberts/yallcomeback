import { auth } from "@/lib/auth";
import { SavedStaysClient } from "./saved-stays-client";

export default async function SavedStaysPage() {
  const session = await auth();
  return <SavedStaysClient isSignedIn={Boolean(session?.user)} />;
}
