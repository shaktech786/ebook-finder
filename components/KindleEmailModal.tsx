'use client';

import { useState, FormEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface KindleEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (email: string) => void;
  currentEmail?: string | null;
}

export default function KindleEmailModal({ isOpen, onClose, onSave, currentEmail }: KindleEmailModalProps) {
  const [email, setEmail] = useState(currentEmail || '');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();

    // Validate email format
    if (!trimmedEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate it's a Kindle email
    if (!trimmedEmail.endsWith('@kindle.com') && !trimmedEmail.endsWith('@free.kindle.com')) {
      setError('Email must end with @kindle.com or @free.kindle.com');
      return;
    }

    onSave(trimmedEmail);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="h-7 w-7 sm:h-8 sm:w-8" />
        </button>

        {/* Modal content */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 pr-8 text-gray-900 dark:text-gray-100">Set Your Kindle Email</h2>

        <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-sm sm:text-base md:text-lg text-gray-700 dark:text-gray-300">
          <p>
            To send books to your Kindle, we need your Kindle email address.
          </p>
          <p className="font-semibold">
            Your Kindle email ends with <span className="text-blue-600 dark:text-blue-400">@kindle.com</span> or{' '}
            <span className="text-blue-600 dark:text-blue-400">@free.kindle.com</span>
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-3 sm:p-4 mt-3 sm:mt-4">
            <p className="font-semibold mb-2 text-sm sm:text-base text-gray-900 dark:text-gray-100">How to find your Kindle email:</p>
            <ol className="list-decimal list-inside space-y-1.5 sm:space-y-2 text-sm sm:text-base text-gray-700 dark:text-gray-300">
              <li>Go to Amazon.com and sign in</li>
              <li>Navigate to "Manage Your Content and Devices"</li>
              <li>Click on the "Preferences" tab</li>
              <li>Scroll to "Personal Document Settings"</li>
              <li>Your Kindle email will be listed there</li>
            </ol>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-200 dark:border-yellow-700 rounded-xl p-3 sm:p-4 mt-3 sm:mt-4">
            <p className="font-semibold mb-2 text-sm sm:text-base text-gray-900 dark:text-gray-100">Important:</p>
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
              You must add Shakeel&apos;s email to
              your approved email list in the same "Personal Document Settings" page.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4 sm:mb-6">
            <label htmlFor="kindle-email" className="block text-base sm:text-lg md:text-xl font-semibold mb-2 sm:mb-3 text-gray-900 dark:text-gray-100">
              Kindle Email Address
            </label>
            <input
              id="kindle-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@kindle.com"
              className="w-full px-4 sm:px-6 py-3 sm:py-4 text-lg sm:text-xl md:text-2xl border-4 border-gray-300 dark:border-gray-600 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              autoFocus
              required
            />
            {error && (
              <p className="mt-2 sm:mt-3 text-red-600 dark:text-red-400 text-base sm:text-lg font-semibold">{error}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg md:text-xl transition-colors shadow-md touch-manipulation"
            >
              Save Email
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 active:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700 dark:active:bg-gray-800 text-gray-800 dark:text-gray-100 px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg md:text-xl transition-colors touch-manipulation"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
