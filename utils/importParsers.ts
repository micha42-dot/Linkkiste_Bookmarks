/**
 * Parser utilities for importing bookmarks from all major services and formats:
 * - Raindrop.io (CSV, HTML, JSON)
 * - Pinboard (JSON, XML, Netscape HTML)
 * - Delicious (CSV, XML, JSON)
 * - Pocket / Readwise Reader / Instapaper (HTML, CSV, JSON)
 * - Standard Browser Netscape HTML (Google Chrome, Firefox, Safari, Edge, Brave, Opera, Arc)
 * - Diigo, Omnivore, Wallabag, LINKkiste backups, generic CSV & JSON
 */

export interface ParsedBookmarkItem {
  title: string;
  url?: string;
  description?: string;
  notes?: string;
  tags: string[];
  folders: string[];
  to_read?: boolean;
  created_at?: string;
}

/**
 * Full robust CSV string parser handling multi-line quoted fields
 */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  // Normalize newlines
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parse CSV format (Raindrop, Pinboard, Instapaper, Readwise, Diigo, LINKkiste, generic CSV)
 */
export function parseCsvBookmarks(csvContent: string): ParsedBookmarkItem[] {
  const rows = parseCsv(csvContent);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  
  // Find column indexes
  const findCol = (aliases: string[]) => headers.findIndex(h => aliases.includes(h));

  const titleIdx = findCol(['title', 'name', 'headline', 'titel', 'description']); // In Pinboard CSV description is Title
  const urlIdx = findCol(['url', 'href', 'link', 'address', 'uri']);
  const tagsIdx = findCol(['tags', 'tag', 'labels', 'keywords', 'schlagworte', 'kategorien']);
  const folderIdx = findCol(['folder', 'folders', 'collection', 'ordner', 'category', 'category name', 'kollektion']);
  const descIdx = findCol(['description', 'desc', 'excerpt', 'summary', 'beschreibung', 'selection']);
  const notesIdx = findCol(['notes', 'note', 'extended', 'memo', 'body', 'notiz', 'notizen', 'comments', 'annotations']);
  const toReadIdx = findCol(['to_read', 'toread', 'to read', 'unread', 'read_later', 'reading_list', 'read']);
  const createdIdx = findCol(['created_at', 'created', 'date', 'time', 'added', 'datum', 'timestamp', 'date added']);

  const isPinboardCsv = headers.includes('href') && headers.includes('extended') && headers.includes('description');

  const items: ParsedBookmarkItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0) continue;

    const rawUrl = urlIdx !== -1 ? row[urlIdx]?.trim() : '';
    let rawTitle = titleIdx !== -1 ? row[titleIdx]?.trim() : '';
    let rawDesc = descIdx !== -1 ? row[descIdx]?.trim() : '';
    const rawNotes = notesIdx !== -1 ? row[notesIdx]?.trim() : '';
    const rawTags = tagsIdx !== -1 ? row[tagsIdx]?.trim() : '';
    const rawFolder = folderIdx !== -1 ? row[folderIdx]?.trim() : '';
    const rawToRead = toReadIdx !== -1 ? row[toReadIdx]?.trim().toLowerCase() : '';
    const rawCreated = createdIdx !== -1 ? row[createdIdx]?.trim() : '';

    // Special case for Pinboard CSV: header 'description' is the Title, and 'extended' is the Notes/Description
    if (isPinboardCsv) {
      rawTitle = row[headers.indexOf('description')] || rawUrl || 'Untitled Bookmark';
      rawDesc = row[headers.indexOf('extended')] || '';
    }

    // Must have at least a URL or a title
    if (!rawUrl && !rawTitle) continue;

    // Parse tags (comma, semicolon, space, or hashtag-separated)
    let tags: string[] = [];
    if (rawTags) {
      if (rawTags.includes(',')) {
        tags = rawTags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      } else if (rawTags.includes(';')) {
        tags = rawTags.split(';').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      } else {
        tags = rawTags.split(/\s+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      }
    }

    // Parse folders
    let folders: string[] = [];
    if (rawFolder) {
      if (rawFolder.includes(',')) {
        folders = rawFolder.split(',').map(f => f.trim()).filter(Boolean);
      } else if (rawFolder.includes('/')) {
        folders = rawFolder.split('/').map(f => f.trim()).filter(Boolean);
      } else {
        folders = [rawFolder.trim()];
      }
    }

    const to_read = rawToRead === 'true' || rawToRead === '1' || rawToRead === 'yes' || rawToRead === 'unread';

    items.push({
      title: rawTitle || rawUrl || 'Untitled Bookmark',
      url: rawUrl || undefined,
      description: rawDesc || undefined,
      notes: rawNotes || undefined,
      tags: Array.from(new Set(tags)),
      folders: Array.from(new Set(folders)),
      to_read,
      created_at: rawCreated ? new Date(rawCreated).toISOString() : new Date().toISOString()
    });
  }

  return items;
}

