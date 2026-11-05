"use client";

import { useId } from "react";
import { Input, Label } from "@/components/ui";

/** Guest contact inputs for Message host; linked labels for screen readers. */
export function MessageHostContactFields({
  defaultName = "",
  defaultEmail = "",
  defaultPhone = "",
}: {
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const guestNameId = useId();
  const guestEmailId = useId();
  const guestPhoneId = useId();
  return (
    <>
      <div>
        <Label htmlFor={guestNameId}>Your name</Label>
        <Input
          id={guestNameId}
          name="guestName"
          required
          maxLength={80}
          defaultValue={defaultName}
        />
      </div>
      <div>
        <Label htmlFor={guestEmailId}>Email</Label>
        <Input
          id={guestEmailId}
          name="guestEmail"
          type="email"
          required
          maxLength={254}
          defaultValue={defaultEmail}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={guestPhoneId}>Phone (optional)</Label>
        <Input
          id={guestPhoneId}
          name="guestPhone"
          type="tel"
          maxLength={40}
          defaultValue={defaultPhone}
        />
      </div>
    </>
  );
}
