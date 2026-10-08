"use client";

import { useRef, type ReactNode } from "react";

export function CatalogFilterDrawer({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="sf-mobile-filter">
      <button
        type="button"
        className="sf-filter-trigger"
        onClick={() => dialog.current?.showModal()}
      >
        <span aria-hidden="true">☷</span> Filters
      </button>
      <dialog ref={dialog} className="sf-filter-dialog">
        <div className="sf-filter-dialog-head">
          <strong>Filter products</strong>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="sf-filter-dialog-body">{children}</div>
      </dialog>
    </div>
  );
}
