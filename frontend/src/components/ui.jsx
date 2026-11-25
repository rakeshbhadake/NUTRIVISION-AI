import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import * as Dialog from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import { AlertCircle, LoaderCircle, Leaf, X } from "lucide-react";
import { cn } from "../utils/cn";
import { errorMessage } from "../utils/nutrition";

const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "btn-primary",
      outline: "btn-outline",
      ghost: "btn-ghost",
      orange: "btn-orange",
      danger: "btn-danger",
    },
    size: { default: "", sm: "btn-sm", icon: "btn-icon" },
  },
  defaultVariants: { variant: "primary", size: "default" },
});
export const Button = React.forwardRef(function Button(
  { className, variant, size, asChild = false, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </Comp>
  );
});
export function Card({ children, className, ...props }) {
  return (
    <section className={cn("card", className)} {...props}>
      {children}
    </section>
  );
}
export function Field({ label, error, hint, children, className }) {
  return (
    <label className={cn("field", className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
export const Input = React.forwardRef(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn("input", className)} {...props} />;
});
export function Select({ className, ...props }) {
  return <select className={cn("input", className)} {...props} />;
}
export function Badge({ children, className }) {
  return <span className={cn("badge", className)}>{children}</span>;
}
export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted page-description">{description}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}
export function EmptyState({ icon: Icon = Leaf, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={25} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Spinner({ label = "Loading your nutrition…" }) {
  return (
    <div className="spinner" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={24} />
      <div>
        <strong>We couldn’t load this yet</strong>
        <p>{errorMessage(error)}</p>
        {retry && (
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
export function NutritionMissing({ keys = [] }) {
  if (!keys.length) return null;
  return (
    <p className="nutrition-unknown-note">
      <AlertCircle size={14} />
      <span>
        {keys.join(", ")} information is incomplete for some foods. These totals
        include only known values.
      </span>
    </p>
  );
}
export function Modal({ open, onOpenChange, title, description, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content">
          <div className="modal-header">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={description ? "muted" : "sr-only"}>
            {description || title}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
