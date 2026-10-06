export function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16" data-placeholder="true">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
        Stage 3 foundation
      </p>
      <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
      <p className="mt-6 rounded-lg border border-slate-300 bg-white p-5">
        Placeholder — not implemented.
      </p>
      <p className="mt-4 text-slate-600">
        This route contains no commerce features or live data. See
        docs/storefront/ROUTES.md for the approved contract.
      </p>
    </main>
  );
}
