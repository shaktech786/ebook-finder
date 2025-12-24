import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title');
    const author = searchParams.get('author');
    const md5 = searchParams.get('md5');

    if (!title || !author) {
      return NextResponse.json(
        { error: 'Title and author are required' },
        { status: 400 }
      );
    }

    // Try LibGen cover first if MD5 is available
    if (md5) {
      try {
        const libgenUrl = `http://library.lol/covers/${md5.substring(0, 3)}000000/${md5}.jpg`;
        const response = await axios.head(libgenUrl, { timeout: 3000 });
        if (response.status === 200) {
          return NextResponse.redirect(libgenUrl);
        }
      } catch (error) {
        console.log('LibGen cover not found, trying OpenLibrary...');
      }
    }

    // Fallback to OpenLibrary
    const query = `${title} ${author}`.trim();
    const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`;

    const searchResponse = await axios.get(searchUrl, { timeout: 5000 });
    const books = searchResponse.data.docs;

    if (books && books.length > 0 && books[0].cover_i) {
      const coverId = books[0].cover_i;
      const coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      return NextResponse.redirect(coverUrl);
    }

    // Return placeholder response
    return NextResponse.json({ error: 'No cover found' }, { status: 404 });
  } catch (error) {
    console.error('Cover fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch cover' }, { status: 500 });
  }
}
