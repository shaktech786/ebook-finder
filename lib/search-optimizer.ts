import { Book } from './types';
import { getFormatPriority } from './search-analyzer';

/**
 * Normalize book titles for better matching
 * Removes common articles, punctuation, and extra whitespace
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '') // Remove leading articles
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Normalize author names for better matching
 */
export function normalizeAuthor(author: string): string {
  return author
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity score between two strings using Levenshtein distance
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance algorithm for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate relevance score for a book based on search query
 */
export function calculateRelevanceScore(book: Book, query: string): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedTitle = book.title.toLowerCase();
  const normalizedAuthor = book.author.toLowerCase();

  let score = 0;

  // Source priority bonus - LibGen is best for popular/modern books
  if (book.source === 'libgen') {
    score += 20; // Prioritize LibGen results
  }

  // Exact title match
  if (normalizedTitle === normalizedQuery) {
    score += 100;
  }
  // Title contains query
  else if (normalizedTitle.includes(normalizedQuery)) {
    score += 50;
  }
  // Fuzzy title match
  else {
    const titleSimilarity = calculateSimilarity(normalizedTitle, normalizedQuery);
    if (titleSimilarity > 0.6) {
      score += titleSimilarity * 30;
    }
  }

  // Author match
  if (normalizedAuthor.includes(normalizedQuery)) {
    score += 30;
  }

  // Format preference bonus
  score += getFormatPriority(book.fileFormat) * 5;

  // Recency bonus (if year available)
  if (book.year) {
    const year = parseInt(book.year);
    if (!isNaN(year) && year > 2000) {
      score += (year - 2000) * 0.1;
    }
  }

  // File size penalty (prefer smaller files, but not too small)
  if (book.fileSizeBytes) {
    const sizeMB = book.fileSizeBytes / (1024 * 1024);
    if (sizeMB > 0.5 && sizeMB < 50) {
      score += 5; // Good size range
    } else if (sizeMB >= 50) {
      score -= (sizeMB - 50) * 0.1; // Penalty for large files
    }
  }

  return score;
}

/**
 * Merge duplicate books, combining metadata from multiple sources
 */
export function deduplicateAndMergeBooks(books: Book[], query: string): Book[] {
  const bookMap = new Map<string, Book>();

  books.forEach((book) => {
    const key = `${normalizeTitle(book.title)}-${normalizeAuthor(book.author)}`;

    const existing = bookMap.get(key);
    if (!existing) {
      bookMap.set(key, book);
    } else {
      // Merge metadata from both sources, preferring more complete data
      const merged: Book = {
        ...existing,
        // Use the deduplication key as unique ID to prevent React key conflicts
        id: `merged-${key.replace(/\s+/g, '-')}`,
        // Prefer longer descriptions
        description: (book.description?.length || 0) > (existing.description?.length || 0)
          ? book.description
          : existing.description,
        // Prefer book with cover image
        coverUrl: book.coverUrl || existing.coverUrl,
        // Prefer book with ISBN
        isbn: book.isbn || existing.isbn,
        // Prefer book with publisher
        publisher: book.publisher || existing.publisher,
        // Prefer book with pages
        pages: book.pages || existing.pages,
        // Keep better format (EPUB > MOBI > PDF)
        ...(getFormatPriority(book.fileFormat) > getFormatPriority(existing.fileFormat)
          ? { fileFormat: book.fileFormat, downloadUrl: book.downloadUrl, fileSize: book.fileSize, fileSizeBytes: book.fileSizeBytes }
          : {}),
      };

      bookMap.set(key, merged);
    }
  });

  // Calculate relevance scores and sort
  const results = Array.from(bookMap.values()).map(book => ({
    book,
    score: calculateRelevanceScore(book, query),
  }));

  // Sort by relevance score (descending)
  results.sort((a, b) => b.score - a.score);

  return results.map(r => r.book);
}

/**
 * Search with timeout to prevent slow sources from blocking
 */
export async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Smart pagination - group results by relevance tiers
 */
export function paginateResults(books: Book[], page: number = 1, pageSize: number = 20): {
  books: Book[];
  totalPages: number;
  currentPage: number;
  total: number;
} {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    books: books.slice(start, end),
    totalPages: Math.ceil(books.length / pageSize),
    currentPage: page,
    total: books.length,
  };
}
