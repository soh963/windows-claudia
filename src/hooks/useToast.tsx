import * as React from "react";
import { Toast, ToastContainer, ToastType } from "@/components/ui/toast";

interface ToastData {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastData[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const showToast = React.useCallback((message: string, type: ToastType = "info", duration: number = 3000) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: ToastData = { id, message, type, duration };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    // Return a no-op implementation instead of throwing to prevent React Error #130
    console.warn("useToast called outside ToastProvider, providing fallback implementation");
    return {
      toasts: [] as ToastData[],
      showToast: (message: string, type?: ToastType, _duration?: number) => {
        console.log(`[Toast Fallback] ${type?.toUpperCase() || 'INFO'}: ${message}`);
      },
      dismissToast: (id: string) => {
        console.log(`[Toast Fallback] Dismiss: ${id}`);
      }
    } as ToastContextType;
  }
  return context;
};