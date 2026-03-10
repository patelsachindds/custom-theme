/**
 * Cart Bundle Cleanup Logic
 * Checks the cart for "orphan" bundle members that no longer have their main product.
 * Removes them automatically to maintain bundle integrity.
 */

async function cleanupOrphanBundleItems() {
    try {
        const response = await fetch(window.Shopify.routes.root + 'cart.js');
        const cart = await response.json();

        if (!cart.items || cart.items.length === 0) return;

        // Map to track if a bundleId has its 'main' product present
        const bundleStatus = {}; // { bundleId: hasMain }
        const itemsToRemove = {}; // { lineKey: quantity 0 }

        // First pass: Identify all bundles and check for 'main' units
        cart.items.forEach(item => {
            const bId = item.properties?.['_bundleId'];
            const bRole = item.properties?.['_bundleRole'];

            if (bId) {
                if (!bundleStatus[bId]) bundleStatus[bId] = false;
                if (bRole === 'main') {
                    bundleStatus[bId] = true;
                }
            }
        });

        // Second pass: Find members whose 'main' is missing
        let foundOrphans = false;
        cart.items.forEach(item => {
            const bId = item.properties?.['_bundleId'];
            const bRole = item.properties?.['_bundleRole'];

            if (bId && bRole === 'member' && !bundleStatus[bId]) {
                itemsToRemove[item.key] = 0;
                foundOrphans = true;
            }
        });

        if (foundOrphans) {
            console.log('Bundle Cleanup: Removing orphan items...', itemsToRemove);
            const updateResponse = await fetch(window.Shopify.routes.root + 'cart/update.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: itemsToRemove })
            });

            if (updateResponse.ok) {
                // Trigger refresh if we actually removed something
                // Dispatch standard theme events to update drawers and cart pages
                window.dispatchEvent(new Event('cart:updated'));
                document.documentElement.dispatchEvent(new CustomEvent('cart:change', { bubbles: true }));
            }
        }
    } catch (e) {
        console.error('Bundle Cleanup Error:', e);
    }
}

// Listen for cart updates to trigger cleanup
// Debounced to avoid race conditions with multiple rapid updates
let cleanupTimeout;
const debouncedCleanup = () => {
    clearTimeout(cleanupTimeout);
    cleanupTimeout = setTimeout(cleanupOrphanBundleItems, 500);
};

// Hook into common cart event names
document.addEventListener('cart:updated', debouncedCleanup);
document.addEventListener('cart:change', debouncedCleanup);
// Hook into standard Fetch/XHR if needed or themes custom events
// For this theme, cart:updated seems to be the primary event.
