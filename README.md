# 📚 Free Ebook Finder

A Next.js application that helps you find free ebooks from legitimate sources and send them directly to your Kindle device with one click.

## Features

### Core Functionality
- **Intelligent Search**: Search by title, author, ISBN, or natural language queries
- **Multiple Sources**: Library Genesis (more sources coming soon)
- **Smart Filtering**: English books only, format prioritization (EPUB > MOBI > PDF)
- **One-Click Send to Kindle**: Download and email books directly to your Kindle
- **24-Hour Caching**: Improved performance and reduced load on sources

### Senior-Friendly Design
- Large, readable fonts (minimum 18px)
- High contrast colors (forced light mode)
- Simple, single search box interface
- Large, easy-to-click buttons (44px+ touch targets)
- Accessible keyboard navigation

## Quick Start

### Prerequisites
- Node.js 18+
- Gmail account with App Password
- Amazon Kindle email address

### Installation

```bash
# Navigate to project
cd ebook-finder

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create `.env.local` (already configured):
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

## Usage

### First-Time Setup

1. **Set Kindle Email**
   - Click "Set Kindle Email" in header
   - Enter your @kindle.com or @free.kindle.com email
   - Find it at: Amazon.com → Manage Content & Devices → Preferences

2. **Add Approved Email**
   - Add `shakeel.bhamani@gmail.com` to approved senders
   - Same location as above, under "Personal Document Settings"

### Search Examples

```
# ISBN
9780140449136

# Author
Stephen King
by J.K. Rowling

# Title
"Harry Potter"
The Great Gatsby

# Topic
books about space
books like Harry Potter
```

## Project Structure

```
ebook-finder/
├── app/
│   ├── api/
│   │   ├── search/libgen/      # Search API
│   │   └── send-to-kindle/     # Email API
│   └── page.tsx                # Main page
├── components/
│   ├── BookCard.tsx
│   ├── BookGrid.tsx
│   ├── KindleEmailModal.tsx
│   └── SearchBar.tsx
├── lib/
│   ├── scrapers/libgen.ts
│   ├── cache.ts
│   ├── search-analyzer.ts
│   └── types.ts
└── .cache/                     # Search cache
```

## Troubleshooting

### Email Not Sending
- Check `.env.local` credentials
- Verify App Password (16 chars, no spaces)
- Check approved emails in Amazon settings
- File size limit: 50MB

### Books Not on Kindle
- Verify Kindle email is correct
- Check approved sender list
- Wait 5-10 minutes for delivery

### Search Issues
- Check browser console (F12)
- Try different query
- Clear `.cache/` folder

## Development

```bash
# Build
npm run build

# Lint
npm run lint

# Production
npm run build && npm run start
```

## Tech Stack

- Next.js 14+ (App Router)
- React 18+
- TypeScript
- Tailwind CSS
- Nodemailer
- Cheerio
- Axios

## Future Features

- Additional sources (Gutenberg, Open Library, Internet Archive)
- Pagination
- Filters (year, format, size)
- Recent searches
- Favorites
- Download without Kindle

## Legal

Searches only free, public domain, or legally redistributable ebooks from legitimate sources.
