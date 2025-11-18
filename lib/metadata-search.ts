import { Book } from './types';

/**
 * Smart cascading search using book metadata
 * Searches in order of specificity: ISBN → MD5 → Title+Author → Title → Author
 */

export interface MetadataSearchResult {
  query: string;
  queryType: 'isbn' | 'md5' | 'title-author' | 'title' | 'author';
  success: boolean;
  booksFound: number;
}

/**
 * Build cascading search queries from book metadata
 * Returns queries in order of specificity (most specific first)
 */
export function buildMetadataQueries(book: Book): Array<{ query: string; type: string; priority: number }> {
  const queries: Array<{ query: string; type: string; priority: number }> = [];

  // Priority 1: ISBN (most specific - unique identifier)
  if (book.isbn) {
    queries.push({
      query: book.isbn,
      type: 'isbn',
      priority: 1,
    });
  }

  // Priority 2: MD5 hash (LibGen specific - exact file match)
  if (book.md5) {
    queries.push({
      query: book.md5,
      type: 'md5',
      priority: 2,
    });
  }

  // Priority 3: Title + Author (very specific - best for fiction)
  if (book.title && book.author) {
    queries.push({
      query: `${book.title} ${book.author}`,
      type: 'title-author',
      priority: 3,
    });
  }

  // Priority 4: Title only (good for unique titles)
  if (book.title) {
    queries.push({
      query: book.title,
      type: 'title',
      priority: 4,
    });
  }

  // Priority 5: Author (least specific - fallback only)
  if (book.author) {
    queries.push({
      query: book.author,
      type: 'author',
      priority: 5,
    });
  }

  return queries.sort((a, b) => a.priority - b.priority);
}

/**
 * Execute cascading metadata search
 * Tries each query until results are found or all queries exhausted
 */
export async function cascadingMetadataSearch(
  book: Book,
  searchFn: (query: string) => Promise<Book[]>,
  options: {
    minResults?: number;
    timeout?: number;
    preferredSource?: 'libgen' | 'gutenberg' | 'openlibrary';
  } = {}
): Promise<{ books: Book[]; usedQuery: MetadataSearchResult }> {
  const { minResults = 1, preferredSource = 'libgen' } = options;
  const queries = buildMetadataQueries(book);

  console.log(`[Metadata Search] Starting cascading search for: ${book.title}`);
  console.log(`[Metadata Search] Available queries:`, queries.map(q => `${q.type}: "${q.query}"`));

  for (const { query, type, priority } of queries) {
    try {
      console.log(`[Metadata Search] Trying ${type} search: "${query}"`);
      const results = await searchFn(query);

      // Filter by preferred source if specified
      const filteredResults = preferredSource
        ? results.filter(b => b.source === preferredSource).concat(
            results.filter(b => b.source !== preferredSource)
          )
        : results;

      if (filteredResults.length >= minResults) {
        console.log(`[Metadata Search] ✓ Success with ${type}: found ${filteredResults.length} results`);
        return {
          books: filteredResults,
          usedQuery: {
            query,
            queryType: type as any,
            success: true,
            booksFound: filteredResults.length,
          },
        };
      }

      console.log(`[Metadata Search] ✗ ${type} search found ${filteredResults.length} results (need ${minResults}), trying next...`);
    } catch (error) {
      console.error(`[Metadata Search] Error with ${type} search:`, error);
      // Continue to next query on error
    }
  }

  // No results found with any query
  console.log(`[Metadata Search] ✗ All queries exhausted, no results found`);
  return {
    books: [],
    usedQuery: {
      query: book.title,
      queryType: 'title',
      success: false,
      booksFound: 0,
    },
  };
}

/**
 * Find best download URL for a book using metadata search
 * Returns the best matching book with download URL, or original if no better match found
 */
export async function findBestDownloadUrl(
  book: Book,
  searchFn: (query: string) => Promise<Book[]>
): Promise<Book> {
  const { books, usedQuery } = await cascadingMetadataSearch(book, searchFn, {
    minResults: 1,
    preferredSource: 'libgen',
  });

  if (books.length > 0) {
    console.log(`[Metadata Search] Found better match using ${usedQuery.queryType}:`, books[0].title);

    // Return the best match (first result after ranking)
    // Prefer same format as original if available
    const sameFormatBook = books.find(b => b.fileFormat === book.fileFormat);
    return sameFormatBook || books[0];
  }

  console.log(`[Metadata Search] No better match found, using original download URL`);
  return book;
}
