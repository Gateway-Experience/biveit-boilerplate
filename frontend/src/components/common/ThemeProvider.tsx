import { ThemeProvider as NextThemesProvider } from 'next-themes';

import { TooltipProvider } from 'src/components/shadui/tooltip';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute='class' defaultTheme='light' enableSystem disableTransitionOnChange>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </NextThemesProvider>
  );
}
