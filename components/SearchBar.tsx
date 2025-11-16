'use client';

import { useState, FormEvent } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export default function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto px-4 sm:px-0">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, author, ISBN..."
          className="w-full px-4 sm:px-6 py-4 sm:py-5 pr-24 sm:pr-32 text-lg sm:text-xl md:text-2xl border-4 border-gray-300 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900 shadow-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-xl transition-colors shadow-md"
        >
          {isLoading ? (
            <span className="flex items-center gap-1 sm:gap-2">
              <svg className="animate-spin h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="hidden sm:inline">Searching...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 sm:gap-2">
              <MagnifyingGlassIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden sm:inline">Search</span>
            </span>
          )}
        </button>
      </div>

      {/* Search hints */}
      <div className="mt-3 sm:mt-4 text-center text-gray-600 dark:text-gray-400 px-2">
        <p className="text-sm sm:text-base md:text-lg">
          Try: <span className="font-semibold">"Harry Potter"</span>,{' '}
          <span className="font-semibold">"by Stephen King"</span>, or{' '}
          <span className="font-semibold">"books about space"</span>
        </p>
      </div>
    </form>
  );
}
