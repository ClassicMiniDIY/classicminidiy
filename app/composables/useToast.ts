export type ToastColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  color?: ToastColor;
  icon?: string;
  timeout?: number;
}

export interface ToastRecord {
  id: string;
  title: string;
  description: string;
  color: ToastColor;
  icon: string;
  timeout: number;
}

function normalizeIcon(icon?: string): string {
  if (!icon) return '';
  if (icon.startsWith('i-fa6-solid-')) return `fas fa-${icon.replace('i-fa6-solid-', '')}`;
  if (icon.startsWith('i-fa6-regular-')) return `far fa-${icon.replace('i-fa6-regular-', '')}`;
  if (icon.startsWith('i-fa6-brands-')) return `fab fa-${icon.replace('i-fa6-brands-', '')}`;
  if (icon.startsWith('i-heroicons-')) return `fas fa-${icon.replace('i-heroicons-', '')}`;
  return icon;
}

export function useToast() {
  const toasts = useState<ToastRecord[]>('cmdiy:toasts', () => []);

  const add = (options: ToastOptions) => {
    const id = options.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record: ToastRecord = {
      id,
      title: options.title ?? '',
      description: options.description ?? '',
      color: options.color ?? 'info',
      icon: normalizeIcon(options.icon),
      timeout: options.timeout ?? 5000,
    };
    toasts.value.push(record);
    if (record.timeout > 0) {
      setTimeout(() => remove(id), record.timeout);
    }
    return record;
  };

  const remove = (id: string) => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  };

  const clear = () => {
    toasts.value = [];
  };

  return { add, remove, clear, toasts };
}
