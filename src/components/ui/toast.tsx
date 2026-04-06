"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { 
  AlertCircle, 
  Info, 
  X, 
  CheckCircle2, 
  RefreshCw, 
  Bell, 
  ShieldCheck, 
  KeyRound, 
  CloudOff, 
  Wifi, 
  Trash2, 
  Save, 
  Pencil 
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
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:right-0 md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-2xl border bg-card/90 p-5 pr-8 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-xl transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full",
  {
    variants: {
      variant: {
        default: "border-primary/20 border-l-primary/80",
        destructive:
          "destructive group border-destructive/30 bg-destructive/10 text-destructive-foreground border-l-destructive/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {/* Dynamic Glow Effect */}
      <div className={cn(
        "absolute -left-10 -top-10 h-32 w-32 blur-3xl opacity-20 pointer-events-none transition-colors",
        variant === 'destructive' ? "bg-destructive" : "bg-primary"
      )} />
      
      {/* Decorative Left Accent Bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-500",
        variant === 'destructive' ? "bg-destructive" : "bg-primary"
      )} />
      
      {props.children}
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest ring-offset-background transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
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
    className={cn(
      "absolute right-3 top-3 rounded-md p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title> & { variant?: 'default' | 'destructive' }
>(({ className, variant, ...props }, ref) => {
  const { children, ...cleanProps } = props as any;
  
  let Icon = Info;
  if (variant === 'destructive') {
    Icon = AlertCircle;
  } else {
    const text = String(children).toLowerCase();
    if (text.includes('success') || text.includes('saved') || text.includes('registered') || text.includes('applied') || text.includes('complete')) {
      Icon = CheckCircle2;
    } else if (text.includes('sync') || text.includes('processing')) {
      Icon = RefreshCw;
    } else if (text.includes('unlocked') || text.includes('authorized')) {
      Icon = ShieldCheck;
    } else if (text.includes('locked') || text.includes('password') || text.includes('credential')) {
      Icon = KeyRound;
    } else if (text.includes('alert') || text.includes('request')) {
      Icon = Bell;
    } else if (text.includes('delete') || text.includes('removed')) {
      Icon = Trash2;
    } else if (text.includes('edit') || text.includes('updated')) {
      Icon = Pencil;
    } else if (text.includes('cloud') || text.includes('offline')) {
      Icon = CloudOff;
    } else if (text.includes('online')) {
      Icon = Wifi;
    }
  }
  
  return (
    <ToastPrimitives.Title
      ref={ref}
      className={cn("text-[13px] font-black flex items-center gap-3 leading-none uppercase tracking-tighter", className)}
      {...cleanProps}
    >
      <div className={cn(
        "p-1.5 rounded-lg shadow-sm border",
        variant === 'destructive' ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-primary/10 text-primary border-primary/20"
      )}>
        <Icon className={cn("h-4 w-4 shrink-0", Icon === RefreshCw && "animate-spin")} />
      </div>
      {children}
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
    className={cn("text-[11px] font-semibold text-muted-foreground leading-tight mt-2 ml-10 opacity-80", className)}
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
