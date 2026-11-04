/**
 * T58: a new-tab link plus an "Open here" same-tab link to the same URL,
 * so a tester can tell an app problem from a browser new-tab problem.
 * Plain anchors only (no next/link, no window.open, no click handlers).
 */
export function ListingLinkPair({
  href,
  children,
  testId,
  className = "text-bonnet hover:underline",
}: {
  href: string;
  children: React.ReactNode;
  testId: string;
  className?: string;
}) {
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        data-testid={testId}
      >
        {children}
      </a>{" "}
      <a
        href={href}
        target="_self"
        className="text-xs text-stone-500 underline hover:text-bonnet"
        data-testid={`${testId}-here`}
      >
        (Open here)
      </a>
    </>
  );
}