/**
 * Parse Netscape Bookmark HTML file (Chrome, Firefox, Safari, Edge, Raindrop, Pocket, Pinboard, Delicious)
 */
export function parseNetscapeHtmlBookmarks(htmlContent: string): ParsedBookmarkItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const items: ParsedBookmarkItem[] = [];
  const links = doc.querySelectorAll('a');

  links.forEach(a => {
    const url = a.getAttribute('href') || '';
    const title = a.textContent?.trim() || url || 'Untitled';
    if (!url && !title) return;

    // Attributes
    const addDate = a.getAttribute('add_date') || a.getAttribute('last_modified') || a.getAttribute('time_added');
    const tagsAttr = a.getAttribute('tags') || a.getAttribute('tag') || '';
    const toReadAttr = a.getAttribute('toread') || a.getAttribute('to_read');
    
    // Check if next sibling or adjacent DD contains description/notes
    let description = '';
    let parent = a.parentElement;
    if (parent) {
      let next = parent.nextElementSibling;
      if (next && next.tagName === 'DD') {
        description = next.textContent?.trim() || '';
      }
    }

    // Determine folder path by looking at preceding <H3> or ancestors
    const folders: string[] = [];
    let currentElem: HTMLElement | null = a.closest('dl');
    while (currentElem) {
      const prevHeading = currentElem.previousElementSibling;
      if (prevHeading && (prevHeading.tagName === 'H3' || prevHeading.tagName === 'H2' || prevHeading.tagName === 'H1')) {
        const folderName = prevHeading.textContent?.trim();
        if (folderName && !['Bookmarks Menu', 'Bookmarks Bar', 'Other Bookmarks', 'Lesezeichenleiste', 'Weitere Lesezeichen', 'Unsorted Bookmarks'].includes(folderName)) {
          folders.unshift(folderName);
        }
      }
      currentElem = currentElem.parentElement?.closest('dl') || null;
    }

    // Extract tags
    let tags: string[] = [];
    if (tagsAttr) {
      if (tagsAttr.includes(',')) {
        tags = tagsAttr.split(',').map(t => t.trim()).filter(Boolean);
      } else {
        tags = tagsAttr.split(/\s+/).map(t => t.trim()).filter(Boolean);
      }
    }

    let created_at = new Date().toISOString();
    if (addDate) {
      const num = parseInt(addDate, 10);
      if (!isNaN(num)) {
        const dateObj = num < 10000000000 ? new Date(num * 1000) : new Date(num);
        if (!isNaN(dateObj.getTime())) {
          created_at = dateObj.toISOString();
        }
      }
    }

    const to_read = toReadAttr === '1' || toReadAttr === 'yes' || toReadAttr === 'true';

    items.push({
      title,
      url: url || undefined,
      description: description || undefined,
      tags: Array.from(new Set(tags)),
      folders: Array.from(new Set(folders)),
      to_read,
      created_at
    });
  });

  return items;
}

/**
 * Parse Pinboard & Delicious XML export format (<posts><post href="..." description="..." extended="..." tag="..." time="..." toread="..." /></posts>)
 */
