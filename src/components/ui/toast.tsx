"use client"

import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Info, AlertCircle, X } from "lucide-react"

interface ToastProps {
  message: string
  type?: "success" | "error" | "info" | "warning"
  duration?: number
  onClose?: () => void
}

export function Toast({ message, type = "info", duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertCircle,
  }

  const colors = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  }

  const Icon = icons[type]

  return (
    <div className={`fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300`}>
      <div className={`flex items-center gap-3 p-4 rounded-lg border shadow-lg max-w-sm ${colors[type]}`}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">{message}</p>
        <button
          onClick={() => {
            setIsVisible(false)
            onClose?.()
          }}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Toast context and hook for global usage
export function useToast() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([])

  const showToast = (props: Omit<ToastProps, "onClose">) => {
    const id = Math.random().toString(36).substring(2)
    const toast = { ...props, id }
    
    setToasts(prev => [...prev, toast])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, props.duration || 3000)
  }

  const ToastContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(({ id, ...props }) => (
        <Toast key={id} {...props} onClose={() => setToasts(prev => prev.filter(t => t.id !== id))} />
      ))}
    </div>
  )

  return { showToast, ToastContainer }
} 