import * as cheerio from 'cheerio';
import axios from 'axios';
import { Book, SearchQuery } from '../types';
import { getFormatPriority, parseSizeToBytes } from '../search-analyzer';

// Library Genesis mirrors (fallback if one fails)
const LIBGEN_MIRRORS = [
  'https://libgen.ac',
  'https://libgen.li',
  'https://libgen.gs',
  'https://libgen.is',
  'https://libgen.rs',
  'https://libgen.st',
];

interface LibgenSearchParams {
  query: SearchQuery;
  page?: number;
}

/**
 * Scrapes Library Genesis for ebooks
 */
export async function searchLibgen({ query, page = 1 }: LibgenSearchParams): Promise<Book[]> {
  const searchUrl = buildSearchUrl(query, page);

  // Try each mirror until one works
  for (const mirror of LIBGEN_MIRRORS) {
    try {
      const fullUrl = `${mirror}${searchUrl}`;
      const response = await axios.get(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const books = parseLibgenResults(response.data, mirror);

      // Filter for English books and preferred formats
      const filtered = books
        .filter(book => book.language.toLowerCase() === 'english')
        .sort((a, b) => {
          // Sort by format priority first
          const formatDiff = getFormatPriority(b.fileFormat) - getFormatPriority(a.fileFormat);
          if (formatDiff !== 0) return formatDiff;

          // Then by file size (smaller is better for Kindle)
          return (a.fileSizeBytes || 0) - (b.fileSizeBytes || 0);
        });

      return filtered;
    } catch (error) {
      console.error(`Failed to fetch from ${mirror}:`, error);
      continue;
    }
  }

  throw new Error('All Library Genesis mirrors failed');
}

/**
 * Builds search URL based on query type
 */
function buildSearchUrl(query: SearchQuery, page: number): string {
  const offset = (page - 1) * 25;

  switch (query.type) {
    case 'isbn':
      return `/search.php?req=${encodeURIComponent(query.value)}&column=identifier&res=25&page=${offset}`;

    case 'author':
      return `/search.php?req=${encodeURIComponent(query.value)}&column=author&res=25&page=${offset}`;

    case 'title':
      return `/search.php?req=${encodeURIComponent(query.value)}&column=title&res=25&page=${offset}`;

    case 'topic':
    case 'similar':
    case 'keyword':
    default:
      return `/search.php?req=${encodeURIComponent(query.value)}&res=25&page=${offset}`;
  }
}

/**
 * Parses HTML response from Library Genesis
 */
function parseLibgenResults(html: string, mirror: string): Book[] {
  const $ = cheerio.load(html);
  const books: Book[] = [];

  // Libgen uses a table structure for results
  $('table.c tr').each((index, element) => {
    // Skip header row
    if (index === 0) return;

    const $row = $(element);
    const cells = $row.find('td');

    if (cells.length < 10) return;

    try {
      const id = $(cells[0]).text().trim();
      const author = $(cells[1]).text().trim();
      const titleCell = $(cells[2]);
      const title = titleCell.find('a').first().text().trim() || titleCell.text().trim();
      const publisher = $(cells[3]).text().trim();
      const year = $(cells[4]).text().trim();
      const pages = $(cells[5]).text().trim();
      const language = $(cells[6]).text().trim();
      const fileSize = $(cells[7]).text().trim();
      const fileFormat = $(cells[8]).text().trim().toLowerCase();

      // Get MD5 for download and cover
      const md5Link = $(cells[9]).find('a').attr('href');
      const md5Match = md5Link?.match(/md5=([a-f0-9]+)/i);
      const md5 = md5Match ? md5Match[1].toLowerCase() : '';

      // Construct reliable download URL using MD5
      // Priority: library.lol (most reliable) > cloudflare > original link
      let downloadUrl = '';
      if (md5) {
        // Use library.lol with MD5 - most reliable direct download
        downloadUrl = `https://library.lol/main/${md5}`;
      } else {
        // Fallback: try to extract link from page
        const downloadLinks = titleCell.find('a[href*="library.lol"], a[href*="libgen"], a[href*="download"]');
        const link = downloadLinks.first().attr('href') || '';
        downloadUrl = link.startsWith('http') ? link : `${mirror}${link}`;
      }

      const book: Book = {
        id: `libgen-${id}-${md5}`,
        title: title || 'Unknown Title',
        author: author || 'Unknown Author',
        year,
        publisher,
        language,
        pages,
        fileFormat: normalizeFormat(fileFormat),
        fileSize,
        fileSizeBytes: parseSizeToBytes(fileSize),
        coverUrl: md5 ? `https://libgen.is/covers/${md5.substring(0, 3)}/${md5}${fileFormat ? '.' + fileFormat : '.jpg'}` : undefined,
        downloadUrl,
        source: 'libgen',
        md5, // Store MD5 for later use
      };

      books.push(book);
    } catch (error) {
      console.error('Failed to parse book row:', error);
    }
  });

  return books;
}

/**
 * Normalizes file format strings
 */
function normalizeFormat(format: string): 'epub' | 'mobi' | 'pdf' | 'other' {
  const normalized = format.toLowerCase().trim();

  if (normalized === 'epub') return 'epub';
  if (normalized === 'mobi' || normalized === 'azw3' || normalized === 'azw') return 'mobi';
  if (normalized === 'pdf') return 'pdf';

  return 'other';
}

/**
 * Gets direct download link for a book
 */
export async function getLibgenDownloadLink(bookUrl: string): Promise<string> {
  try {
    console.log('Fetching LibGen page:', bookUrl);
    const response = await axios.get(bookUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Try multiple selectors in order of preference
    const selectors = [
      'a[href*="library.lol/main"]',
      'a[href*="cloudflare"]',
      'a[href*="ipfs.io"]',
      'a:contains("GET")',
      'a:contains("Cloudflare")',
      'a[href*="/get.php"]',
      'a[href*="/download"]',
      'a[title*="download"]',
      '#download a',
      'table a[href^="http"]',
    ];

    for (const selector of selectors) {
      const link = $(selector).first().attr('href');
      if (link && link.startsWith('http')) {
        console.log('Found download link:', link);
        return link;
      }
    }

    // Last resort: look for any external http link
    const allLinks = $('a[href^="http"]').toArray();
    for (const link of allLinks) {
      const href = $(link).attr('href');
      if (href && !href.includes('libgen.') && !href.includes('doi.org')) {
        console.log('Found fallback link:', href);
        return href;
      }
    }

    console.error('No download link found in page');
    throw new Error('Download link not found on LibGen page');
  } catch (error) {
    console.error('Failed to get download link:', error);
    throw error;
  }
}
