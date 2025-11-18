import { NextRequest, NextResponse } from 'next/server';
import { Book } from '@/lib/types';
import { cascadingMetadataSearch } from '@/lib/metadata-search';
import { deduplicateAndMergeBooks } from '@/lib/search-optimizer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * API endpoint to find the best download URL for a book using metadata search
 * Uses cascading queries: ISBN → MD5 → Title+Author → Title → Author
 */
export async function POST(request: NextRequest) {
  try {
    const book: Book = await request.json();

    if (!book.title) {
      return NextResponse.json(
        { error: 'Book title is required' },
        { status: 400 }
      );
    }

    console.log(`[Find Best Download] Searching for: ${book.title} by ${book.author}`);

    // Define search function that queries LibGen (primary source)
    const searchLibGen = async (query: string): Promise<Book[]> => {
      try {
        const response = await fetch(
          `${request.nextUrl.origin}/api/search/libgen?q=${encodeURIComponent(query)}`,
          { signal: AbortSignal.timeout(15000) }
        );

        if (!response.ok) {
          throw new Error(`LibGen search failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.books || [];
      } catch (error) {
        console.error('[Find Best Download] LibGen search error:', error);
        return [];
      }
    };

    // Execute cascading metadata search
    const { books, usedQuery } = await cascadingMetadataSearch(book, searchLibGen, {
      minResults: 1,
      preferredSource: 'libgen',
    });

    if (books.length === 0) {
      return NextResponse.json(
        {
          error: 'No downloads found',
          message: 'Could not find this book using ISBN, title, or author',
          originalBook: book,
          queriesAttempted: ['isbn', 'md5', 'title-author', 'title', 'author'].filter(
            type => book.isbn || book.md5 || book.title || book.author
          ),
        },
        { status: 404 }
      );
    }

    // Find best match - prefer same format as original
    const sameFormatBooks = books.filter(b => b.fileFormat === book.fileFormat);
    const bestMatch = sameFormatBooks.length > 0 ? sameFormatBooks[0] : books[0];

    console.log(`[Find Best Download] ✓ Found best match using ${usedQuery.queryType}: ${bestMatch.title}`);
    console.log(`[Find Best Download] Format: ${bestMatch.fileFormat}, Size: ${bestMatch.fileSize}`);

    return NextResponse.json({
      success: true,
      book: bestMatch,
      metadata: {
        queryUsed: usedQuery.query,
        queryType: usedQuery.queryType,
        totalResults: books.length,
        preferredFormatMatch: sameFormatBooks.length > 0,
      },
    });
  } catch (error) {
    console.error('[Find Best Download] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to find best download',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
