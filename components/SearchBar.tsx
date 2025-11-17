'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { MagnifyingGlassIcon, ClockIcon, XMarkIcon, BookOpenIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

interface BookSuggestion {
  title: string;
  author: string;
  year?: string;
  coverUrl?: string;
  key: string;
}

const MAX_HISTORY_ITEMS = 10;
const SUGGESTION_LIMIT = 8;

export default function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredHistory, setFilteredHistory] = useState<string[]>([]);
  const [bookSuggestions, setBookSuggestions] = useState<BookSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Handle autofocus - show suggestions after a brief delay
  useEffect(() => {
    if (inputRef.current === document.activeElement) {
      // Input is focused (via autofocus), show suggestions after hydration
      const timer = setTimeout(() => {
        setShowSuggestions(true);
      }, 100);
      return () => clearTimeout(timer);
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

  // Fetch book suggestions with debouncing
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't fetch if query is too short
    if (query.trim().length < 2) {
      setBookSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    // Set loading state immediately
    setLoadingSuggestions(true);

    // Set debounce timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(query.trim())}&limit=${SUGGESTION_LIMIT}&fields=key,title,author_name,first_publish_year,cover_i`
        );

        if (!response.ok) throw new Error('Failed to fetch suggestions');

        const data = await response.json();

        const suggestions: BookSuggestion[] = (data.docs || []).map((doc: any) => ({
          title: doc.title || 'Unknown Title',
          author: doc.author_name?.[0] || 'Unknown Author',
          year: doc.first_publish_year?.toString(),
          coverUrl: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg`
            : undefined,
          key: doc.key || '',
        }));

        setBookSuggestions(suggestions);
      } catch (error) {
        console.error('Error fetching book suggestions:', error);
        setBookSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300); // 300ms debounce

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

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

  const selectSuggestion = (suggestion: string | BookSuggestion) => {
    const searchQuery = typeof suggestion === 'string' ? suggestion : suggestion.title;
    setQuery(searchQuery);
    setShowSuggestions(false);
    saveToHistory(searchQuery);
    onSearch(searchQuery);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto px-4 sm:px-0">
      <div className="relative" ref={wrapperRef}>
        <input
          ref={inputRef}
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

        {/* Suggestions Dropdown */}
        {showSuggestions && (filteredHistory.length > 0 || bookSuggestions.length > 0 || loadingSuggestions || query.trim().length === 0) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border-4 border-gray-300 dark:border-gray-600 rounded-2xl shadow-xl z-50 max-h-[32rem] overflow-y-auto">
            {/* Recent Searches Section */}
            {filteredHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
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
                      key={`history-${index}`}
                      onClick={() => selectSuggestion(item)}
                      className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors group border-b border-gray-100 dark:border-gray-700"
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

            {/* Empty State - No History */}
            {filteredHistory.length === 0 && query.trim().length === 0 && (
              <div className="px-4 sm:px-6 py-6 text-center">
                <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                  Start typing to search for books
                </p>
              </div>
            )}

            {/* Book Suggestions Section */}
            {query.trim().length >= 2 && (
              <div>
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    Book Suggestions
                  </span>
                  {loadingSuggestions && (
                    <svg className="animate-spin h-4 w-4 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                </div>
                <ul>
                  {bookSuggestions.length > 0 ? (
                    bookSuggestions.map((book, index) => (
                      <li
                        key={`suggestion-${index}`}
                        onClick={() => selectSuggestion(book)}
                        className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        {/* Book Cover */}
                        <div className="w-12 h-16 sm:w-14 sm:h-20 bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0 overflow-hidden">
                          {book.coverUrl ? (
                            <Image
                              src={book.coverUrl}
                              alt={book.title}
                              width={56}
                              height={80}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                              <BookOpenIcon className="h-6 w-6" />
                            </div>
                          )}
                        </div>

                        {/* Book Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {book.title}
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                            {book.author}
                            {book.year && ` • ${book.year}`}
                          </p>
                        </div>
                      </li>
                    ))
                  ) : !loadingSuggestions ? (
                    <li className="px-4 sm:px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No suggestions found
                    </li>
                  ) : null}
                </ul>
              </div>
            )}

            {/* Empty State - Query Too Short */}
            {query.trim().length === 1 && filteredHistory.length === 0 && (
              <div className="px-4 sm:px-6 py-6 text-center">
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                  Type at least 2 characters for suggestions
                </p>
              </div>
            )}
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
