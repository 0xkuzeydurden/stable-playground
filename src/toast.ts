import { useEffect, useState } from 'react';
type ToastMessage = { text: string; type: 'success' | 'error'; link?: string };
const listeners: Array<(value: ToastMessage | null) => void> = [];
export const toast = {
  show(message: ToastMessage) {
    listeners.forEach((listener) => listener(message));
    setTimeout(() => listeners.forEach((listener) => listener(null)), 5000);
  },
  subscribe(listener: (value: ToastMessage | null) => void) {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  },
};
export function useToast() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  useEffect(() => toast.subscribe(setMessage), []);
  return message;
}
