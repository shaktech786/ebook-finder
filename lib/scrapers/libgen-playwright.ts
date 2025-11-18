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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled' // Hide automation
      ],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true, // For LibGen's self-signed certs
      acceptDownloads: true,
      // Make it look more like a real browser
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    // Remove webdriver property to avoid bot detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    const page = await context.newPage();

    // Track popups but DON'T block them immediately (for bot detection bypass)
    const popups: any[] = [];
    context.on('page', async (newPage) => {
      console.log('[Playwright] Popup detected, tracking it...');
      popups.push(newPage);
      // Don't close immediately - let the site think we're human
      // We'll close it after a delay
    });

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
    const downloadLink = await findDownloadLink(page, maxWaitTime, startUrl, popups);

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
 * Handle LibGen.li specific download flow
 * Flow: file.php → click mirror → ads.php → click GET → get.php
 */
async function handleLibgenFlow(page: any, currentUrl: string, popups: any[]): Promise<string | null> {
  try {
    console.log('[LibGen] Current URL:', currentUrl);
    await page.waitForTimeout(1500);

    // Check if we're already on ads.php page
    if (currentUrl.includes('/ads.php')) {
      console.log('[LibGen] Already on ads.php, looking for GET link...');
      return await extractLibgenGetLink(page, currentUrl, popups);
    }

    // We're on file.php, look for Libgen mirror link
    console.log('[LibGen] On file.php, searching for mirror link...');

    // DEBUG: Log all links on the page to understand what we're working with
    const debugLinks = await page.$$eval('a', (links: HTMLAnchorElement[]) =>
      links.map(link => ({
        text: link.textContent?.trim().substring(0, 50),
        href: link.href,
        hasAdsPhp: link.href.includes('/ads.php'),
        hasGetPhp: link.href.includes('/get.php')
      }))
    );
    console.log('[LibGen DEBUG] Found', debugLinks.length, 'total links on page');
    console.log('[LibGen DEBUG] Links with ads.php:', debugLinks.filter(l => l.hasAdsPhp).length);
    console.log('[LibGen DEBUG] Links with get.php:', debugLinks.filter(l => l.hasGetPhp).length);

    // Log first few ads.php links
    const adsLinks = debugLinks.filter(l => l.hasAdsPhp).slice(0, 3);
    if (adsLinks.length > 0) {
      console.log('[LibGen DEBUG] Sample ads.php links:', JSON.stringify(adsLinks, null, 2));
    }

    // Find link with "Libgen" or "mirror" text that goes to ads.php
    const allLinks = await page.$$('a');

    for (const link of allLinks) {
      try {
        const text = await link.textContent();
        const href = await link.getAttribute('href');

        if (!text || !href) continue;

        const hasRelevantText = text.toLowerCase().includes('libgen') ||
                               text.toLowerCase().includes('mirror');
        const goesToAdsPage = href.includes('/ads.php');

        if (hasRelevantText && goesToAdsPage) {
          console.log(`[LibGen] Found mirror link: "${text.trim()}" → ${href}`);

          // Construct full URL if href is relative
          const fullHref = href.startsWith('http') ? href : `https://libgen.li${href}`;
          console.log('[LibGen] Found ads.php URL:', fullHref);

          // STRATEGY: Try direct HTTP fetch to ads.php (bypasses browser detection)
          console.log('[LibGen] Attempting direct HTTP fetch to ads.php (bypassing Playwright)...');
          try {
            const axios = await import('axios');
            const adsResponse = await axios.default.get(fullHref, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': currentUrl,
                'Accept': 'text/html,application/xhtml+xml,application/xml',
                'Accept-Language': 'en-US,en;q=0.9',
              },
              maxRedirects: 0, // Don't follow redirects
              validateStatus: (status) => status >= 200 && status < 400,
              timeout: 10000,
            });

            console.log('[LibGen] HTTP fetch succeeded! Status:', adsResponse.status);
            console.log('[LibGen] Response URL:', adsResponse.request?.res?.responseUrl || 'same');
            console.log('[LibGen] Response length:', adsResponse.data?.length || 0, 'bytes');

            // Parse the HTML to find GET link
            const cheerio = await import('cheerio');
            const $ = cheerio.load(adsResponse.data);

            // DEBUG: Log all links and their text
            const allLinks: Array<{text: string, href?: string}> = [];
            $('a').each((_, el) => {
              allLinks.push({
                text: $(el).text().trim().substring(0, 50),
                href: $(el).attr('href')
              });
            });
            console.log('[LibGen HTTP] Found', allLinks.length, 'links in HTML');
            console.log('[LibGen HTTP] Sample links:', JSON.stringify(allLinks.slice(0, 5), null, 2));

            // Find all links with "GET" text or get.php href
            const getLinks: string[] = [];
            $('a').each((_, el) => {
              const linkText = $(el).text().trim();
              const linkHref = $(el).attr('href');

              // Check for GET text OR get.php in href
              const hasGetText = linkText.toUpperCase().includes('GET');
              const hasGetPhp = linkHref && linkHref.includes('/get.php');

              if ((hasGetText || hasGetPhp) && linkHref) {
                // Fix URL construction - ensure slash is present
                let absoluteUrl: string;
                if (linkHref.startsWith('http')) {
                  absoluteUrl = linkHref;
                } else if (linkHref.startsWith('/')) {
                  absoluteUrl = `https://libgen.li${linkHref}`;
                } else {
                  // Relative path without leading slash
                  absoluteUrl = `https://libgen.li/${linkHref}`;
                }
                console.log('[LibGen] Found GET link via HTTP:', absoluteUrl, '(text:', linkText, ')');
                getLinks.push(absoluteUrl);
              }
            });

            if (getLinks.length > 0) {
              console.log('[LibGen] ✓✓✓ SUCCESS! Got download link via direct HTTP:', getLinks[0]);
              // Don't close browser here - it's needed by caller
              return getLinks[0];
            }

            console.log('[LibGen] No GET link found in HTTP response, falling back to Playwright click...');
          } catch (httpError: any) {
            console.log('[LibGen] HTTP fetch failed:', httpError.message);
            console.log('[LibGen] Falling back to Playwright click...');
          }

          console.log('[LibGen] Trying Playwright click method...');

          // Simulate human behavior before clicking
          console.log('[LibGen] Simulating human behavior...');

          // Random mouse movements (looks human)
          await page.mouse.move(Math.random() * 500, Math.random() * 500);
          await page.waitForTimeout(200 + Math.random() * 300);
          await page.mouse.move(Math.random() * 1000, Math.random() * 800);
          await page.waitForTimeout(300 + Math.random() * 400);

          // Scroll the page a bit (humans scroll before clicking)
          await page.mouse.wheel(0, 200 + Math.random() * 300);
          await page.waitForTimeout(400 + Math.random() * 600);

          // Move mouse near the link position
          try {
            const box = await link.boundingBox();
            if (box) {
              // Scroll element into view
              await link.scrollIntoViewIfNeeded();
              await page.waitForTimeout(300);

              // Move mouse close to the link (with some randomness)
              await page.mouse.move(
                box.x + box.width / 2 + (Math.random() - 0.5) * 20,
                box.y + box.height / 2 + (Math.random() - 0.5) * 20,
                { steps: 10 } // Smooth mouse movement
              );
              await page.waitForTimeout(200 + Math.random() * 300);
            }
          } catch (e) {
            // Link might not be visible, continue anyway
            console.log('[LibGen] Could not move mouse to link');
          }

          // Wait a bit more (simulate human reading/thinking)
          await page.waitForTimeout(800 + Math.random() * 700);

          // CLICK the link directly (not navigate) - this triggers proper JavaScript
          console.log('[LibGen] Clicking link...');
          try {
            // Set up navigation promise BEFORE clicking
            const navigationPromise = page.waitForNavigation({
              waitUntil: 'domcontentloaded',
              timeout: 15000
            }).catch((e) => {
              console.log('[LibGen] Navigation wait error (might be ok):', e.message);
              return null;
            });

            // Click the link (this triggers JavaScript)
            await link.click({
              delay: 50 + Math.random() * 100 // Human-like click delay
            }).catch((e) => {
              console.log('[LibGen] Click error:', e.message);
            });

            // Wait for navigation to complete
            await navigationPromise;
            await page.waitForTimeout(1000);
          } catch (navError) {
            console.log('[LibGen] Click/navigation failed, trying next link');
            continue;
          }

          await page.waitForTimeout(1500);

          const newUrl = page.url();
          console.log('[LibGen] Navigated to:', newUrl);

          // Check if we're on ads.php (not ad network)
          if (newUrl.includes('/ads.php') && newUrl.includes('libgen.li')) {
            console.log('[LibGen] Successfully reached ads.php page');
            // Wait for page to fully load and stabilize
            await page.waitForTimeout(2000);
            await page.waitForLoadState('networkidle').catch(() => {});
            return await extractLibgenGetLink(page, newUrl, popups);
          } else if (!newUrl.includes('libgen.li')) {
            console.log('[LibGen] Warning: Redirected to ad network, trying next link');
            // Go back to file.php and try next link
            await page.goto(currentUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(500);
            continue;
          }
        }
      } catch (err) {
        console.log('[LibGen] Link click failed, trying next');
        continue;
      }
    }

    console.log('[LibGen] No mirror links found');
    return null;
  } catch (error) {
    console.error('[LibGen] Flow error:', error);
    return null;
  }
}

