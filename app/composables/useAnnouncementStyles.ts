export function useAnnouncementStyles(type: Ref<string> | ComputedRef<string>) {
  // CMDIY color-mode (cmdiy / cmdiy-dark) — replaces TME's useTheme().
  const { resolved } = useColorMode();
  const isDark = computed(() => resolved.value === 'dark');

  const bannerStyle = computed(() => {
    const t = type.value;
    if (isDark.value) {
      const styles: Record<string, Record<string, string>> = {
        info: {
          backgroundColor: 'oklch(25% 0.08 254)',
          borderBottom: '2px solid oklch(70% 0.165 254.624)',
          color: 'oklch(92% 0.004 286.32)',
        },
        success: {
          backgroundColor: 'oklch(25% 0.06 140)',
          borderBottom: '2px solid #6a9f33',
          color: 'oklch(92% 0.004 286.32)',
        },
        warning: {
          backgroundColor: 'oklch(88% 0.12 90)',
          borderBottom: '2px solid oklch(70% 0.14 85)',
          color: '#2f2f2f',
        },
        error: {
          backgroundColor: 'oklch(25% 0.06 25)',
          borderBottom: '2px solid #d63333',
          color: 'oklch(92% 0.004 286.32)',
        },
      };
      return styles[t] || styles.info;
    }
    const styles: Record<string, Record<string, string>> = {
      info: {
        backgroundColor: 'oklch(95% 0.05 254)',
        borderBottom: '2px solid oklch(80% 0.165 254.624)',
        color: 'oklch(21% 0.006 285.885)',
      },
      success: {
        backgroundColor: 'oklch(95% 0.05 140)',
        borderBottom: '2px solid #4a7023',
        color: 'oklch(21% 0.006 285.885)',
      },
      warning: {
        backgroundColor: 'oklch(97% 0.08 95)',
        borderBottom: '2px solid #f9e784',
        color: '#2f2f2f',
      },
      error: {
        backgroundColor: 'oklch(95% 0.05 25)',
        borderBottom: '2px solid #b22222',
        color: 'oklch(21% 0.006 285.885)',
      },
    };
    return styles[t] || styles.info;
  });

  const iconStyle = computed(() => {
    const t = type.value;
    if (isDark.value) {
      const colors: Record<string, string> = {
        info: 'oklch(70% 0.165 254.624)',
        success: '#6a9f33',
        warning: '#8b7500',
        error: '#d63333',
      };
      return { color: colors[t] || colors.info };
    }
    const colors: Record<string, string> = {
      info: 'oklch(60% 0.2 254)',
      success: '#4a7023',
      warning: '#8b7500',
      error: '#b22222',
    };
    return { color: colors[t] || colors.info };
  });

  return { bannerStyle, iconStyle };
}