export function parsePinboardXmlBookmarks(xmlContent: string): ParsedBookmarkItem[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
  const postElements = xmlDoc.querySelectorAll('post, bookmark, item');

  const items: ParsedBookmarkItem[] = [];

  postElements.forEach(post => {
    const url = post.getAttribute('href') || post.getAttribute('url') || post.querySelector('href, url')?.textContent || '';
    // In Pinboard/Delicious XML, 'description' is the title, 'extended' is the notes
    const title = post.getAttribute('description') || post.getAttribute('title') || post.querySelector('title, description')?.textContent || url || 'Untitled';
    const extended = post.getAttribute('extended') || post.getAttribute('notes') || post.querySelector('extended, notes, description')?.textContent || '';
    const tagAttr = post.getAttribute('tag') || post.getAttribute('tags') || post.querySelector('tag, tags')?.textContent || '';
    const timeAttr = post.getAttribute('time') || post.getAttribute('created') || post.querySelector('time, created')?.textContent || '';
    const toreadAttr = post.getAttribute('toread') || post.getAttribute('to_read') || '';

    let tags: string[] = [];
    if (tagAttr) {
      tags = tagAttr.split(/\s+/).map(t => t.trim()).filter(Boolean);
    }

    let created_at = new Date().toISOString();
    if (timeAttr) {
      const parsedDate = new Date(timeAttr);
      if (!isNaN(parsedDate.getTime())) {
        created_at = parsedDate.toISOString();
      }
    }

    const to_read = toreadAttr === 'yes' || toreadAttr === '1' || toreadAttr === 'true';

    items.push({
      title,
      url: url || undefined,
      description: extended || undefined,
      tags: Array.from(new Set(tags)),
      folders: [],
      to_read,
      created_at
    });
  });

  return items;
}

/**
 * Parse JSON format (Pinboard JSON, Raindrop JSON, Delicious JSON, Omnivore JSON, LINKkiste backup, generic JSON)
 */
export function parseJsonBookmarks(jsonContent: string): ParsedBookmarkItem[] {
  try {
    const parsed = JSON.parse(jsonContent);
    let array: any[] = [];

    if (Array.isArray(parsed)) {
      array = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.bookmarks)) array = parsed.bookmarks;
      else if (Array.isArray(parsed.items)) array = parsed.items;
      else if (Array.isArray(parsed.data)) array = parsed.data;
      else if (Array.isArray(parsed.results)) array = parsed.results;
      else if (Array.isArray(parsed.posts)) array = parsed.posts;
    }

    return array.map(item => {
      const url = item.href || item.url || item.link || item.address || undefined;

      // In Pinboard JSON: 'description' is the title, 'extended' is the notes!
      const isPinboardJson = Boolean(item.href && item.description !== undefined && item.extended !== undefined);
      
      const title = isPinboardJson 
        ? (item.description || item.href || 'Untitled') 
        : (item.title || item.name || item.description || item.url || 'Untitled');

      const description = isPinboardJson
        ? (item.extended || undefined)
        : (item.description || item.desc || item.excerpt || item.summary || undefined);

      const notes = isPinboardJson ? undefined : (item.notes || item.note || item.memo || undefined);

      // Tags parsing
      const rawTags = item.tags || item.tag || item.labels || item.keywords || [];
      let tags: string[] = [];
      if (Array.isArray(rawTags)) {
        tags = rawTags.map(t => String(t).trim()).filter(Boolean);
      } else if (typeof rawTags === 'string') {
        tags = rawTags.includes(',') 
          ? rawTags.split(',').map(t => t.trim()).filter(Boolean)
          : rawTags.split(/\s+/).map(t => t.trim()).filter(Boolean);
      }

      // Folders parsing
      const rawFolders = item.folders || item.folder || item.collection || item.category || [];
      let folders: string[] = [];
      if (Array.isArray(rawFolders)) {
        folders = rawFolders.map(f => String(f).trim()).filter(Boolean);
      } else if (typeof rawFolders === 'string' && rawFolders.trim()) {
        folders = [rawFolders.trim()];
      }

      const to_read = Boolean(item.to_read || item.toread === 'yes' || item.toread === '1' || item.unread);

      let created_at = new Date().toISOString();
      const rawTime = item.time || item.created_at || item.created || item.date || item.add_date;
      if (rawTime) {
        const d = new Date(rawTime);
        if (!isNaN(d.getTime())) {
          created_at = d.toISOString();
        }
      }

      return {
        title,
        url,
        description,
        notes,
        tags: Array.from(new Set(tags)),
        folders: Array.from(new Set(folders)),
        to_read,
        created_at
      };
    }).filter(item => item.url || item.title);
  } catch (e) {
    console.error('Failed to parse JSON bookmarks:', e);
    return [];
  }
}

