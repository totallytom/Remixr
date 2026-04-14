import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useAlerts, type AlertItem, type AlertType } from '../contexts/AlertContext';

const icons: Record<AlertType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 flex-shrink-0" />,
  error: <XCircle className="w-5 h-5 flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
  info: <Info className="w-5 h-5 flex-shrink-0" />,
};

const styles: Record<AlertType, string> = {
  success: 'bg-emerald-500/95 text-white border-emerald-400/50',
  error: 'bg-red-500/95 text-white border-red-400/50',
  warning: 'bg-amber-500/95 text-white border-amber-400/50',
  info: 'bg-violet-500/95 text-white border-violet-400/50',
};

export default function AlertToast() {
  const { alerts, removeAlert } = useAlerts();

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md w-full pointer-events-none"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={() => removeAlert(alert.id)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AlertItem({ alert, onDismiss }: { alert: AlertItem; onDismiss: () => void }) {
  const style = styles[alert.type];
  const icon = icons[alert.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 80 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-start gap-3 rounded-xl border shadow-lg p-4 ${style}`}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        {alert.title && (
          <p className="font-semibold text-sm mb-0.5">{alert.title}</p>
        )}
        <p className="text-sm leading-snug">{alert.message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
