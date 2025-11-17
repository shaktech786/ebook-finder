import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { downloadUrl, fileName, fileFormat } = await request.json();

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Download URL is required' },
        { status: 400 }
      );
    }

    // Fetch the file from the remote URL
    const response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    // Get the file data
    const fileData = await response.arrayBuffer();

    // Determine content type
    const contentType = response.headers.get('content-type') ||
      getContentType(fileFormat);

    // Generate safe filename
    const safeFileName = fileName || `download.${fileFormat || 'bin'}`;

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download file' },
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
