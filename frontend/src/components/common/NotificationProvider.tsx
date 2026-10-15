import { toast } from 'sonner';

import { Toaster } from 'src/components/shadui/sonner';

type Severity = 'success' | 'error' | 'warning' | 'info';

const notificationConfig = {
  maxCount: 5,
  autoHideDuration: 4000,
  position: 'top-right',
} as const;

function NotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* `richColors` is what makes the severities visually distinct — without it every
          toast is an identical card and only the icon changes. Sonner's own palette fills
          the whole toast with colour; we keep the normal surface and colour the text and
          border instead, which is quieter and works in both themes.
          Background is the same hue mixed into the surface, so it tints rather than fills.
          color-mix against --popover means it lightens in light mode and darkens in dark
          mode automatically, and the --success/--warning/--info tokens are already tuned
          per theme to stay legible (light values darker, dark values lighter). */}
      <Toaster
        position={notificationConfig.position}
        visibleToasts={notificationConfig.maxCount}
        duration={notificationConfig.autoHideDuration}
        richColors
        closeButton
        toastOptions={{ className: 'cn-toast' }}
        // Sonner ships its own richColors palette in an UNLAYERED stylesheet, which beats
        // anything we write in index.css (Tailwind puts our rules in @layer). It also picks
        // its theme from next-themes rather than the .dark class, so its dark palette never
        // applies here. Setting the variables inline wins over both and, because they point
        // at our tokens, they follow the theme correctly.
        //
        // Mixing in `srgb` rather than `oklch`: --popover is achromatic, and oklch mixing
        // against a zero-chroma colour loses the source hue (green came out pink).
        style={{
          '--success-text': 'var(--success)',
          '--success-bg': 'color-mix(in srgb, var(--success) 12%, var(--popover))',
          '--success-border': 'color-mix(in srgb, var(--success) 35%, var(--popover))',
          '--warning-text': 'var(--warning)',
          '--warning-bg': 'color-mix(in srgb, var(--warning) 12%, var(--popover))',
          '--warning-border': 'color-mix(in srgb, var(--warning) 35%, var(--popover))',
          '--error-text': 'var(--destructive)',
          '--error-bg': 'color-mix(in srgb, var(--destructive) 12%, var(--popover))',
          '--error-border': 'color-mix(in srgb, var(--destructive) 35%, var(--popover))',
          '--info-text': 'var(--info)',
          '--info-bg': 'color-mix(in srgb, var(--info) 12%, var(--popover))',
          '--info-border': 'color-mix(in srgb, var(--info) 35%, var(--popover))',
        } as React.CSSProperties}
      />
    </>
  );
}

// Kept as a hook so call sites stay unchanged from the notistack version.
function useNotification() {
  return (severity: Severity, message: React.ReactNode) => toast[severity](message);
}

export {
  NotificationProvider,
  useNotification,
};
