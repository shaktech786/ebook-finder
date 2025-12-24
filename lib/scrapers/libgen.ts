import * as cheerio from 'cheerio';
import axios from 'axios';
import * as https from 'https';
import { Book, SearchQuery } from '../types';
import { getFormatPriority, parseSizeToBytes } from '../search-analyzer';

// Create HTTPS agent that accepts self-signed certificates
// LibGen mirrors use self-signed certs for anti-censorship
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Library Genesis mirrors (updated with working mirrors as of Nov 2025)
// These use self-signed SSL certificates
const LIBGEN_MIRRORS = [
  'https://libgen.li',
  'https://libgen.rs',
  'https://libgen.is',
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
        timeout: 15000,
        httpsAgent, // Accept self-signed certificates
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
 * LibGen uses index.php with simple 'req' parameter
 * Pagination uses 1-based page numbers (page=1 for first page)
 */
function buildSearchUrl(query: SearchQuery, page: number): string {
  // LibGen.li uses index.php with 'req' parameter
  // Page numbering starts at 1, not 0. Omit page parameter for page 1.
  const pageParam = page > 1 ? `&page=${page}` : '';
  return `/index.php?req=${encodeURIComponent(query.value)}${pageParam}`;
}

/**
 * Parses HTML response from Library Genesis
 * Updated for libgen.li HTML structure (Nov 2025)
 */
function parseLibgenResults(html: string, mirror: string): Book[] {
  const $ = cheerio.load(html);
  const books: Book[] = [];

  // LibGen.li uses table#tablelibgen with tbody > tr structure
  $('#tablelibgen tbody tr').each((index, element) => {
    const $row = $(element);
    const cells = $row.find('td');

    // LibGen.li has 9 columns: title, author/series, publisher, year, language, pages, size, format, download
    if (cells.length < 8) return;

    try {
      // Column 0: Title (contains links and text)
      const titleCell = $(cells[0]);
      const title = titleCell.find('a').first().text().trim() || titleCell.text().trim();

      // Column 1: Author/Series
      const author = $(cells[1]).text().trim();

      // Column 2: Publisher
      const publisher = $(cells[2]).text().trim();

      // Column 3: Year (might be empty)
      const year = $(cells[3]).text().trim();

      // Column 4: Language
      const language = $(cells[4]).text().trim();

      // Column 5: Pages
      const pages = $(cells[5]).text().trim();

      // Column 6: File Size (has link like <a href="/file.php?id=100406413">342 kB</a>)
      const fileSizeCell = $(cells[6]);
      const fileSize = fileSizeCell.text().trim();
      const fileIdLink = fileSizeCell.find('a').attr('href');
      const fileIdMatch = fileIdLink?.match(/id=(\d+)/);
      const id = fileIdMatch ? fileIdMatch[1] : `${Date.now()}-${index}`;

      // Column 7: Format
      const fileFormat = $(cells[7]).text().trim().toLowerCase();

      // Column 8: Download links with MD5
      const downloadCell = $(cells[8]);
      const md5Link = downloadCell.find('a').first().attr('href');
      const md5Match = md5Link?.match(/md5=([a-f0-9]+)/i);
      const md5 = md5Match ? md5Match[1].toLowerCase() : '';

      // Generate LibGen page URL for manual download
      // Note: LibGen no longer provides public HTTP direct downloads
      // file.php pages show download options (Tor, Anna's Archive, etc.)
      let downloadUrl = '';
      if (id && id !== 'undefined') {
        // Link to file info page where user can choose download method
        downloadUrl = `${mirror}/file.php?id=${id}`;
      } else if (md5) {
        // Fallback: link to ads.php page
        downloadUrl = `${mirror}/ads.php?md5=${md5}`;
      } else {
        console.warn('No download URL available for:', title);
        return; // Skip books without download URLs
      }

      // Build cover URL using our API that tries multiple sources
      const coverUrl = title && author
        ? `/api/cover?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}${md5 ? `&md5=${md5}` : ''}`
        : undefined;

      const book: Book = {
        id: `libgen-${id}-${md5}`,
        title: title || 'Unknown Title',
        author: author || 'Unknown Author',
        year: year || undefined,
        publisher: publisher || undefined,
        language,
        pages: pages || undefined,
        fileFormat: normalizeFormat(fileFormat),
        fileSize,
        fileSizeBytes: parseSizeToBytes(fileSize),
        coverUrl,
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
 * Gets direct download link for a book from LibGen intermediate page
 * LibGen file.php pages contain links to multiple mirrors
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
      httpsAgent, // Accept self-signed certificates
    });

    const $ = cheerio.load(response.data);

    // For new libgen.li pages, look for mirror links in priority order
    // 1. Anna's Archive - most reliable public mirror
    const annasArchive = $('a[href*="annas-archive.org/md5"]').first().attr('href');
    if (annasArchive) {
      console.log('Found Anna\'s Archive link:', annasArchive);
      return annasArchive;
    }

    // 2. Randombook mirror
    const randombook = $('a[href*="randombook.org/book"]').first().attr('href');
    if (randombook) {
      console.log('Found Randombook link:', randombook);
      return randombook;
    }

    // 3. LibGen ads.php endpoint (relative URL, needs base mirror)
    const adsPhp = $('a[href*="/ads.php?md5="]').first().attr('href');
    if (adsPhp) {
      // Extract mirror base from bookUrl
      const mirrorMatch = bookUrl.match(/(https?:\/\/[^\/]+)/);
      if (mirrorMatch) {
        const fullUrl = `${mirrorMatch[1]}${adsPhp}`;
        console.log('Found ads.php link:', fullUrl);
        return fullUrl;
      }
    }

    // Fallback: try old selectors for compatibility with other LibGen pages
    const selectors = [
      'a[href*="library.lol/main"]',
      'a[href*="cloudflare"]',
      'a[href*="ipfs.io"]',
      'a:contains("GET")',
      'a:contains("Cloudflare")',
      'a[href*="/get.php"]',
    ];

    for (const selector of selectors) {
      const link = $(selector).first().attr('href');
      if (link && link.startsWith('http')) {
        console.log('Found download link via selector:', link);
        return link;
      }
    }

    console.error('No valid download link found in page');
    console.log('Available links:', $('a[href^="http"]').map((_, el) => $(el).attr('href')).get().slice(0, 10));
    throw new Error('No download link found on LibGen page');
  } catch (error) {
    console.error('Failed to get download link:', error);
    throw error;
  }
}
