/**
 * Deduplicate items by name, counting duplicates
 * @param {Array} items - Array of items to deduplicate
 * @returns {Array} Deduplicated items with count property
 */
export function deduplicateItemsByName(items) {
    const uniqueItems = new Map();
    
    items.forEach(item => {
        const key = item.name;
        if (uniqueItems.has(key)) {
            const existingItem = uniqueItems.get(key);
            existingItem.count = (existingItem.count || 1) + 1;
        } else {
            uniqueItems.set(key, {...item, count: 1});
        }
    });
    
    return Array.from(uniqueItems.values());
}