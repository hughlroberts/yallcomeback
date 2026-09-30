import { hash } from "bcryptjs";

/** Cost for new password hashes. Existing cost-10 hashes still verify. */
export const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_COST);
}
