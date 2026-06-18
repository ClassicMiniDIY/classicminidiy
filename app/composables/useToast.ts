export type ToastColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  // Accept the legacy Mini Exchange color aliases ('green'/'red') so migrated
  // marketplace components calling add({ color: 'green' }) work unchanged; they
  // normalize to 'success'/'error' below.
  color?: ToastColor | 'green' | 'red';
  icon?: string;
  timeout?: number;
  // Mini Exchange components pass `duration` instead of `timeout`; treated as an alias.
  duration?: number;
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
    // Normalize legacy Mini Exchange color aliases.
    const color: ToastColor =
      options.color === 'green' ? 'success' : options.color === 'red' ? 'error' : (options.color ?? 'info');
    const record: ToastRecord = {
      id,
      title: options.title ?? '',
      description: options.description ?? '',
      color,
      icon: normalizeIcon(options.icon),
      timeout: options.duration ?? options.timeout ?? 5000,
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
