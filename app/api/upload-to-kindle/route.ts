import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute for file upload and email

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const kindleEmail = formData.get('kindleEmail') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!kindleEmail) {
      return NextResponse.json(
        { error: 'Kindle email is required' },
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

    // Validate file type
    const validExtensions = ['.epub', '.mobi', '.pdf', '.azw3'];
    const fileName = file.name;
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an EPUB, MOBI, AZW3, or PDF file.' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max for Kindle)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB for Kindle delivery.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    console.log(`[Upload to Kindle] Sending file: ${fileName} (${fileBuffer.byteLength} bytes) to ${kindleEmail}`);

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
      '.epub': 'application/epub+zip',
      '.mobi': 'application/x-mobipocket-ebook',
      '.azw3': 'application/vnd.amazon.ebook',
      '.pdf': 'application/pdf',
    };

    const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';

    // Send email with ebook attachment
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: kindleEmail,
      subject: 'Convert', // Amazon automatically converts with this subject
      text: `Your uploaded ebook: ${fileName}`,
      attachments: [
        {
          filename: fileName,
          content: fileBuffer,
          contentType: mimeType,
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    console.log(`[Upload to Kindle] ✓ Successfully sent ${fileName} to ${kindleEmail}`);

    return NextResponse.json({
      success: true,
      message: `Successfully sent "${fileName}" to ${kindleEmail}`,
    });
  } catch (error) {
    console.error('[Upload to Kindle] Error:', error);

    let errorMessage = 'Failed to send file to Kindle';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
