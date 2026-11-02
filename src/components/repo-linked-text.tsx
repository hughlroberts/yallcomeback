import { Fragment } from "react";
import { REPO_URL } from "@/lib/features";

export const REPO_LINK_CLASS =
  "font-semibold text-bonnet underline-offset-2 hover:underline";

/** Plain step text with the open-source repo URL made a clickable link. */
export function RepoLinkedText({ text }: { text: string }) {
  if (!REPO_URL || !text.includes(REPO_URL)) return <>{text}</>;
  const parts = text.split(REPO_URL);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 ? (
            <a
              href={REPO_URL!}
              target="_blank"
              rel="noreferrer"
              className={REPO_LINK_CLASS}
            >
              {REPO_URL}
            </a>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}
