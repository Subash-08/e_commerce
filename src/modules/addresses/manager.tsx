"use client";
import { useState, useTransition } from "react";
import { stateCodes } from "../shipping/contracts";
import type { SavedAddressDto } from "./contracts";
import { deleteAddressAction, saveAddressAction } from "./actions";

export function AddressManager({ initial }: { initial: SavedAddressDto[] }) {
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<SavedAddressDto | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const current = editing === "new" ? null : editing;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-violet-700">
            Your account
          </span>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Saved addresses
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Save up to 10 Indian delivery and billing addresses.
          </p>
        </div>
        <button
          type="button"
          disabled={addresses.length >= 10}
          onClick={() => {
            setEditing("new");
            setMessage("");
          }}
          className="min-h-10 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add address
        </button>
      </header>
      {message && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm" role="status">
          {message}
        </p>
      )}
      {!addresses.length && editing === null ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="font-semibold">No saved addresses</h2>
          <p className="mt-2 text-sm text-slate-600">
            Add one to fill checkout faster. Guest checkout remains available.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <article
              key={address.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">
                    {address.label}
                  </h2>
                  <p className="mt-1 text-sm font-medium">{address.name}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1 text-xs">
                  {address.defaultShipping && (
                    <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">
                      Delivery default
                    </span>
                  )}
                  {address.defaultBilling && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                      Billing default
                    </span>
                  )}
                </div>
              </div>
              <address className="mt-4 text-sm not-italic leading-6 text-slate-600">
                {address.line1}
                {address.line2 && <>, {address.line2}</>}
                <br />
                {address.landmark && <>{address.landmark}, </>}
                {address.city}
                {address.district && ", " + address.district}
                <br />
                {address.stateCode} {address.postalCode} · {address.mobile}
              </address>
              <div className="mt-4 flex gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(address);
                    setMessage("");
                  }}
                  className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("Remove " + address.label + "?"))
                      return;
                    start(async () => {
                      const result = await deleteAddressAction({
                        id: address.id,
                        revision: address.revision,
                      });
                      setMessage(result.message);
                      if (result.ok) {
                        setAddresses(result.addresses);
                        if (editing !== "new" && editing?.id === address.id)
                          setEditing(null);
                      }
                    });
                  }}
                  className="min-h-10 rounded-lg px-3 text-sm font-semibold text-red-700"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <form
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const text = (name: string) => String(form.get(name) ?? "").trim();
            start(async () => {
              const result = await saveAddressAction({
                ...(current
                  ? { id: current.id, revision: current.revision }
                  : { revision: 0 }),
                label: text("label"),
                name: text("name"),
                mobile: text("mobile"),
                line1: text("line1"),
                line2: text("line2"),
                landmark: text("landmark"),
                city: text("city"),
                district: text("district"),
                stateCode: text("stateCode"),
                postalCode: text("postalCode"),
                countryCode: "IN",
                defaultShipping: form.has("defaultShipping"),
                defaultBilling: form.has("defaultBilling"),
              });
              setMessage(result.message);
              if (result.ok) {
                setAddresses(result.addresses);
                setEditing(null);
              }
            });
          }}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {current ? "Edit address" : "Add address"}
              </h2>
              <p className="text-sm text-slate-600">
                Required fields are validated again by the server.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-10 px-3 text-sm"
            >
              Cancel
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label">
              <input
                name="label"
                required
                maxLength={40}
                defaultValue={current?.label ?? ""}
                placeholder="Home, Office"
              />
            </Field>
            <Field label="Recipient name">
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={current?.name ?? ""}
                autoComplete="name"
              />
            </Field>
            <Field label="Mobile">
              <input
                name="mobile"
                required
                pattern="[6-9][0-9]{9}"
                defaultValue={current?.mobile ?? ""}
                inputMode="numeric"
              />
            </Field>
            <Field label="Address line 1" wide>
              <input
                name="line1"
                required
                maxLength={150}
                defaultValue={current?.line1 ?? ""}
              />
            </Field>
            <Field label="Address line 2" wide>
              <input
                name="line2"
                maxLength={150}
                defaultValue={current?.line2 ?? ""}
              />
            </Field>
            <Field label="Landmark">
              <input
                name="landmark"
                maxLength={100}
                defaultValue={current?.landmark ?? ""}
              />
            </Field>
            <Field label="City">
              <input
                name="city"
                required
                maxLength={100}
                defaultValue={current?.city ?? ""}
              />
            </Field>
            <Field label="District">
              <input
                name="district"
                maxLength={100}
                defaultValue={current?.district ?? ""}
              />
            </Field>
            <Field label="State / UT">
              <select
                name="stateCode"
                required
                defaultValue={current?.stateCode ?? ""}
              >
                <option value="" disabled>
                  Select state
                </option>
                {stateCodes.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </Field>
            <Field label="PIN code">
              <input
                name="postalCode"
                required
                pattern="[1-9][0-9]{5}"
                defaultValue={current?.postalCode ?? ""}
                inputMode="numeric"
              />
            </Field>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="defaultShipping"
                defaultChecked={current?.defaultShipping}
              />
              Default delivery address
            </label>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="defaultBilling"
                defaultChecked={current?.defaultBilling}
              />
              Default billing address
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              disabled={pending}
              className="min-h-11 rounded-lg bg-violet-600 px-5 font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save address"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "grid gap-1.5 text-sm font-medium " +
    (wide ? "sm:col-span-2 " : "") +
    "[&_input]:min-h-11 [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-300 [&_input]:px-3 [&_select]:min-h-11 [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-300 [&_select]:px-3";
  return (
    <label className={className}>
      {label}
      {children}
    </label>
  );
}
