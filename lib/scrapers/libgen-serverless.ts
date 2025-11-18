/**
 * Serverless-friendly LibGen scraper that works on Vercel
 * Uses only HTTP fetching (no Playwright browser) for compatibility with serverless environments
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Get LibGen download link using pure HTTP (no browser automation)
 * Perfect for serverless environments like Vercel
 */
export async function getLibgenDownloadServerless(filePhpUrl: string): Promise<string> {
  try {
    console.log('[LibGen Serverless] Starting HTTP-only download flow for:', filePhpUrl);

    // Step 1: Fetch file.php page to get ads.php link
    const filePhpResponse = await axios.get(filePhpUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
      },
      timeout: 15000,
    });

    console.log('[LibGen Serverless] Fetched file.php, parsing for ads.php link...');

    const $filePage = cheerio.load(filePhpResponse.data);
    const adsLinks: string[] = [];

    $filePage('a').each((_, el) => {
      const href = $filePage(el).attr('href');
      const text = $filePage(el).text().trim();

      if (href && href.includes('/ads.php')) {
        console.log(`[LibGen Serverless] Found ads.php link: ${text} → ${href}`);
        adsLinks.push(href);
      }
    });

    if (adsLinks.length === 0) {
      throw new Error('No ads.php link found on file.php page');
    }

    // Step 2: Fetch ads.php page to get get.php link
    const adsPhpUrl = adsLinks[0].startsWith('http')
      ? adsLinks[0]
      : `https://libgen.li${adsLinks[0].startsWith('/') ? '' : '/'}${adsLinks[0]}`;

    console.log('[LibGen Serverless] Fetching ads.php:', adsPhpUrl);

    const adsPhpResponse = await axios.get(adsPhpUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': filePhpUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml',
      },
      timeout: 15000,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    console.log('[LibGen Serverless] Fetched ads.php, parsing for GET link...');

    const $adsPage = cheerio.load(adsPhpResponse.data);
    const getLinks: string[] = [];

    $adsPage('a').each((_, el) => {
      const href = $adsPage(el).attr('href');
      const text = $adsPage(el).text().trim().toUpperCase();

      // Look for GET link or get.php in href
      if ((text.includes('GET') || (href && href.includes('/get.php'))) && href) {
        let absoluteUrl: string;

        if (href.startsWith('http')) {
          absoluteUrl = href;
        } else if (href.startsWith('/')) {
          absoluteUrl = `https://libgen.li${href}`;
        } else {
          absoluteUrl = `https://libgen.li/${href}`;
        }

        console.log(`[LibGen Serverless] Found GET link: ${text} → ${absoluteUrl}`);
        getLinks.push(absoluteUrl);
      }
    });

    if (getLinks.length === 0) {
      throw new Error('No GET download link found on ads.php page');
    }

    console.log('[LibGen Serverless] ✓ Success! Download link:', getLinks[0]);
    return getLinks[0];

  } catch (error) {
    console.error('[LibGen Serverless] Error:', error);
    throw new Error(`LibGen serverless scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
