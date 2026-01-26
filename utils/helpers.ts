
/**
 * Centralized helper functions to avoid redundancy and improve consistency.
 */

// SECURITY: Basic sanitization to prevent XSS via URL parameters
export const sanitizeInput = (str: string | null): string => {
    if (!str) return '';
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
};

// SECURITY: Ensure URLs don't contain javascript: protocol
export const sanitizeUrl = (url: string | null): string => {
    if (!url) return '';
    if (url.trim().toLowerCase().startsWith('javascript:')) return '';
    return url;
};

// Normalize URLs for duplicate checking (strips protocol and www)
export const normalizeUrl = (u: string) => {
    try {
        return u.trim().toLowerCase()
            .replace(/^(https?:\/\/)?(www\.)?/, '')
            .replace(/\/$/, '');
    } catch(e) { return u; }
};

// Consistent date formatting
export const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (dateString: string): string => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('de-DE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
    });
};

// Consistent tag parsing (string -> array)
export const parseTags = (tagsStr: string): string[] => {
    return tagsStr
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
};

// Parse tags for display (array -> string)
export const tagsToString = (tags: string[] | null): string => {
    return tags ? tags.join(', ') : '';
};

// SQL Escaping helper for Export
export const escapeSqlString = (str: string | null): string => {
    if (str === null || str === undefined) return 'NULL';
    // Escape single quotes by doubling them
    return `'${String(str).replace(/'/g, "''")}'`;
};
