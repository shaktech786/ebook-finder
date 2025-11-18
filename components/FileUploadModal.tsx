'use client';

import { useState, useRef } from 'react';
import { ArrowUpTrayIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  kindleEmail: string | null;
  onSetKindleEmail: () => void;
}

export default function FileUploadModal({
  isOpen,
  onClose,
  kindleEmail,
  onSetKindleEmail,
}: FileUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['application/epub+zip', 'application/x-mobipocket-ebook', 'application/pdf'];
    const validExtensions = ['.epub', '.mobi', '.pdf', '.azw3'];
    const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension)) {
      setError('Invalid file type. Please select an EPUB, MOBI, AZW3, or PDF file.');
      return;
    }

    // Validate file size (Kindle limit is 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > maxSize) {
      setError('File too large. Maximum size is 50MB for Kindle delivery.');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleSend = async () => {
    if (!kindleEmail) {
      onSetKindleEmail();
      return;
    }

    if (!file) {
      setError('Please select a file to send');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kindleEmail', kindleEmail);

      const response = await fetch('/api/upload-to-kindle', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send file to Kindle');
      }

      setSent(true);
      setTimeout(() => {
        setSent(false);
        setFile(null);
        onClose();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send file to Kindle');
    } finally {
      setSending(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Upload to Kindle
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Success State */}
        {sent ? (
          <div className="text-center py-8">
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Sent to Kindle!
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Check your Kindle in a few minutes
            </p>
          </div>
        ) : (
          <>
            {/* File Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".epub,.mobi,.pdf,.azw3"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file ? (
                <div className="space-y-2">
                  <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto" />
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ArrowUpTrayIcon className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="text-gray-700 dark:text-gray-300 font-semibold">
                    Click to upload file
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    EPUB, MOBI, AZW3, or PDF (max 50MB)
                  </p>
                </div>
              )}
            </div>

            {/* Kindle Email Display */}
            {kindleEmail && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sending to: <span className="font-semibold text-gray-900 dark:text-gray-100">{kindleEmail}</span>
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/30 border-2 border-red-200 dark:border-red-700 rounded-xl p-4">
                <p className="text-red-700 dark:text-red-400 text-center font-semibold">
                  {error}
                </p>
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!file || sending}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 text-white px-6 py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 shadow-md"
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
                  <ArrowUpTrayIcon className="h-6 w-6" />
                  Send to Kindle
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
