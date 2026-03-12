import React, { createContext, useContext } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  return (
    <ToastContext.Provider value={{}}>
      {children}
    </ToastContext.Provider>
  )
}
