'use client';

import { Book } from '@/lib/types';
import BookCard from './BookCard';

interface BookGridProps {
  books: Book[];
  kindleEmail: string | null;
  onSetKindleEmail: () => void;
}

export default function BookGrid({ books, kindleEmail, onSetKindleEmail }: BookGridProps) {
  if (books.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16 px-4">
        <svg
          className="mx-auto h-20 sm:h-24 w-20 sm:w-24 text-gray-400 dark:text-gray-500 mb-4 sm:mb-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-2xl sm:text-3xl font-bold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">No books found</h3>
        <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400">
          Try a different search term or check your spelling
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8 px-4 sm:px-0">
        <p className="text-xl sm:text-2xl font-semibold text-gray-700 dark:text-gray-300">
          Found {books.length} {books.length === 1 ? 'book' : 'books'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            kindleEmail={kindleEmail}
            onSetKindleEmail={onSetKindleEmail}
          />
        ))}
      </div>
    </div>
  );
}
