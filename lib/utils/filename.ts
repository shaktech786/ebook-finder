/**
 * Creates a readable filename from book title and author
 * Format: "Title - Author.extension"
 */
export function createReadableFilename(
  title: string,
  author: string,
  format: string
): string {
  // Clean up title and author
  const cleanTitle = title
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  const cleanAuthor = author
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Combine as "Title - Author"
  const combined = `${cleanTitle} - ${cleanAuthor}`;

  // Limit total length to 150 chars (leaving room for extension)
  const truncated = combined.length > 150
    ? combined.substring(0, 150).trim()
    : combined;

  const extension = format.toLowerCase();
  return `${truncated}.${extension}`;
}
