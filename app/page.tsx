'use client';

import { useState, useEffect } from 'react';
import SearchBar from '@/components/SearchBar';
import BookGrid from '@/components/BookGrid';
import KindleEmailModal from '@/components/KindleEmailModal';
import DarkModeToggle from '@/components/DarkModeToggle';
import { Book, SearchResult } from '@/lib/types';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kindleEmail, setKindleEmail] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<string>('');

  // Load Kindle email from localStorage on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('kindleEmail');
    if (savedEmail) {
      setKindleEmail(savedEmail);
    }
  }, []);

  // Save Kindle email to localStorage
  const handleSaveKindleEmail = (email: string) => {
    setKindleEmail(email);
    localStorage.setItem('kindleEmail', email);
  };

  // Handle search
  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentQuery(query);
    setBooks([]);

    try {
      // Try multiple sources in parallel, with fallback
      const sources = [
        { name: 'openlibrary', url: `/api/search/openlibrary?q=${encodeURIComponent(query)}` },
        { name: 'gutenberg', url: `/api/search/gutenberg?q=${encodeURIComponent(query)}` },
        { name: 'libgen', url: `/api/search/libgen?q=${encodeURIComponent(query)}` },
      ];

      // Search all sources in parallel
      const results = await Promise.allSettled(
        sources.map(async (source) => {
          const response = await fetch(source.url);
          const data: SearchResult = await response.json();

          if (!response.ok) {
            throw new Error(data.error || `${source.name} search failed`);
          }

          return data.books;
        })
      );

      // Combine results from successful searches
      const allBooks: Book[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allBooks.push(...result.value);
        } else {
          console.warn(`${sources[index].name} search failed:`, result.reason);
        }
      });

      // Remove duplicates based on title + author
      const uniqueBooks = allBooks.reduce((acc, book) => {
        const key = `${book.title}-${book.author}`.toLowerCase();
        if (!acc.has(key)) {
          acc.set(key, book);
        }
        return acc;
      }, new Map<string, Book>());

      const finalBooks = Array.from(uniqueBooks.values());
      setBooks(finalBooks);

      if (finalBooks.length === 0) {
        setError('No books found. Try a different search term.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search for books');
      setBooks([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md border-b-4 border-blue-600 dark:border-blue-500 transition-colors duration-300">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100">📚 Free Ebook Finder</h1>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mt-2">
                Find and send free ebooks to your Kindle
              </p>
            </div>
            <div className="w-full sm:w-auto">
              {kindleEmail ? (
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="w-full sm:w-auto bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-6 py-3 rounded-xl text-base sm:text-lg font-semibold transition-colors border-2 border-gray-300 dark:border-gray-600 truncate text-gray-900 dark:text-gray-100"
                  title={kindleEmail}
                >
                  <span className="hidden sm:inline">Kindle: </span>{kindleEmail}
                </button>
              ) : (
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-xl text-base sm:text-lg font-bold transition-colors shadow-md"
                >
                  Set Kindle Email
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Search Bar */}
        <div className="mb-12">
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-16">
            <svg className="animate-spin h-20 w-20 mx-auto text-blue-600 mb-6" viewBox="0 0 24 24">
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
            <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-700 dark:text-gray-300 px-4">
              Searching for "{currentQuery}"...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 dark:bg-red-900/30 border-4 border-red-200 dark:border-red-700 rounded-2xl p-6 sm:p-8 text-center">
            <svg
              className="mx-auto h-16 sm:h-20 w-16 sm:w-20 text-red-500 dark:text-red-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-red-700 dark:text-red-400 px-4">{error}</p>
          </div>
        )}

        {/* Results */}
        {!isLoading && hasSearched && !error && (
          <BookGrid
            books={books}
            kindleEmail={kindleEmail}
            onSetKindleEmail={() => setShowEmailModal(true)}
          />
        )}

        {/* Welcome State */}
        {!hasSearched && !isLoading && (
          <div className="text-center py-8 sm:py-16 px-4">
            <div className="text-6xl sm:text-8xl mb-6 sm:mb-8">📖</div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4 sm:mb-6">
              Welcome to Free Ebook Finder
            </h2>
            <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4 text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400">
              <p>
                Search for free ebooks from trusted sources like Library Genesis,
                Project Gutenberg, and more.
              </p>
              <p>
                Send books directly to your Kindle with one click!
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/30 border-4 border-blue-200 dark:border-blue-700 rounded-2xl p-4 sm:p-6 mt-6 sm:mt-8">
                <p className="font-semibold text-xl sm:text-2xl mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">Getting Started:</p>
                <ol className="text-left list-decimal list-inside space-y-2 sm:space-y-3 text-sm sm:text-base md:text-lg text-gray-700 dark:text-gray-300">
                  <li>Set your Kindle email address (click button above)</li>
                  <li>Search for any book by title, author, or topic</li>
                  <li>Click "Send to Kindle" on any book you want</li>
                  <li>The book will appear on your Kindle in minutes!</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Kindle Email Modal */}
      <KindleEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSave={handleSaveKindleEmail}
        currentEmail={kindleEmail}
      />

      {/* Dark Mode Toggle */}
      <DarkModeToggle />
    </div>
  );
}
