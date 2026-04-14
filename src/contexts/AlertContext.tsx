import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  message: string;
  type: AlertType;
  title?: string;
  createdAt: number;
}

interface AlertContextValue {
  alerts: AlertItem[];
  addAlert: (message: string, type?: AlertType, title?: string) => string;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addAlert = useCallback(
    (message: string, type: AlertType = 'info', title?: string): string => {
      const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const item: AlertItem = {
        id,
        message,
        type,
        title,
        createdAt: Date.now(),
      };
      setAlerts((prev) => [...prev.slice(-19), item]); // keep last 20
      const t = setTimeout(() => removeAlert(id), AUTO_DISMISS_MS);
      return id;
    },
    [removeAlert]
  );

  const clearAlerts = useCallback(() => setAlerts([]), []);

  const value = useMemo(
    () => ({ alerts, addAlert, removeAlert, clearAlerts }),
    [alerts, addAlert, removeAlert, clearAlerts]
  );

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error('useAlerts must be used within AlertProvider');
  }
  return ctx;
}
