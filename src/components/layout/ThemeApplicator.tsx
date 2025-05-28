
'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGeneralSettingsAction } from '@/app/actions/settingsActions';
import type { AppGeneralSettings } from '@/types';

// Helper function to safely set CSS variables
const setCssVariable = (variableName: string, value: string | number | undefined | null) => {
  if (value !== undefined && value !== null && value !== '') {
    document.documentElement.style.setProperty(variableName, String(value));
  }
};

export default function ThemeApplicator() {
  const { user, isAdmin, initialLoadComplete } = useAuth();

  useEffect(() => {
    let isMounted = true;

    async function applyThemeAndSettings() {
      if (initialLoadComplete && isMounted) {
        try {
          const settings: AppGeneralSettings = await fetchGeneralSettingsAction();
          
          // Apply theme colors
          if (settings.themePrimary) {
            setCssVariable('--primary', settings.themePrimary);
          }
          if (settings.themeSecondary) {
            setCssVariable('--secondary', settings.themeSecondary);
          }
          if (settings.themeAccent) {
            setCssVariable('--accent', settings.themeAccent);
          }
          if (settings.themeBackground) {
            setCssVariable('--background', settings.themeBackground);
          }
          if (settings.themeForeground) {
            setCssVariable('--foreground', settings.themeForeground);
          }

          // Update document title with appName
          if (settings.appName && document.title) {
            // Preserve any dynamic parts of the title (e.g., page specific) if possible,
            // or set a base title. For simplicity, we'll update the whole title.
            // Consider a more sophisticated title management strategy if needed.
            document.title = `${settings.appName} - Pagos Recurrentes Inteligentes`;
          }
          
        } catch (error) {
          console.error("Error applying theme or app settings:", error);
          // Defaults from globals.css will apply for theme
          // Default title from layout.tsx will remain for title
        }
      }
    }

    applyThemeAndSettings();

    return () => {
      isMounted = false;
    };
  }, [initialLoadComplete]);

  return null; // This component does not render anything itself
}
