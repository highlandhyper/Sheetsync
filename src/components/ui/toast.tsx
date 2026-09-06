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
      "fixed inset-x-0 top-2 z-[100] flex max-h-screen w-full flex-col gap-2 px-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[390px] sm:px-0",
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden",
    "rounded-2xl border p-4 pr-10",
    "bg-background/95 text-foreground shadow-xl shadow-black/[0.08]",
    "supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-xl",
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
        default:
          "border-border/60",
        destructive:
          "destructive border-destructive/20 bg-destructive/[0.06] text-foreground",
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
      "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/70 px-3 text-xs font-semibold",
      "transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "group-[.destructive]:border-destructive/20 group-[.destructive]:hover:bg-destructive/10 group-[.destructive]:hover:text-destructive",
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
      "absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg",
      "text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground",
      "focus:outline-none focus:ring-2 focus:ring-ring",
      className,
    )}
    {...props}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close notification</span>
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

function getToastIcon(
  children: React.ReactNode,
  variant?: "default" | "destructive",
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
    text.includes("logged")
  ) {
    return CheckCircle2
  }

  if (text.includes("sync") || text.includes("processing")) {
    return RefreshCw
  }

  if (text.includes("unlocked") || text.includes("authorized")) {
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
    variant?: "default" | "destructive"
  }
>(({ className, variant, children, ...props }, ref) => {
  const Icon = getToastIcon(children, variant)
  const isRefreshing = Icon === RefreshCw

  return (
    <ToastPrimitives.Title
      ref={ref}
      className={cn(
        "flex min-w-0 items-start gap-3 text-sm font-semibold leading-5",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          variant === "destructive"
            ? "border-destructive/15 bg-destructive/10 text-destructive"
            : "border-primary/15 bg-primary/10 text-primary",
        )}
      >
        <Icon className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
      </div>

      <span className="min-w-0 flex-1 break-words pr-1">
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
      "ml-12 -mt-1 text-xs leading-5 text-muted-foreground",
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
