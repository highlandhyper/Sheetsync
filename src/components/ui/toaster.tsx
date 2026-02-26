"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastDescription,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, onOpenChange, ...props }) {
        return (
          <Toast key={id} onOpenChange={onOpenChange} {...props}>
            <div className="flex flex-col justify-center min-w-0 pr-2">
              {title && <ToastTitle variant={props.variant}>{title}</ToastTitle>}
              {description && (
                <div className={title ? "mt-0.5" : ""}>
                  <ToastDescription>{description}</ToastDescription>
                </div>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}