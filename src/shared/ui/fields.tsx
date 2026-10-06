"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import styles from "./ui.module.css";

type FieldMeta = {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};
function useField(
  id: string | undefined,
  describedBy: string | undefined,
  hint?: string,
  error?: string,
) {
  const generated = useId();
  const controlId = id ?? generated;
  return {
    id: controlId,
    description:
      [
        describedBy,
        hint ? controlId + "-hint" : undefined,
        error ? controlId + "-error" : undefined,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
  };
}
function FieldFrame({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldMeta & {
  id: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && (
        <p id={id + "-hint"} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={id + "-error"} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
type InputType =
  | "text"
  | "email"
  | "password"
  | "search"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "time"
  | "datetime-local";
export type InputFieldProps = Omit<ComponentProps<"input">, "type"> &
  FieldMeta & { type?: InputType };
export function InputField({
  label,
  hint,
  error,
  containerClassName,
  id,
  className,
  required,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  type = "text",
  ...props
}: InputFieldProps) {
  const field = useField(id, describedBy, hint, error);
  return (
    <FieldFrame
      {...{ label, hint, error, required }}
      id={field.id}
      className={containerClassName}
    >
      <input
        {...props}
        id={field.id}
        type={type}
        required={required}
        aria-describedby={field.description}
        aria-invalid={error ? true : invalid}
        className={[styles.control, className].filter(Boolean).join(" ")}
      />
    </FieldFrame>
  );
}
export function TextareaField({
  label,
  hint,
  error,
  containerClassName,
  id,
  className,
  required,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  rows = 4,
  ...props
}: ComponentProps<"textarea"> & FieldMeta) {
  const field = useField(id, describedBy, hint, error);
  return (
    <FieldFrame
      {...{ label, hint, error, required }}
      id={field.id}
      className={containerClassName}
    >
      <textarea
        {...props}
        id={field.id}
        rows={rows}
        required={required}
        aria-describedby={field.description}
        aria-invalid={error ? true : invalid}
        className={[styles.control, styles.textarea, className]
          .filter(Boolean)
          .join(" ")}
      />
    </FieldFrame>
  );
}
export function SelectField({
  label,
  hint,
  error,
  containerClassName,
  id,
  className,
  required,
  children,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: ComponentProps<"select"> & FieldMeta) {
  const field = useField(id, describedBy, hint, error);
  return (
    <FieldFrame
      {...{ label, hint, error, required }}
      id={field.id}
      className={containerClassName}
    >
      <select
        {...props}
        id={field.id}
        required={required}
        aria-describedby={field.description}
        aria-invalid={error ? true : invalid}
        className={[styles.control, className].filter(Boolean).join(" ")}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
export function Checkbox({
  label,
  hint,
  error,
  containerClassName,
  id,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: Omit<ComponentProps<"input">, "type"> & FieldMeta) {
  const field = useField(id, describedBy, hint, error);
  return (
    <div
      className={[styles.field, containerClassName].filter(Boolean).join(" ")}
    >
      <label htmlFor={field.id} className={styles.checkboxLabel}>
        <input
          {...props}
          type="checkbox"
          id={field.id}
          aria-describedby={field.description}
          aria-invalid={error ? true : invalid}
          className={[styles.checkbox, className].filter(Boolean).join(" ")}
        />
        <span>
          {label}
          {props.required && <span aria-hidden="true"> *</span>}
        </span>
      </label>
      {hint && (
        <p id={field.id + "-hint"} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={field.id + "-error"} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
