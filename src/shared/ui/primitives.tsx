import type { ComponentProps, ReactNode } from "react";
import styles from "./ui.module.css";

function classes(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(" ");
}
export type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium";
  loading?: boolean;
  loadingLabel?: string;
};
export function Button({ variant = "primary", size = "medium", loading = false, loadingLabel = "Working…", disabled, type = "button", className, children, ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes(styles.button, styles[variant], size === "small" ? styles.small : undefined, className)}>
    {loading ? <><span className={styles.spinner} aria-hidden="true" />{loadingLabel}</> : children}
  </button>;
}
export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <span {...props} className={classes(styles.badge, styles[tone], className)} />;
}
export function Alert({ title, children, tone = "info", announce = false, className, ...props }: Omit<ComponentProps<"div">, "title" | "role"> & { title: string; tone?: "info" | "success" | "warning" | "danger"; announce?: boolean }) {
  return <div {...props} role={announce ? (tone === "danger" ? "alert" : "status") : undefined} className={classes(styles.alert, styles[tone], className)}>
    <strong className={styles.alertTitle}>{title}</strong>
    {children && <div className={styles.alertBody}>{children}</div>}
  </div>;
}
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={classes(styles.card, className)} />;
}
export function EmptyState({ title, description, action, className, ...props }: Omit<ComponentProps<"div">, "title"> & { title: string; description: string; action?: ReactNode }) {
  return <div {...props} className={classes(styles.empty, className)}>
    <p className={styles.emptyTitle}>{title}</p><p className={styles.emptyDescription}>{description}</p>
    {action && <div className={styles.emptyAction}>{action}</div>}
  </div>;
}
/** Decorative only. Put one readable loading status on the containing region. */
export function Skeleton({ className, ...props }: Omit<ComponentProps<"div">, "children" | "aria-hidden">) {
  return <div {...props} aria-hidden="true" className={classes(styles.skeleton, className)} />;
}
