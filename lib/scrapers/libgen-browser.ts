import * as cheerio from 'cheerio';
import axios from 'axios';
import * as https from 'https';

// HTTPS agent for self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Smart LibGen download link resolver
 * Navigates through intermediate pages to get actual download links
 */
export async function smartGetLibgenDownload(filePageUrl: string): Promise<string> {
  try {
    console.log('[LibGen Smart] Fetching file page:', filePageUrl);

    // Step 1: Get the file.php page which has mirror options
    const pageResponse = await axios.get(filePageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
      httpsAgent,
    });

    const $ = cheerio.load(pageResponse.data);

    // Step 2: Try Anna's Archive first (most reliable)
    const annasLink = $('a[href*="annas-archive.org/md5"]').first().attr('href');
    if (annasLink) {
      console.log('[LibGen Smart] Found Anna\'s Archive link:', annasLink);
      const downloadLink = await resolveAnnasArchive(annasLink);
      if (downloadLink) return downloadLink;
    }

    // Step 3: Try randombook.org
    const randombookLink = $('a[href*="randombook.org/book"]').first().attr('href');
    if (randombookLink) {
      console.log('[LibGen Smart] Found Randombook link:', randombookLink);
      const downloadLink = await resolveRandombook(randombookLink);
      if (downloadLink) return downloadLink;
    }

    // Step 4: Try ads.php (LibGen's own mirror)
    const adsPhpLink = $('a[href*="/ads.php?md5="]').first().attr('href');
    if (adsPhpLink) {
      const mirrorMatch = filePageUrl.match(/(https?:\/\/[^\/]+)/);
      if (mirrorMatch) {
        const fullUrl = `${mirrorMatch[1]}${adsPhpLink}`;
        console.log('[LibGen Smart] Found ads.php link:', fullUrl);
        const downloadLink = await resolveAdsPhp(fullUrl);
        if (downloadLink) return downloadLink;
      }
    }

    throw new Error('No resolvable download mirrors found');
  } catch (error) {
    console.error('[LibGen Smart] Error:', error);
    throw error;
  }
}

/**
 * Resolve Anna's Archive download link
 * Anna's Archive has multiple download options - use Playwright to navigate through them
 */
