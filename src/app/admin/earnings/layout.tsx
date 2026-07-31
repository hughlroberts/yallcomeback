export default function EarningsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Shell is per-page so each can pass `active` - children only
  return children;
}
