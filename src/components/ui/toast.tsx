"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  CloudOff,
  Info,
  KeyRound,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wifi,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed inset-x-0 top-2 z-[100] flex max-h-screen w-full flex-col gap-2 px-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[380px] sm:px-0",
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden",
    "rounded-xl border p-4 pr-10",
    "bg-white/95 dark:bg-neutral-950/95 text-black dark:text-white",
    "border-neutral-200 dark:border-white/10",
    "shadow-lg shadow-black/[0.06] dark:shadow-black/40",
    "supports-[backdrop-filter]:backdrop-blur-xl",
    "transition-all",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
    "data-[state=open]:slide-in-from-top-2",
    "data-[state=closed]:slide-out-to-top-2",
    "sm:data-[state=open]:slide-in-from-right-4",
    "sm:data-[state=closed]:slide-out-to-right-full",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "",
        destructive:
          "border-red-200 dark:border-red-500/20 bg-red-50/80 dark:bg-red-500/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  >
    {props.children}
  </ToastPrimitives.Root>
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-3 text-[12px] font-medium",
      "text-neutral-700 dark:text-neutral-300",
      "transition-colors hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-black dark:hover:text-white",
      "focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-white/20",
      "disabled:pointer-events-none disabled:opacity-50",
      "group-[.destructive]:border-red-200 dark:group-[.destructive]:border-red-500/20 group-[.destructive]:hover:bg-red-50 dark:group-[.destructive]:hover:bg-red-500/10 group-[.destructive]:hover:text-red-600 dark:group-[.destructive]:hover:text-red-400",
      className,
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    toast-close=""
    className={cn(
      "absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg",
      "text-neutral-400 dark:text-neutral-500 transition-colors",
      "hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-black dark:hover:text-white",
      "focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-white/20",
      className,
    )}
    {...props}
  >
    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
    <span className="sr-only">Close notification</span>
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

function getToastIcon(
  children: React.ReactNode,
  variant?: "default" | "destructive" | null,
) {
  if (variant === "destructive") {
    return AlertCircle
  }

  const text = String(children ?? "").toLowerCase()

  if (
    text.includes("success") ||
    text.includes("saved") ||
    text.includes("registered") ||
    text.includes("applied") ||
    text.includes("complete") ||
    text.includes("logged") ||
    text.includes("unlocked")
  ) {
    return CheckCircle2
  }

  if (text.includes("sync") || text.includes("processing")) {
    return RefreshCw
  }

  if (text.includes("authorized")) {
    return ShieldCheck
  }

  if (
    text.includes("locked") ||
    text.includes("password") ||
    text.includes("credential")
  ) {
    return KeyRound
  }

  if (text.includes("alert") || text.includes("request")) {
    return Bell
  }

  if (
    text.includes("delete") ||
    text.includes("deleted") ||
    text.includes("removed")
  ) {
    return Trash2
  }

  if (
    text.includes("edit") ||
    text.includes("edited") ||
    text.includes("updated")
  ) {
    return Pencil
  }

  if (text.includes("cloud") || text.includes("offline")) {
    return CloudOff
  }

  if (text.includes("online")) {
    return Wifi
  }

  return Info
}

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title> & {
    variant?: "default" | "destructive" | null
  }
>(({ className, variant, children, ...props }, ref) => {
  const Icon = getToastIcon(children, variant)
  const isRefreshing = Icon === RefreshCw
  const isDestructive = variant === "destructive"

  return (
    <ToastPrimitives.Title
      ref={ref}
      className={cn(
        "flex min-w-0 items-start gap-3 text-[14px] font-medium leading-5",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
          isDestructive
            ? "border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400"
            : "border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-600 dark:text-neutral-300",
        )}
      >
        <Icon
          className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          strokeWidth={1.75}
        />
      </div>

      <span className="min-w-0 flex-1 break-words pr-1 pt-1">
        {children}
      </span>
    </ToastPrimitives.Title>
  )
})
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "ml-11 -mt-0.5 text-[13px] leading-5 text-neutral-500 dark:text-neutral-400",
      className,
    )}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>
type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
