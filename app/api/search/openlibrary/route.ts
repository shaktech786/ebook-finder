import { NextRequest, NextResponse } from 'next/server';
import { searchOpenLibrary } from '@/lib/scrapers/openlibrary';
import { analyzeSearchQuery } from '@/lib/search-analyzer';
import { getCache, setCache } from '@/lib/cache';
import { SearchResult } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = await getCache<SearchResult>('openlibrary', query, page);

    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Analyze the search query
    const searchQuery = analyzeSearchQuery(query);

    // Perform the search
    const books = await searchOpenLibrary({ query: searchQuery, page });

    const result: SearchResult = {
      books,
      total: books.length,
      page,
      query: searchQuery,
      source: 'openlibrary',
    };

    // Cache the results
    await setCache('openlibrary', query, result, page);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Open Library search error:', error);

    return NextResponse.json(
      {
        error: 'Failed to search Open Library',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
