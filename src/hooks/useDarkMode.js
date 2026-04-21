import { useEffect, useState } from 'react';

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('bm:dark') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bm:dark', dark ? '1' : '0');
    } catch {}
    document.documentElement.classList.toggle('bm-dark', dark);
  }, [dark]);

  return [dark, setDark];
}
