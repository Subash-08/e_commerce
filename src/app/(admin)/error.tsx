"use client";
export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main className="p-8">
      <h1>Placeholder — route error</h1>
      <button onClick={reset}>Retry</button>
    </main>
  );
}
