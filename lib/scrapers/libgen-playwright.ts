/**
 * Advanced LibGen download resolver using Playwright for JavaScript-heavy pages
 * Handles click-through gates, timers, and JavaScript redirects
 */

interface PlaywrightConfig {
  timeout?: number;
  maxWaitTime?: number;
}

/**
 * Use Playwright to navigate through download gates and extract final download link
 * This handles:
 * - "Click here after 60 seconds" type timers
 * - JavaScript-rendered download buttons
 * - Multi-step redirects
 * - CAPTCHA challenges (will fail gracefully)
 */
export async function playwrightGetDownload(
  startUrl: string,
  config: PlaywrightConfig = {}
): Promise<string> {
  const { timeout = 90000, maxWaitTime = 60000 } = config;

  try {
    // Dynamic import of playwright - only load when needed
    const playwright = await import('playwright');

    console.log('[Playwright] Launching browser...');
    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ignoreHTTPSErrors: true, // For LibGen's self-signed certs
    });

    const page = await context.newPage();

    // Track network requests to catch download URLs
    const downloadUrls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      // Catch direct file downloads
      if (url.match(/\.(epub|mobi|pdf|azw3)$/i) || url.includes('/download/') || url.includes('/get.php')) {
        console.log('[Playwright] Caught download URL:', url);
        downloadUrls.push(url);
      }
    });

    console.log('[Playwright] Navigating to:', startUrl);
    await page.goto(startUrl, {
      waitUntil: 'networkidle',
      timeout
    });

    // Look for common download patterns
    const downloadLink = await findDownloadLink(page, maxWaitTime, startUrl);

    await browser.close();

    if (downloadLink) {
      console.log('[Playwright] Found download link:', downloadLink);
      return downloadLink;
    }

    if (downloadUrls.length > 0) {
      console.log('[Playwright] Using captured download URL:', downloadUrls[0]);
      return downloadUrls[0];
    }

    throw new Error('No download link found after Playwright navigation');
  } catch (error) {
    console.error('[Playwright] Error:', error);
    throw error;
  }
}

/**
 * Find download link on page, handling various patterns
 */
async function findDownloadLink(page: any, maxWaitTime: number, startUrl: string): Promise<string | null> {
  try {
    // Pattern 1: Look for immediate download links
    const immediateLink = await page.$eval(
      'a[href*="/download/"], a[href*="/get.php"], a.download-button, a[download]',
      (el: HTMLAnchorElement) => el.href
    ).catch(() => null);

    if (immediateLink) {
      console.log('[Playwright] Found immediate download link');
      return immediateLink;
    }

    // Pattern 2: Look for download buttons with timers
    const timerButton = await page.$('button:has-text("seconds"), a:has-text("seconds"), div:has-text("wait")').catch(() => null);

    if (timerButton) {
      console.log('[Playwright] Found timer button, waiting...');

      // Extract wait time from text
      const buttonText = await timerButton.textContent();
      const waitMatch = buttonText?.match(/(\d+)\s*second/i);
      const waitSeconds = waitMatch ? parseInt(waitMatch[1]) : 10;

      console.log(`[Playwright] Waiting ${waitSeconds} seconds...`);
      await page.waitForTimeout(Math.min(waitSeconds * 1000, maxWaitTime));

      // Try clicking the button
      await timerButton.click().catch(() => {
        console.log('[Playwright] Click failed, button might not be ready');
      });

      // Wait for navigation or new links
      await page.waitForTimeout(2000);

      // Check for new download links
      const newLink = await page.$eval(
        'a[href*="/download/"], a[href*="/get.php"], a[download]',
        (el: HTMLAnchorElement) => el.href
      ).catch(() => null);

      if (newLink) {
        console.log('[Playwright] Found download link after timer');
        return newLink;
      }
    }

    // Pattern 3: Look for "GET" or "Download" buttons and click them
    const downloadButtons = [
      'button:has-text("GET")',
      'button:has-text("Download")',
      'a:has-text("GET")',
      'a:has-text("Download")',
      'button.btn-primary',
      'a.btn-download',
    ];

    for (const selector of downloadButtons) {
      const button = await page.$(selector).catch(() => null);
      if (button) {
        console.log('[Playwright] Found download button:', selector);

        // Click and wait for either navigation or file download
        const [response] = await Promise.race([
          Promise.all([
            page.click(selector),
            page.waitForNavigation({ timeout: 5000 }).catch(() => null)
          ]),
          page.waitForTimeout(5000).then(() => [null])
        ]);

        // Check if we got redirected to a download URL
        const currentUrl = page.url();
        if (currentUrl.match(/\.(epub|mobi|pdf|azw3)$/i)) {
          console.log('[Playwright] Redirected to download URL');
          return currentUrl;
        }

        // Look for download link after click
        const postClickLink = await page.$eval(
          'a[href*="/download/"], a[href*="/get.php"], a[download]',
          (el: HTMLAnchorElement) => el.href
        ).catch(() => null);

        if (postClickLink) {
          console.log('[Playwright] Found download link after button click');
          return postClickLink;
        }
      }
    }

    // Pattern 4: Check for meta refresh or JavaScript redirects
    const metaRefresh = await page.$eval(
      'meta[http-equiv="refresh"]',
      (el: HTMLMetaElement) => el.content
    ).catch(() => null);

    if (metaRefresh) {
      const urlMatch = metaRefresh.match(/url=(.+)/i);
      if (urlMatch) {
        const redirectUrl = urlMatch[1].trim();
        console.log('[Playwright] Found meta refresh redirect:', redirectUrl);

        // Navigate to redirect and try again
        await page.goto(redirectUrl, { waitUntil: 'networkidle', timeout: 10000 });
        return await findDownloadLink(page, maxWaitTime, redirectUrl);
      }
    }

    // Pattern 5: Look for download links in iframes
    const frames = page.frames();
    for (const frame of frames) {
      const frameLink = await frame.$eval(
        'a[href*="/download/"], a[href*="/get.php"]',
        (el: HTMLAnchorElement) => el.href
      ).catch(() => null);

      if (frameLink) {
        console.log('[Playwright] Found download link in iframe');
        return frameLink;
      }
    }

    return null;
  } catch (error) {
    console.error('[Playwright] Error finding download link:', error);
    return null;
  }
}

/**
 * Quick check if Playwright is needed for this URL
 * Some URLs can be resolved with simple HTTP requests
 */
export function needsPlaywright(url: string): boolean {
  // These domains typically need browser automation
  const browserNeededDomains = [
    'anonfiles',
    'mediafire',
    'mega.nz',
    'gofile',
    'pixeldrain',
  ];

  return browserNeededDomains.some(domain => url.includes(domain));
}
