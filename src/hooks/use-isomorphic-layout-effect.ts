import { useEffect, useLayoutEffect } from 'react';

// Hook personalizado para evitar problemas de SSR con useLayoutEffect
export const useIsomorphicLayoutEffect = 
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;