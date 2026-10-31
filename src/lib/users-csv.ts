/**
 * Platform ops: export of all user accounts as CSV (email + host/guest type).
 */

export type UserCsvType = "host" | "guest";

export type UserCsvSource = {
  email: string;
  role: "ADMIN" | "HOST" | "GUEST";
  /** Host brand the user belongs to (owner or co-host). */
  hostId: string | null;
};

/**
 * A user is a "host" when they have the HOST role or are attached to a host
 * brand (User.hostId — owner or co-host). A platform ADMIN who is also on a
 * brand counts as a host; ADMIN/GUEST with no brand are "guest".
 */
export function classifyUserType(user: Pick<UserCsvSource, "role" | "hostId">): UserCsvType {
  return user.role === "HOST" || Boolean(user.hostId) ? "host" : "guest";
}

/** RFC 4180 field escaping. Also neutralizes spreadsheet formula injection. */
export function csvEscape(value: string | null | undefined): string {
  let s = value ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildUsersCsv(users: UserCsvSource[]): string {
  const lines = [["email", "type"].join(",")];
  for (const u of users) {
    lines.push([csvEscape(u.email), csvEscape(classifyUserType(u))].join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** users-YYYY-MM-DD.csv (UTC date). */
export function usersCsvFilename(now: Date = new Date()): string {
  return `users-${now.toISOString().slice(0, 10)}.csv`;
}