/**
 * Master parse function that auto-detects service and file format by extension and content
 */
export function autoParseBookmarkFile(fileName: string, content: string): { items: ParsedBookmarkItem[]; formatName: string } {
  const lowerName = fileName.toLowerCase();
  const trimmed = content.trim();

  // 1. Pinboard / Delicious XML
  if (lowerName.endsWith('.xml') || (trimmed.startsWith('<?xml') && (trimmed.includes('<post') || trimmed.includes('<posts') || trimmed.includes('<bookmarks>')))) {
    const items = parsePinboardXmlBookmarks(content);
    if (items.length > 0) {
      return { items, formatName: 'Pinboard / Delicious XML Export' };
    }
  }

  // 2. JSON (Pinboard, Raindrop, LINKkiste, Omnivore, etc.)
  if (lowerName.endsWith('.json') || trimmed.startsWith('[') || (trimmed.startsWith('{') && (trimmed.includes('"bookmarks"') || trimmed.includes('"items"') || trimmed.includes('"posts"') || trimmed.includes('"data"')))) {
    const items = parseJsonBookmarks(content);
    const isPinboard = content.includes('"href"') && content.includes('"extended"');
    const isRaindrop = content.includes('"collection"') || content.includes('"raindrop"');
    
    let formatName = 'JSON Bookmark Backup';
    if (isPinboard) formatName = 'Pinboard JSON Export';
    else if (isRaindrop) formatName = 'Raindrop JSON Export';
    else if (content.includes('"linkkiste"')) formatName = 'LINKkiste Backup (JSON)';

    return { items, formatName };
  }

  // 3. HTML (Netscape Bookmarks - Chrome, Firefox, Safari, Raindrop, Pocket, Pinboard, Edge, Brave, etc.)
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || trimmed.toLowerCase().includes('<!doctype netscape-bookmark-file-1>') || trimmed.toLowerCase().includes('<h3') || trimmed.toLowerCase().includes('<dl>') || trimmed.toLowerCase().includes('<dt><a')) {
    const items = parseNetscapeHtmlBookmarks(content);
    const isPocket = trimmed.includes('pocket') || lowerName.includes('ril_export') || lowerName.includes('pocket');
    const isPinboard = trimmed.includes('pinboard') || lowerName.includes('pinboard');
    const isRaindrop = lowerName.includes('raindrop');
    
    let formatName = 'Browser HTML Bookmarks (Chrome, Firefox, Safari, Edge)';
    if (isPocket) formatName = 'Pocket HTML Export';
    else if (isPinboard) formatName = 'Pinboard HTML Export';
    else if (isRaindrop) formatName = 'Raindrop HTML Bookmarks';

    return { items, formatName };
  }

  // 4. CSV (Raindrop, Pinboard, Instapaper, Readwise, Diigo, Excel)
  if (lowerName.endsWith('.csv') || content.includes(',')) {
    const items = parseCsvBookmarks(content);
    const isPinboard = lowerName.includes('pinboard') || (content.includes('href') && content.includes('extended'));
    const isInstapaper = lowerName.includes('instapaper') || content.includes('Selection,Folder,Timestamp');
    const isReadwise = lowerName.includes('readwise') || content.includes('Highlight,URL,Author');
    const isRaindrop = lowerName.includes('raindrop') || (content.includes('folder') && content.includes('tags'));

    let formatName = 'CSV Table Export';
    if (isPinboard) formatName = 'Pinboard CSV Export';
    else if (isInstapaper) formatName = 'Instapaper CSV Export';
    else if (isReadwise) formatName = 'Readwise Reader CSV';
    else if (isRaindrop) formatName = 'Raindrop.io CSV Export';

    return { items, formatName };
  }

  return { items: [], formatName: 'Unbekanntes Format' };
}

