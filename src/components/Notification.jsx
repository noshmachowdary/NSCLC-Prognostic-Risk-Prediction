import { AlertTriangle, X } from "lucide-react";
import { useEffect } from "react";

function Notification({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-[200] -translate-x-1/2 animate-fade-in-up">
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-xl dark:border-amber-800 dark:bg-amber-900/40">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-200">{message}</p>
        <button
          onClick={onClose}
          className="ml-2 text-amber-400 hover:text-amber-600 dark:hover:text-amber-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Notification;
