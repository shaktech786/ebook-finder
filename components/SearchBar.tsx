'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { MagnifyingGlassIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

const MAX_HISTORY_ITEMS = 10;

export default function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredHistory, setFilteredHistory] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('searchHistory');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load search history:', e);
      }
    }
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter history based on query
  useEffect(() => {
    if (query.trim()) {
      const filtered = searchHistory.filter(item =>
        item.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredHistory(filtered);
    } else {
      setFilteredHistory(searchHistory);
    }
  }, [query, searchHistory]);

  const saveToHistory = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    // Remove duplicate and add to front
    const newHistory = [
      trimmed,
      ...searchHistory.filter(item => item !== trimmed)
    ].slice(0, MAX_HISTORY_ITEMS);

    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
    setShowSuggestions(false);
  };

  const removeHistoryItem = (item: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = searchHistory.filter(h => h !== item);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveToHistory(query.trim());
      onSearch(query.trim());
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto px-4 sm:px-0">
      <div className="relative" ref={wrapperRef}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
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

        {/* Search History Dropdown */}
        {showSuggestions && filteredHistory.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border-4 border-gray-300 dark:border-gray-600 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b-2 border-gray-200 dark:border-gray-700">
              <span className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
                Recent Searches
              </span>
              <button
                type="button"
                onClick={clearHistory}
                className="text-xs sm:text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold transition-colors"
              >
                Clear All
              </button>
            </div>
            <ul>
              {filteredHistory.map((item, index) => (
                <li
                  key={index}
                  onClick={() => selectSuggestion(item)}
                  className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors group border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ClockIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span className="text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">
                      {item}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => removeHistoryItem(item, e)}
                    className="ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg flex-shrink-0"
                    aria-label="Remove from history"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
