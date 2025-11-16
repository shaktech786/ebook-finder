import { SearchQuery } from './types';

/**
 * Analyzes search queries to determine the best search strategy
 */
export function analyzeSearchQuery(query: string): SearchQuery {
  const trimmed = query.trim();

  // Check for ISBN (10 or 13 digits, with or without hyphens)
  const isbnPattern = /^(?:\d{9}[\dX]|\d{13})$|^(?:\d{1,5}-\d{1,7}-\d{1,7}-[\dX]|\d{3}-\d{1,5}-\d{1,7}-\d{1,7}-\d)$/;
  const cleanedForIsbn = trimmed.replace(/-/g, '');
  if (isbnPattern.test(cleanedForIsbn)) {
    return {
      raw: trimmed,
      type: 'isbn',
      value: cleanedForIsbn,
    };
  }

  // Check for "books about [topic]" pattern
  const topicPattern = /^books?\s+about\s+(.+)$/i;
  const topicMatch = trimmed.match(topicPattern);
  if (topicMatch) {
    return {
      raw: trimmed,
      type: 'topic',
      value: topicMatch[1].trim(),
    };
  }

  // Check for "books like [title]" or "similar to [title]" pattern
  const similarPattern = /^(?:books?\s+(?:like|similar\s+to)|similar\s+to)\s+(.+)$/i;
  const similarMatch = trimmed.match(similarPattern);
  if (similarMatch) {
    return {
      raw: trimmed,
      type: 'similar',
      value: similarMatch[1].trim(),
      originalBook: similarMatch[1].trim(),
    };
  }

  // Check for "by [author]" pattern
  const authorPattern = /^(?:by\s+|author:\s*)(.+)$/i;
  const authorMatch = trimmed.match(authorPattern);
  if (authorMatch) {
    return {
      raw: trimmed,
      type: 'author',
      value: authorMatch[1].trim(),
    };
  }

  // Check if it looks like an author name (2-4 words, capitalized)
  const namePattern = /^[A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+){1,2}$/;
  if (namePattern.test(trimmed)) {
    return {
      raw: trimmed,
      type: 'author',
      value: trimmed,
    };
  }

  // Check if it looks like a book title (contains common title words or is quoted)
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return {
      raw: trimmed,
      type: 'title',
      value: trimmed.slice(1, -1),
    };
  }

  // Default to keyword search
  return {
    raw: trimmed,
    type: 'keyword',
    value: trimmed,
  };
}

/**
 * Prioritizes file formats: EPUB > MOBI > PDF > Others
 */
export function getFormatPriority(format: string): number {
  const normalized = format.toLowerCase();
  if (normalized === 'epub') return 3;
  if (normalized === 'mobi' || normalized === 'azw3') return 2;
  if (normalized === 'pdf') return 1;
  return 0;
}

/**
 * Converts file size string to bytes for sorting
 */
export function parseSizeToBytes(size: string): number {
  const match = size.match(/^([\d.]+)\s*(B|KB|MB|GB)?$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'KB').toUpperCase();

  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}
