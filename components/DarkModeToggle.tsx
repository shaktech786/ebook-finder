'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from '@heroicons/react/24/solid';

export default function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check localStorage for saved preference (default to light mode for first-time visitors)
    const savedMode = localStorage.getItem('darkMode');
    const shouldBeDark = savedMode === 'true';

    setDarkMode(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));

    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="fixed bottom-6 right-6 bg-gray-200 dark:bg-gray-700 p-3 sm:p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50 touch-manipulation"
      aria-label="Toggle dark mode"
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {darkMode ? (
        <MoonIcon className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
      ) : (
        <SunIcon className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-500" />
      )}
    </button>
  );
}
