import { useEffect, useState } from 'react';

const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

export function useHoverCapable() {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(HOVER_QUERY);
    const sync = () => setCanHover(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return canHover;
}
