'use client';

import { useState } from 'react';
import { Book } from '@/lib/types';
import { PaperAirplaneIcon, CheckCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';

interface BookCardProps {
  book: Book;
  kindleEmail: string | null;
  onSetKindleEmail: () => void;
}

export default function BookCard({ book, kindleEmail, onSetKindleEmail }: BookCardProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleSendToKindle = async () => {
    if (!kindleEmail) {
      onSetKindleEmail();
      return;
    }

    setSending(true);
    setError(null);

    try {
      // Step 1: Find best download URL using metadata search
      console.log('[Send to Kindle] Starting metadata search for:', book.title);
      let downloadUrl = book.downloadUrl;
      let bookTitle = book.title;
      let fileFormat = book.fileFormat;
      let source = book.source;

      try {
        const metadataResponse = await fetch('/api/find-best-download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(book),
        });

        if (metadataResponse.ok) {
          const metadataData = await metadataResponse.json();
          if (metadataData.success && metadataData.book) {
            console.log('[Send to Kindle] Found better match using metadata search:', metadataData.metadata);
            downloadUrl = metadataData.book.downloadUrl;
            bookTitle = metadataData.book.title;
            fileFormat = metadataData.book.fileFormat;
            source = metadataData.book.source; // Use source from metadata search for correct automation
          }
        }
      } catch (metadataError) {
        console.warn('[Send to Kindle] Metadata search failed, using original URL:', metadataError);
        // Continue with original download URL
      }

      // Step 2: Send using the best URL found
      const response = await fetch('/api/send-to-kindle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookTitle,
          downloadUrl,
          kindleEmail,
          fileFormat,
          source, // Use correct source to trigger LibGen automation
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send to Kindle');
      }

      setSent(true);
      setTimeout(() => setSent(false), 5000); // Reset after 5 seconds
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send to Kindle');
    } finally {
      setSending(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);

    try {
      // Step 1: Find best download URL using metadata search
      console.log('[Download] Starting metadata search for:', book.title);
      let downloadUrl = book.downloadUrl;
      let fileName = `${book.title.replace(/[^a-z0-9]/gi, '_')}.${book.fileFormat}`;
      let fileFormat = book.fileFormat;
      let source = book.source;

      try {
        const metadataResponse = await fetch('/api/find-best-download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(book),
        });

        if (metadataResponse.ok) {
          const metadataData = await metadataResponse.json();
          if (metadataData.success && metadataData.book) {
            console.log('[Download] Found better match using metadata search:', metadataData.metadata);
            downloadUrl = metadataData.book.downloadUrl;
            fileName = `${metadataData.book.title.replace(/[^a-z0-9]/gi, '_')}.${metadataData.book.fileFormat}`;
            fileFormat = metadataData.book.fileFormat;
            source = metadataData.book.source; // Use source from metadata search for correct automation
          }
        }
      } catch (metadataError) {
        console.warn('[Download] Metadata search failed, using original URL:', metadataError);
        // Continue with original download URL
      }

      // Step 2: Download using the best URL found
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          downloadUrl,
          fileName,
          fileFormat,
          source, // Use correct source to trigger LibGen automation
        }),
      });

      // Check if API returned a redirect response (for trusted sources)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();

        // Handle redirect to trusted source (Archive.org, etc.)
        if (data.redirect && data.downloadUrl) {
          console.log('[Download] Redirecting to trusted source:', data.downloadUrl);
          const downloadLink = document.createElement('a');
          downloadLink.href = data.downloadUrl;
          downloadLink.download = data.fileName || fileName;
          downloadLink.target = '_blank'; // Open in new tab to avoid navigation
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          setDownloading(false);
          return;
        }

        // Handle error with downloadUrl fallback
        if (data.downloadUrl) {
          console.log('Opening download link in new tab:', data.downloadUrl);
          window.open(data.downloadUrl, '_blank');
          setError('Auto-download failed. Opening download link in new tab...');
          setTimeout(() => setError(null), 3000);
          setDownloading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || 'Failed to download');
        }
      }

      // Get the file blob (for proxied downloads)
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${book.title.replace(/[^a-z0-9]/gi, '_')}.${book.fileFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download');
    } finally {
      setDownloading(false);
    }
  };

  // Format badge color based on file format
  const getFormatBadgeColor = () => {
    switch (book.fileFormat) {
      case 'epub':
        return 'bg-green-500 text-white';
      case 'mobi':
        return 'bg-yellow-500 text-black';
      case 'pdf':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow border-2 border-gray-200 dark:border-gray-700">
      {/* Book Cover */}
      <div className="relative w-full aspect-[2/3] mb-3 sm:mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
        {book.coverUrl ? (
          <Image
            src={book.coverUrl}
            alt={book.title}
            fill
            className="object-cover"
            unoptimized
            onError={(e) => {
              // Fallback to placeholder if cover fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
          </div>
        )}
      </div>

      {/* Book Details */}
      <div className="space-y-2 sm:space-y-3">
        <h3 className="font-bold text-lg sm:text-xl md:text-2xl leading-tight line-clamp-2 text-gray-900 dark:text-gray-100" title={book.title}>
          {book.title}
        </h3>

        <p className="text-base sm:text-lg md:text-xl text-gray-700 dark:text-gray-300">{book.author}</p>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {book.year && (
            <span className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400">{book.year}</span>
          )}

          <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-sm sm:text-base md:text-lg uppercase ${getFormatBadgeColor()}`}>
            {book.fileFormat}
          </span>

          <span className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400">{book.fileSize}</span>
        </div>

        {book.pages && (
          <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400">{book.pages} pages</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 sm:mt-6 space-y-3">
        {/* Send to Kindle Button */}
        {sent ? (
          <button
            disabled
            className="w-full bg-green-500 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg md:text-xl flex items-center justify-center gap-2"
          >
            <CheckCircleIcon className="h-6 sm:h-7 w-6 sm:w-7" />
            Sent to Kindle!
          </button>
        ) : (
          <button
            onClick={handleSendToKindle}
            disabled={sending || downloading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg md:text-xl transition-colors flex items-center justify-center gap-2 shadow-md touch-manipulation"
          >
            {sending ? (
              <>
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
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
                Sending...
              </>
            ) : (
              <>
                <PaperAirplaneIcon className="h-6 w-6" />
                Send to Kindle
              </>
            )}
          </button>
        )}

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={downloading || sending}
          className="w-full bg-gray-600 hover:bg-gray-700 active:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:active:bg-gray-500 disabled:bg-gray-400 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg md:text-xl transition-colors flex items-center justify-center gap-2 shadow-md touch-manipulation"
        >
          {downloading ? (
            <>
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
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
              Downloading...
            </>
          ) : (
            <>
              <ArrowDownTrayIcon className="h-6 w-6" />
              Download
            </>
          )}
        </button>

        {error && (
          <p className="mt-3 text-red-600 dark:text-red-400 text-lg font-semibold text-center">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
