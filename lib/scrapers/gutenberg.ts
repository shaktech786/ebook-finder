import axios from 'axios';
import * as cheerio from 'cheerio';
import { Book, SearchQuery } from '../types';
import { getFormatPriority } from '../search-analyzer';

const GUTENBERG_SEARCH_URL = 'https://www.gutenberg.org/ebooks/search/';

interface GutenbergSearchParams {
  query: SearchQuery;
  page?: number;
}

/**
 * Searches Project Gutenberg for free ebooks
 */
export async function searchGutenberg({ query, page = 1 }: GutenbergSearchParams): Promise<Book[]> {
  try {
    const searchUrl = buildGutenbergSearchUrl(query, page);

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
    });

    const books = parseGutenbergResults(response.data);

    // Filter and sort books
    return books.sort((a, b) => {
      const formatDiff = getFormatPriority(b.fileFormat) - getFormatPriority(a.fileFormat);
      if (formatDiff !== 0) return formatDiff;
      return (a.fileSizeBytes || 0) - (b.fileSizeBytes || 0);
    });
  } catch (error) {
    console.error('Failed to search Gutenberg:', error);
    throw new Error('Project Gutenberg search failed');
  }
}

/**
 * Builds search URL for Project Gutenberg
 */
function buildGutenbergSearchUrl(query: SearchQuery, page: number): string {
  const params = new URLSearchParams();

  switch (query.type) {
    case 'author':
      params.set('query', query.value);
      params.set('submit_search', 'Go!');
      break;
    case 'title':
      params.set('query', query.value);
      params.set('submit_search', 'Go!');
      break;
    default:
      params.set('query', query.value);
      params.set('submit_search', 'Go!');
  }

  if (page > 1) {
    params.set('start_index', ((page - 1) * 25).toString());
  }

  return `${GUTENBERG_SEARCH_URL}?${params.toString()}`;
}

/**
 * Parses HTML response from Project Gutenberg
 */
function parseGutenbergResults(html: string): Book[] {
  const $ = cheerio.load(html);
  const books: Book[] = [];

  $('.booklink').each((index, element) => {
    try {
      const $bookDiv = $(element);

      // Get book ID from the link
      const bookLink = $bookDiv.find('a.link').first().attr('href') || '';
      const bookIdMatch = bookLink.match(/\/ebooks\/(\d+)/);
      const bookId = bookIdMatch ? bookIdMatch[1] : '';

      if (!bookId) return;

      // Get title
      const title = $bookDiv.find('.title').text().trim();

      // Get author
      const author = $bookDiv.find('.subtitle').text().trim() || 'Unknown Author';

      // Get cover image
      const coverUrl = $bookDiv.find('img.cover-thumb').attr('src');
      const fullCoverUrl = coverUrl ? `https://www.gutenberg.org${coverUrl}` : undefined;

      // Project Gutenberg books are available in multiple formats
      // We'll create entries for EPUB and MOBI
      const formats = [
        { format: 'epub' as const, ext: 'epub', size: '~500 KB' },
        { format: 'mobi' as const, ext: 'kindle.mobi', size: '~800 KB' },
      ];

      formats.forEach(({ format, ext, size }) => {
        const book: Book = {
          id: `gutenberg-${bookId}-${format}`,
          title: title || 'Unknown Title',
          author,
          language: 'English',
          fileFormat: format,
          fileSize: size,
          fileSizeBytes: format === 'epub' ? 500000 : 800000,
          coverUrl: fullCoverUrl,
          downloadUrl: `https://www.gutenberg.org/ebooks/${bookId}.${ext}.noimages`,
          source: 'gutenberg',
          description: 'Public domain ebook from Project Gutenberg',
        };

        books.push(book);
      });
    } catch (error) {
      console.error('Failed to parse Gutenberg book:', error);
    }
  });

  return books;
}

/**
 * Gets direct download URL for a Gutenberg book
 */
export async function getGutenbergDownloadUrl(bookId: string, format: 'epub' | 'mobi'): Promise<string> {
  const ext = format === 'mobi' ? 'kindle.mobi' : 'epub';
  return `https://www.gutenberg.org/ebooks/${bookId}.${ext}.noimages`;
}
