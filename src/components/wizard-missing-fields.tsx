/** Visible list of required fields when wizard Next is disabled. */
export function WizardMissingFields({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-950"
      role="status"
    >
      <p className="font-medium">Still needed to continue:</p>
      <ul className="mt-1 list-disc pl-5">
        {missing.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
