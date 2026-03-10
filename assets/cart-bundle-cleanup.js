/**
 * Cart Bundle Cleanup Logic v1.0.1
 * Checks the cart for "orphan" bundle members that no longer have their main product.
 * Removes them automatically to maintain bundle integrity.
 */

async function cleanupOrphanBundleItems() {
    console.log('Bundle Cleanup: Checking cart items...');
    try {
        const response = await fetch(window.Shopify.routes.root + 'cart.js');
        const cart = await response.json();

        if (!cart.items || cart.items.length === 0) {
            console.log('Bundle Cleanup: Cart is empty.');
            return;
        }

        // Map to track if a bundleId has its 'main' product present
        const bundleStatus = {}; // { bundleId: hasMain }
        const itemsToRemove = {}; // { lineKey: quantity 0 }

        // First pass: Identify all bundles and check for 'main' units
        cart.items.forEach(item => {
            const bId = item.properties ? item.properties['_bundleId'] : null;
            const bRole = item.properties ? item.properties['_bundleRole'] : null;

            if (bId) {
                if (bundleStatus[bId] === undefined) bundleStatus[bId] = false;
                if (bRole === 'main') {
                    bundleStatus[bId] = true;
                }
            }
        });

        // Second pass: Find members whose 'main' is missing
        let foundOrphans = false;
        cart.items.forEach(item => {
            const bId = item.properties ? item.properties['_bundleId'] : null;
            const bRole = item.properties ? item.properties['_bundleRole'] : null;

            if (bId && bRole === 'member' && bundleStatus[bId] === false) {
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
                console.log('Bundle Cleanup: Success. Refreshing cart UI.');
                // Trigger refresh if we actually removed something
                window.dispatchEvent(new Event('cart:updated'));
                document.documentElement.dispatchEvent(new CustomEvent('cart:change', { bubbles: true }));
            }
        } else {
            console.log('Bundle Cleanup: No orphans found.');
        }
    } catch (e) {
        console.error('Bundle Cleanup Error:', e);
    }
}

// Listen for cart updates to trigger cleanup
// Debounced to avoid race conditions with multiple rapid updates
let bundleCleanupTimeout;
const debouncedBundleCleanup = () => {
    console.log('Bundle Cleanup: Trigger event detected. Scheduling check...');
    clearTimeout(bundleCleanupTimeout);
    bundleCleanupTimeout = setTimeout(cleanupOrphanBundleItems, 1000);
};

// Hook into common cart event names
document.addEventListener('cart:updated', debouncedBundleCleanup);
document.addEventListener('cart:change', debouncedBundleCleanup);

// ALSO Hook into the Fetch API directly
// This ensures that even if the theme doesn't fire an event, we catch the cart update
if (!window._bundleFetchIntercepted) {
    window._bundleFetchIntercepted = true;
    const originalFetch = window.fetch;
    window.fetch = function () {
        return originalFetch.apply(this, arguments).then(response => {
            const url = arguments[0];
            if (typeof url === 'string') {
                const isCartUrl = url.includes('/cart/add') ||
                    url.includes('/cart/change') ||
                    url.includes('/cart/update') ||
                    url.includes('/cart/clear');
                if (isCartUrl && response.ok) {
                    debouncedBundleCleanup();
                }
            }
            return response;
        });
    };
}

/**
 * Initial check on page load to ensure clean state
 */
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(cleanupOrphanBundleItems, 1500);
});
