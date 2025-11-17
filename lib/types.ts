export interface Book {
  id: string;
  title: string;
  author: string;
  year?: string;
  publisher?: string;
  language: string;
  pages?: string;
  isbn?: string;
  fileFormat: 'epub' | 'mobi' | 'pdf' | 'other';
  fileSize: string;
  fileSizeBytes?: number;
  coverUrl?: string;
  downloadUrl: string;
  source: 'libgen' | 'gutenberg' | 'openlibrary' | 'archive' | 'standardebooks';
  description?: string;
  md5?: string; // LibGen MD5 hash for direct downloads
}

export interface SearchQuery {
  raw: string;
  type: 'isbn' | 'author' | 'title' | 'topic' | 'similar' | 'keyword';
  value: string;
  originalBook?: string; // For "books like X" queries
}

export interface SearchResult {
  books: Book[];
  total: number;
  page: number;
  query: SearchQuery;
  source: string;
  error?: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}
