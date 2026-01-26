
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

// HELPER: Safari-safe date parsing
// Exported so it can be used in components for logic (like "One Year Ago")
export const parseDateSafe = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    try {
        // Fix SQL timestamps for Safari: "2023-10-10 12:00:00" -> "2023-10-10T12:00:00"
        // Use regex to replace spaces with T globally, just in case
        const safeString = String(dateString).replace(/ /g, 'T');
        const d = new Date(safeString);
        
        // Check if date is valid
        if (isNaN(d.getTime())) return null;
        return d;
    } catch (e) {
        return null;
    }
}

// Consistent date formatting - SAFARI SAFE
export const formatDate = (dateString: string): string => {
    const dateObj = parseDateSafe(dateString);
    if (!dateObj) return '';
    try {
        return dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return '';
    }
};

export const formatDateTime = (dateString: string): string => {
    const dateObj = parseDateSafe(dateString);
    if (!dateObj) return '';
    try {
        return dateObj.toLocaleDateString('de-DE', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
        });
    } catch (e) {
        return '';
    }
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