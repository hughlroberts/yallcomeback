/** Full-bleed inbox under admin chrome (cancels parent page padding). */
export default function AdminMessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -my-8 flex h-[calc(100vh-4.25rem-3.25rem)] min-h-[28rem] sm:-mx-6">
      <div className="min-h-0 w-full flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
