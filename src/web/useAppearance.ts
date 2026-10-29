import { useEffect, useState } from 'react';

type Appearance = 'anime' | 'classic';
const storageKey = 'agent-office:appearance';

export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try { return localStorage.getItem(storageKey) === 'classic' ? 'classic' : 'anime'; }
    catch { return 'anime'; } // Storage may be disabled; the visual preference still works in memory.
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, appearance); }
    catch { /* Optional persistence must not prevent using the office. */ }
  }, [appearance]);
  return { appearance, setAppearance };
}
