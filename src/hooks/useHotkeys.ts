import { useEffect } from 'react';

export function useHotkeys() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Example hotkeys
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            console.log('Save hotkey pressed');
            break;
          case 'z':
            event.preventDefault();
            console.log('Undo hotkey pressed');
            break;
          case 'y':
            event.preventDefault();
            console.log('Redo hotkey pressed');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}