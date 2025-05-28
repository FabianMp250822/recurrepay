
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

    async function applyThemeSettings() {
      if (initialLoadComplete && isMounted) { // No need to check for isAdmin or user for theme application
        try {
          const settings: AppGeneralSettings = await fetchGeneralSettingsAction();
          
          if (settings.themePrimary) {
            document.documentElement.style.setProperty('--primary', settings.themePrimary);
          }
          if (settings.themeSecondary) {
            document.documentElement.style.setProperty('--secondary', settings.themeSecondary);
          }
          if (settings.themeAccent) {
            document.documentElement.style.setProperty('--accent', settings.themeAccent);
          }
          if (settings.themeBackground) {
            document.documentElement.style.setProperty('--background', settings.themeBackground);
          }
          if (settings.themeForeground) {
            document.documentElement.style.setProperty('--foreground', settings.themeForeground);
          }
          // Potentially add more for card, popover, border, input, ring if you make them configurable.
          // Also consider dark theme variables (--dark-primary, etc.) if you want separate dark theme customization.
          
        } catch (error) {
          console.error("Error applying theme settings:", error);
          // Defaults from globals.css will apply
        }
      }
    }

    applyThemeSettings();

    return () => {
      isMounted = false;
    };
  }, [initialLoadComplete]); // Re-run if auth state changes, though settings are app-wide

  return null; // This component does not render anything itself
}