async function resolveAnnasArchive(annasUrl: string): Promise<string | null> {
  try {
    console.log('[Anna\'s Archive] Fetching:', annasUrl);

    // Try simple HTTP first
    const response = await axios.get(annasUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Look for direct download links
    const downloadSelectors = [
      'a[href*="/slow_download/"]',
      'a[href*="/fast_download/"]',
      'a[href*="cloudflare"]',
      'a[href*="ipfs.io"]',
      'a[href*=".epub"]',
      'a[href*=".mobi"]',
      'a[href*=".pdf"]',
    ];

    for (const selector of downloadSelectors) {
      const link = $(selector).first().attr('href');
      if (link && link.startsWith('http')) {
        console.log('[Anna\'s Archive] Found direct download link:', link);
        return link;
      }
    }

    // If no direct link, use Playwright to navigate through the download flow
    console.log('[Anna\'s Archive] No direct link found, using Playwright...');
    return await navigateAnnasArchiveWithPlaywright(annasUrl);
  } catch (error) {
    console.error('[Anna\'s Archive] HTTP method failed:', error);

    // Fallback to Playwright
    try {
      console.log('[Anna\'s Archive] Trying Playwright fallback...');
      const result = await navigateAnnasArchiveWithPlaywright(annasUrl);
      console.log('[Anna\'s Archive] Playwright result:', result);
      return result;
    } catch (playwrightError) {
      console.error('[Anna\'s Archive] Playwright also failed:', playwrightError);
      return null;
    }
  }
}

/**
 * Navigate Anna's Archive using Playwright and download file directly
 * Returns base64-encoded file data or null
 */
async function navigateAnnasArchiveWithPlaywright(annasUrl: string): Promise<string | null> {
  const playwright = await import('playwright');

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    acceptDownloads: true, // Enable downloads
  });
  const page = await context.newPage();

  try {
    console.log('[Anna\'s Archive] Playwright navigating to:', annasUrl);
    await page.goto(annasUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Anna's Archive typically has download buttons
    // Click the first available download option
    const downloadButtonSelectors = [
      'button:has-text("Slow Download")',
      'button:has-text("Fast Download")',
      'a:has-text("Download")',
      'button:has-text("Download")',
      '.download-button',
      '[data-action="download"]',
    ];

    for (const selector of downloadButtonSelectors) {
      const button = await page.$(selector).catch(() => null);
      if (button) {
        console.log('[Anna\'s Archive] Found download button:', selector);

        // Scroll button into view and wait for it to be visible
        try {
          await button.scrollIntoViewIfNeeded();
          await button.waitForElementState('visible', { timeout: 5000 });
        } catch (scrollError) {
          console.log('[Anna\'s Archive] Button not visible, skipping:', selector);
          continue;
        }

        // Set up download event listener BEFORE clicking
        const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);

        // Click the button
        await button.click();
        console.log('[Anna\'s Archive] Clicked download button, waiting for download...');

        // Wait for download to start
        const download = await downloadPromise;

        if (download) {
          console.log('[Anna\'s Archive] Download started:', download.suggestedFilename());

          try {
            // Get the download as a readable stream
            const stream = await download.createReadStream();
            const chunks: Buffer[] = [];

            // Read all chunks
            for await (const chunk of stream) {
              chunks.push(chunk);
            }

            const fileBuffer = Buffer.concat(chunks);
            console.log('[Anna\'s Archive] Downloaded file:', fileBuffer.length, 'bytes');

            await browser.close();

            // Return base64-encoded data with special prefix
            return `data:application/octet-stream;base64,${fileBuffer.toString('base64')}`;
          } catch (error) {
            console.error('[Anna\'s Archive] Error reading download:', error);
            // Continue to fallback methods
          }
        }

        // Fallback: Try to extract download URL
        await page.waitForTimeout(2000);

        // Look for actual download links
        const allLinks = await page.$$eval(
          'a[href*="cloudflare"], a[href*="ipfs"], a[href*="download"], a[href*=".epub"], a[href*=".mobi"], a[href*=".pdf"]',
          (els: HTMLAnchorElement[]) => els.map(el => el.href)
        ).catch(() => []);

        console.log('[Anna\'s Archive] Found', allLinks.length, 'potential links');

        // Filter for actual download URLs
        const downloadLink = allLinks.find(link =>
          !link.includes('/search?') &&
          !link.includes('/member_codes?') &&
          !link.includes('annas-archive.org/md5/') &&
          !link.includes('filepath:') &&
          (link.match(/\.(epub|mobi|pdf|azw3)$/i) || link.includes('cloudflare') || link.includes('ipfs'))
        );

        if (downloadLink) {
          console.log('[Anna\'s Archive] Found download link after filtering:', downloadLink);
          await browser.close();

          // Convert IPFS protocol to HTTP gateway
          if (downloadLink.startsWith('ipfs://')) {
            const ipfsHash = downloadLink.replace('ipfs://', '');
            const httpUrl = `https://dweb.link/ipfs/${ipfsHash}`;
            console.log('[Anna\'s Archive] Converted IPFS to HTTP gateway:', httpUrl);
            return httpUrl;
          }

          return downloadLink;
        }
      }
    }

    await browser.close();
    return null;
  } catch (error) {
    console.error('[Anna\'s Archive] Playwright navigation error:', error);
    await browser.close();
    return null;
  }
}

/**
 * Resolve Randombook download link - use Playwright to navigate through download flow
 */
