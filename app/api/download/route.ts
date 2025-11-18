import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { smartGetLibgenDownload } from '@/lib/scrapers/libgen-browser';
import { playwrightGetDownload, needsPlaywright } from '@/lib/scrapers/libgen-playwright';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for Playwright operations

export async function POST(request: NextRequest) {
  let actualDownloadUrl = '';

  try {
    const { downloadUrl, fileName, fileFormat, source } = await request.json();

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Download URL is required' },
        { status: 400 }
      );
    }

    // Handle LibGen downloads with smart scraping
    actualDownloadUrl = downloadUrl;

    // For trusted sources (Archive.org, Open Library), redirect directly to avoid file corruption
    const trustedSources = ['archive', 'openlibrary', 'gutenberg', 'standardebooks'];
    if (trustedSources.includes(source) && actualDownloadUrl.startsWith('http')) {
      console.log(`[Download] Redirecting to trusted source: ${source}`);
      return NextResponse.json({
        redirect: true,
        downloadUrl: actualDownloadUrl,
        fileName: fileName,
      });
    }

    if (source === 'libgen') {
      try {
        console.log('LibGen download - using Playwright navigation...');

        // Skip HTTP request (often returns 500) and go straight to Playwright
        // This handles the full flow: file.php → mirror click → ads.php → GET link
        actualDownloadUrl = await playwrightGetDownload(downloadUrl, {
          timeout: 90000,
          maxWaitTime: 45000
        });
        console.log('Playwright navigation succeeded:', actualDownloadUrl);

        // Validate we got a real download URL
        if (!actualDownloadUrl || actualDownloadUrl === downloadUrl) {
          throw new Error('Could not resolve LibGen download link');
        }
      } catch (error) {
        console.error('All LibGen scraping methods failed:', error);

        // Fall back to manual download message
        return NextResponse.json(
          {
            error: 'LibGen downloads require manual access',
            message: 'Could not automatically resolve download link. LibGen requires Tor or manual download from their site.',
            libgenUrl: downloadUrl,
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 400 }
        );
      }
    }

    // Check if we have base64-encoded data from Playwright
    let fileData: Buffer;
    let contentType: string;

    if (actualDownloadUrl.startsWith('data:')) {
      console.log('Using Playwright-downloaded file data');
      // Extract base64 data from data URI
      const base64Data = actualDownloadUrl.split(',')[1];
      fileData = Buffer.from(base64Data, 'base64');
      contentType = getContentType(fileFormat);
      console.log(`Decoded Playwright file: ${fileData.byteLength} bytes`);
    } else {
      // Fetch the file from the remote URL
      console.log('Downloading file from:', actualDownloadUrl);
      const response = await axios.get(actualDownloadUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        timeout: 60000, // 60 second timeout
        maxContentLength: 50 * 1024 * 1024, // 50MB max
      });

      fileData = Buffer.from(response.data);
      // Determine content type
      contentType = response.headers['content-type'] || getContentType(fileFormat);
    }

    // Generate safe filename
    const safeFileName = fileName || `download.${fileFormat || 'bin'}`;

    console.log(`Download successful: ${safeFileName} (${fileData.byteLength} bytes)`);

    // Return the file with download headers
    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(fileData), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'Content-Length': fileData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);

    let errorMessage = 'Failed to download file';
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Download timeout - file may be too large';
      } else if (error.response?.status === 404) {
        errorMessage = 'File not found at download URL';
      } else {
        errorMessage = 'Failed to download file from server';
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Include the download URL in the error response so frontend can open it manually
    // Only include if it's a valid HTTP URL (not data URI or empty)
    const shouldIncludeUrl = actualDownloadUrl &&
                              actualDownloadUrl.startsWith('http') &&
                              !actualDownloadUrl.startsWith('data:');

    return NextResponse.json(
      {
        error: errorMessage,
        ...(shouldIncludeUrl && { downloadUrl: actualDownloadUrl })
      },
      { status: 500 }
    );
  }
}

function getContentType(fileFormat: string): string {
  const contentTypes: Record<string, string> = {
    'epub': 'application/epub+zip',
    'mobi': 'application/x-mobipocket-ebook',
    'azw3': 'application/vnd.amazon.ebook',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
  };
  return contentTypes[fileFormat?.toLowerCase()] || 'application/octet-stream';
}
