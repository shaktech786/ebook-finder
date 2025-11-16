import axios from 'axios';
import { Book, SearchQuery } from '../types';
import { getFormatPriority } from '../search-analyzer';

const OPENLIBRARY_SEARCH_API = 'https://openlibrary.org/search.json';

interface OpenLibrarySearchParams {
  query: SearchQuery;
  page?: number;
}

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  publisher?: string[];
  language?: string[];
  cover_i?: number;
  ebook_access?: string;
  ebook_count_i?: number;
  edition_count?: number;
}

/**
 * Searches Open Library for ebooks (Internet Archive)
 */
export async function searchOpenLibrary({ query, page = 1 }: OpenLibrarySearchParams): Promise<Book[]> {
  try {
    const params = new URLSearchParams();

    // Build query based on type
    switch (query.type) {
      case 'isbn':
        params.set('isbn', query.value);
        break;
      case 'author':
        params.set('author', query.value);
        break;
      case 'title':
        params.set('title', query.value);
        break;
      default:
        params.set('q', query.value);
    }

    params.set('page', page.toString());
    params.set('limit', '50'); // Get more results
    params.set('fields', 'key,title,author_name,first_publish_year,isbn,publisher,language,cover_i,ebook_access,ebook_count_i');

    const response = await axios.get(`${OPENLIBRARY_SEARCH_API}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
    });

    const docs: OpenLibraryDoc[] = response.data.docs || [];

    // Filter for books with ebook access and create book entries
    const books: Book[] = [];

    for (const doc of docs) {
      // Only include books that have ebook access or are borrowable
      if (!doc.ebook_access || doc.ebook_access === 'no_ebook') continue;

      // Check if language is English
      const languages = doc.language || [];
      const isEnglish = languages.length === 0 || languages.some(lang =>
        lang.toLowerCase().includes('eng') || lang.toLowerCase() === 'en'
      );

      if (!isEnglish) continue;

      const workId = doc.key.replace('/works/', '');
      const author = doc.author_name?.[0] || 'Unknown Author';
      const year = doc.first_publish_year?.toString() || '';

      // Create entries for different formats
      const formats: Array<{ format: 'epub' | 'pdf' | 'mobi', size: string }> = [
        { format: 'pdf', size: '~3 MB' },
        { format: 'epub', size: '~1 MB' },
      ];

      formats.forEach(({ format, size }) => {
        const book: Book = {
          id: `openlibrary-${workId}-${format}`,
          title: doc.title,
          author,
          year,
          publisher: doc.publisher?.[0],
          language: 'English',
          isbn: doc.isbn?.[0],
          fileFormat: format,
          fileSize: size,
          fileSizeBytes: format === 'epub' ? 1000000 : 3000000,
          coverUrl: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
            : undefined,
          downloadUrl: `https://archive.org/download/${workId}/${workId}.${format}`,
          source: 'openlibrary',
          description: `Available on Internet Archive (${doc.ebook_access})`,
        };

        books.push(book);
      });
    }

    // Sort by format priority
    return books.sort((a, b) => {
      const formatDiff = getFormatPriority(b.fileFormat) - getFormatPriority(a.fileFormat);
      if (formatDiff !== 0) return formatDiff;
      return (a.fileSizeBytes || 0) - (b.fileSizeBytes || 0);
    });
  } catch (error) {
    console.error('Failed to search Open Library:', error);
    throw new Error('Open Library search failed');
  }
}

/**
 * Gets download URL for Open Library book
 */
export function getOpenLibraryDownloadUrl(workId: string, format: 'epub' | 'pdf' | 'mobi'): string {
  return `https://archive.org/download/${workId}/${workId}.${format}`;
}
