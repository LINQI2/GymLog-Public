import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { uid } from '../lib/id';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, action?: ToastAction) => {
      const id = uid();
      setItems((prev) => [...prev.slice(-2), { id, message, action }]);
      const timer = window.setTimeout(() => dismiss(id), action ? 6000 : 2600);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 px-4 pb-[calc(5.6rem+env(safe-area-inset-bottom))]">
          {items.map((item) => (
            <div
              key={item.id}
              className="animate-toast-in pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-canvas shadow-xl"
            >
              <span className="flex-1 leading-snug">{item.message}</span>
              {item.action ? (
                <button
                  type="button"
                  className="tap shrink-0 rounded-lg bg-canvas/15 px-3 py-1.5 text-sm font-semibold"
                  onClick={() => {
                    item.action?.onClick();
                    dismiss(item.id);
                  }}
                >
                  {item.action.label}
                </button>
              ) : null}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内部使用');
  return ctx;
}
