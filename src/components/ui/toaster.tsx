"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="right">
      <ToastViewport />
      <div className="flex flex-col gap-3">
        {toasts.map(function ({ id, title, description, action, onOpenChange, ...props }) {
          return (
            <Toast key={id} onOpenChange={onOpenChange} {...props} duration={4000}>
              <div className="flex flex-col justify-center min-w-0 pr-2">
                {title && <ToastTitle variant={props.variant}>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
              <ToastClose />
            </Toast>
          )
        })}
      </div>
    </ToastProvider>
  )
}
