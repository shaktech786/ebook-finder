import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getLibgenDownloadLink } from '@/lib/scrapers/libgen';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { downloadUrl, fileName, fileFormat, source } = await request.json();

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Download URL is required' },
        { status: 400 }
      );
    }

    // Get actual download link for Library Genesis
    let actualDownloadUrl = downloadUrl;
    if (source === 'libgen' && !downloadUrl.includes('library.lol') && !downloadUrl.includes('cloudflare') && !downloadUrl.includes('ipfs.io')) {
      try {
        console.log('Resolving LibGen download link from:', downloadUrl);
        actualDownloadUrl = await getLibgenDownloadLink(downloadUrl);
        console.log('Resolved to:', actualDownloadUrl);
      } catch (error) {
        console.error('Failed to resolve LibGen link, trying original URL:', error);
        // Try the original URL as fallback
        actualDownloadUrl = downloadUrl;
      }
    }

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

    const fileData = Buffer.from(response.data);

    // Determine content type
    const contentType = response.headers['content-type'] || getContentType(fileFormat);

    // Generate safe filename
    const safeFileName = fileName || `download.${fileFormat || 'bin'}`;

    console.log(`Download successful: ${safeFileName} (${fileData.byteLength} bytes)`);

    // Return the file with download headers
    return new NextResponse(fileData, {
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

    return NextResponse.json(
      { error: errorMessage },
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