/**
 * Extract GET link from LibGen ads.php page
 * Find the <a> tag that contains "GET" text - that one has the download link
 * IMPORTANT: Simulates real user behavior to bypass bot detection:
 * 1. First click triggers ad popup (bot detection mechanism)
 * 2. Wait and close popup (simulate human behavior)
 * 3. Second click/navigation actually downloads the file
 */
async function extractLibgenGetLink(page: any, baseUrl: string, popups: any[]): Promise<string | null> {
  try {
    console.log('[LibGen GET] Looking for GET download link on ads.php page...');

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Try to wait for any get.php links to appear
    try {
      await page.waitForSelector('a[href*="/get.php"]', { timeout: 5000 });
    } catch (e) {
      console.log('[LibGen GET] No get.php links found after 5s timeout');
    }

    // Find ALL <a> tags on the page
    const allLinks = await page.$$('a').catch((err: Error) => {
      console.error('[LibGen GET] Failed to get links, page may have navigated:', err.message);
      return [];
    });

    if (allLinks.length === 0) {
      console.log('[LibGen GET] No links found on page');
      return null;
    }

    console.log(`[LibGen GET] Found ${allLinks.length} total links on page`);

    // Find the <a> tag with "GET" text
    for (const link of allLinks) {
      try {
        const text = await link.textContent().catch(() => null);
        const href = await link.getAttribute('href').catch(() => null);

        if (!text || !href) continue;

        // Check if this link has "GET" in its text
        if (text.trim().toUpperCase() === 'GET' || text.toUpperCase().includes('GET')) {
          console.log(`[LibGen GET] Found link with GET text: "${text.trim()}" → ${href}`);

          // Check if href contains get.php
          if (href.includes('/get.php')) {
            // Construct full URL
            const baseUrlMatch = baseUrl.match(/(https?:\/\/[^\/]+)/);
            if (baseUrlMatch) {
              const fullUrl = href.startsWith('http') ? href : `${baseUrlMatch[1]}${href}`;
              console.log('[LibGen GET] ✓ Found GET download link:', fullUrl);

              // FIRST CLICK - Trigger bot detection (will open ad popup)
              console.log('[LibGen GET] STEP 1: First click to trigger ad/bot detection...');
              const popupCount = popups.length;

              try {
                // Click the link (this will trigger the ad popup)
                await link.click({ timeout: 3000 }).catch(() => {
                  console.log('[LibGen GET] Click triggered or failed, continuing...');
                });

                // Wait a bit for popup to open
                await page.waitForTimeout(2000);

                // Check if popup opened
                if (popups.length > popupCount) {
                  console.log('[LibGen GET] ✓ Ad popup detected (bot check triggered)');
                  console.log('[LibGen GET] STEP 2: Simulating human - waiting 2s then closing ad...');
                  await page.waitForTimeout(2000); // Simulate human seeing the ad

                  // Close all popups
                  for (const popup of popups) {
                    try {
                      await popup.close();
                      console.log('[LibGen GET] ✓ Closed ad popup');
                    } catch (e) {
                      // Popup might already be closed
                    }
                  }
                } else {
                  console.log('[LibGen GET] No popup detected, continuing anyway...');
                }
              } catch (e) {
                console.log('[LibGen GET] First click error (expected):', e);
              }

              // SECOND ATTEMPT - Now we should pass the bot check
              console.log('[LibGen GET] STEP 3: Second navigation (should download now)...');

              // Set up download event listener
              const downloadPromise = new Promise<string>((resolve, reject) => {
                const downloadTimeout = setTimeout(() => {
                  reject(new Error('Download timeout after 30s'));
                }, 30000);

                page.once('download', async (download: any) => {
                  clearTimeout(downloadTimeout);
                  try {
                    console.log('[LibGen GET] ✓✓✓ Download started:', download.suggestedFilename());

                    // Get the download URL
                    const downloadUrl = download.url();
                    console.log('[LibGen GET] ✓✓✓ Download URL captured:', downloadUrl);

                    // Cancel the download (we just need the URL)
                    await download.cancel().catch(() => {});

                    resolve(downloadUrl);
                  } catch (err) {
                    reject(err);
                  }
                });
              });

              // Navigate to download URL (second time, should work now)
              try {
                await page.goto(fullUrl, {
                  waitUntil: 'domcontentloaded',
                  timeout: 15000
                });
              } catch (navError) {
                // Navigation might be interrupted by download, that's ok
                console.log('[LibGen GET] Navigation interrupted (likely by download)');
              }

              // Wait for download to start
              try {
                const downloadUrl = await downloadPromise;
                console.log('[LibGen GET] ✓✓✓ SUCCESS! Final download URL:', downloadUrl);
                return downloadUrl;
              } catch (downloadError) {
                console.log('[LibGen GET] No download event, checking final URL...');

                // Fallback: check if we ended up on a direct download URL
                const finalUrl = page.url();
                console.log('[LibGen GET] Final URL:', finalUrl);

                // If finalUrl is different from fullUrl, return it
                if (finalUrl !== fullUrl && finalUrl !== 'about:blank') {
                  return finalUrl;
                }

                // Last resort: return the original get.php URL
                return fullUrl;
              }
            }
          }
        }
      } catch (err) {
        continue;
      }
    }

    console.log('[LibGen GET] No GET link found');
    return null;
  } catch (error) {
    console.error('[LibGen GET] Error:', error);
    return null;
  }
}

/**
 * Find download link on page, handling various patterns
 */
async function findDownloadLink(page: any, maxWaitTime: number, startUrl: string, popups: any[]): Promise<string | null> {
  try {
    // LibGen-specific flow: file.php → mirror link → ads.php → GET link → get.php
    if (startUrl.includes('libgen.li/file.php') || startUrl.includes('libgen.li/ads.php')) {
      console.log('[Playwright] Detected LibGen URL, using specialized flow...');
      const libgenLink = await handleLibgenFlow(page, startUrl, popups);
      if (libgenLink) return libgenLink;
    }

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
