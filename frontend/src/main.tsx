import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import routes from 'src/routes';
import AppProvider from 'src/components/common/AppProvider';
import { NotificationProvider } from 'src/components/common/NotificationProvider';
import ThemeProvider from 'src/components/common/ThemeProvider';
import 'src/styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60, // 24 hours
      staleTime: 60000, // 1 minute
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: window.localStorage,
});

createRoot(document.getElementById('root')!).render(
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister }}
  >
    <AppProvider>
      <ThemeProvider>
        <NotificationProvider>
          <BrowserRouter>
            {routes}
          </BrowserRouter>
        </NotificationProvider>
      </ThemeProvider>
    </AppProvider>
  </PersistQueryClientProvider>,
);
