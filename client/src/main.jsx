import '@fontsource-variable/signika';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry only when the service was unreachable or failed; a 4xx will not fix itself.
      retry: (count, error) => (error?.status === 0 || error?.status >= 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
