import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { smartGetLibgenDownload } from '@/lib/scrapers/libgen-browser';
import { playwrightGetDownload, needsPlaywright } from '@/lib/scrapers/libgen-playwright';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for Playwright operations

interface SendToKindleRequest {
  bookTitle: string;
  downloadUrl: string;
  kindleEmail: string;
  fileFormat: string;
  source: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendToKindleRequest = await request.json();
    const { bookTitle, downloadUrl, kindleEmail, fileFormat, source } = body;

    // Validate required fields
    if (!bookTitle || !downloadUrl || !kindleEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: bookTitle, downloadUrl, kindleEmail' },
        { status: 400 }
      );
    }

    // Validate Kindle email format
    if (!kindleEmail.includes('@') || (!kindleEmail.endsWith('@kindle.com') && !kindleEmail.endsWith('@free.kindle.com'))) {
      return NextResponse.json(
        { error: 'Invalid Kindle email address. Must end with @kindle.com or @free.kindle.com' },
        { status: 400 }
      );
    }

    // Handle LibGen with smart scraping
    let actualDownloadUrl = downloadUrl;

    if (source === 'libgen') {
      try {
        console.log('LibGen send-to-kindle - attempting smart scraping...');

        // Try smart HTTP scraping first
        try {
          actualDownloadUrl = await smartGetLibgenDownload(downloadUrl);
          console.log('Smart scraping succeeded:', actualDownloadUrl);
        } catch (smartError) {
          console.log('Smart scraping failed, trying Playwright...');

          // Try Playwright if smart scraping fails
          actualDownloadUrl = await playwrightGetDownload(downloadUrl, {
            timeout: 60000,
            maxWaitTime: 30000
          });
          console.log('Playwright scraping succeeded:', actualDownloadUrl);
        }

        if (!actualDownloadUrl || actualDownloadUrl === downloadUrl) {
          throw new Error('Could not resolve LibGen download link');
        }
      } catch (error) {
        console.error('All LibGen scraping methods failed:', error);

        return NextResponse.json(
          {
            error: 'LibGen books cannot be sent directly to Kindle',
            message: 'Could not automatically resolve download link. Please download manually from LibGen and email to your Kindle.',
            libgenUrl: downloadUrl,
            kindleEmail: kindleEmail,
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 400 }
        );
      }
    }

    // Download the ebook file
    console.log('Downloading ebook from:', actualDownloadUrl);
    const fileResponse = await axios.get(actualDownloadUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 60000, // 60 second timeout for large files
      maxContentLength: 50 * 1024 * 1024, // 50MB max
    });

    const fileBuffer = Buffer.from(fileResponse.data);
    const fileName = sanitizeFilename(bookTitle, fileFormat);

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Determine MIME type
    const mimeTypes: Record<string, string> = {
      epub: 'application/epub+zip',
      mobi: 'application/x-mobipocket-ebook',
      azw3: 'application/vnd.amazon.ebook',
      pdf: 'application/pdf',
    };

    const mimeType = mimeTypes[fileFormat.toLowerCase()] || 'application/octet-stream';

    // Send email with ebook attachment
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: kindleEmail,
      subject: 'Convert', // Amazon automatically converts with this subject
      text: `Your requested ebook: ${bookTitle}`,
      attachments: [
        {
          filename: fileName,
          content: fileBuffer,
          contentType: mimeType,
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: `Successfully sent "${bookTitle}" to ${kindleEmail}`,
    });
  } catch (error) {
    console.error('Send to Kindle error:', error);

    let errorMessage = 'Failed to send ebook to Kindle';
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Download timeout - file may be too large';
      } else if (error.response?.status === 404) {
        errorMessage = 'Ebook file not found at download URL';
      } else {
        errorMessage = 'Failed to download ebook file';
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

/**
 * Sanitizes filename for email attachment
 */
function sanitizeFilename(title: string, format: string): string {
  // Remove or replace invalid filename characters
  const sanitized = title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100); // Limit length

  const extension = format.toLowerCase();
  return `${sanitized}.${extension}`;
}
