'use client';

import React from 'react';

// This component can be expanded later to include ThemeProvider for dark mode,
// React Query Provider, etc. For now, it's a simple wrapper.
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