async function resolveRandombook(randombookUrl: string): Promise<string | null> {
  try {
    console.log('[Randombook] Fetching:', randombookUrl);

    // Try HTTP first
    const response = await axios.get(randombookUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Look for direct download links
    const downloadSelectors = [
      'a[href*="/dl/"]',
      'a[href*="/download/"]',
      'a[href*=".epub"]',
      'a[href*=".mobi"]',
      'a[href*=".pdf"]',
      'a[href*="cloudflare"]',
    ];

    for (const selector of downloadSelectors) {
      const link = $(selector).first().attr('href');
      if (link && link.startsWith('http')) {
        console.log('[Randombook] Found direct download link:', link);
        return link;
      }
    }

    // If no direct link, use Playwright
    console.log('[Randombook] No direct link, using Playwright...');
    return await navigateRandombookWithPlaywright(randombookUrl);
  } catch (error) {
    console.error('[Randombook] HTTP failed:', error);

    try {
      console.log('[Randombook] Trying Playwright fallback...');
      const result = await navigateRandombookWithPlaywright(randombookUrl);
      console.log('[Randombook] Playwright result:', result);
      return result;
    } catch (playwrightError) {
      console.error('[Randombook] Playwright also failed:', playwrightError);
      return null;
    }
  }
}

/**
 * Navigate Randombook using Playwright
 */
async function navigateRandombookWithPlaywright(randombookUrl: string): Promise<string | null> {
  const playwright = await import('playwright');

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  try {
    console.log('[Randombook] Playwright navigating to:', randombookUrl);
    await page.goto(randombookUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for any initial redirects
    await page.waitForTimeout(2000);

    // Look for download buttons
    const downloadButtonSelectors = [
      'button:has-text("Download")',
      'a:has-text("Download")',
      'button.download',
      'a.download-btn',
      '[data-download]',
    ];

    for (const selector of downloadButtonSelectors) {
      const button = await page.$(selector).catch(() => null);
      if (button) {
        console.log('[Randombook] Found download button:', selector);

        // Click and wait for download or redirect
        await button.click();
        await page.waitForTimeout(3000);

        // Check if redirected to download URL
        const currentUrl = page.url();
        if (currentUrl !== randombookUrl && currentUrl.match(/\.(epub|mobi|pdf|azw3)$/i)) {
          console.log('[Randombook] Redirected to download URL:', currentUrl);
          await browser.close();
          return currentUrl;
        }

        // Look for download link that appeared
        const downloadLink = await page.$eval(
          'a[href*=".epub"], a[href*=".mobi"], a[href*=".pdf"], a[href*="download"]',
          (el: HTMLAnchorElement) => el.href
        ).catch(() => null);

        if (downloadLink) {
          console.log('[Randombook] Found download link after click:', downloadLink);
          await browser.close();
          return downloadLink;
        }
      }
    }

    await browser.close();
    return null;
  } catch (error) {
    console.error('[Randombook] Playwright navigation error:', error);
    await browser.close();
    return null;
  }
}

/**
 * Resolve LibGen ads.php download link
 */
async function resolveAdsPhp(adsPhpUrl: string): Promise<string | null> {
  try {
    console.log('[ads.php] Fetching:', adsPhpUrl);
    const response = await axios.get(adsPhpUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
      httpsAgent,
    });

    const $ = cheerio.load(response.data);

    // Look for GET/Download links
    const downloadSelectors = [
      'a:contains("GET")',
      'a:contains("Download")',
      'a[href*="/get.php"]',
      'a[href*="cloudflare"]',
      'a[href*="ipfs"]',
    ];

    for (const selector of downloadSelectors) {
      const link = $(selector).first().attr('href');
      if (link && link.startsWith('http') && !link.includes('.onion')) {
        console.log('[ads.php] Found download link:', link);
        return link;
      }
    }

    console.log('[ads.php] No direct download link found');
    return null;
  } catch (error) {
    console.error('[ads.php] Error:', error);
    return null;
  }
}
