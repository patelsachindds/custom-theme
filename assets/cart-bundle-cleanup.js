/**
 * Cart Bundle Cleanup Logic v1.0.2
 * Checks the cart for "orphan" bundle members that no longer have their main product.
 * Removes them automatically to maintain bundle integrity.
 */

async function cleanupOrphanBundleItems() {
    console.log('Bundle Cleanup: Checking cart items...');
    try {
        const response = await fetch(window.Shopify.routes.root + 'cart.js', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const cart = await response.json();

        if (!cart.items || cart.items.length === 0) {
            console.log('Bundle Cleanup: Cart is empty.');
            return;
        }

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
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ updates: itemsToRemove })
            });

            if (updateResponse.ok) {
                console.log('Bundle Cleanup: Success. Refreshing Theme UI.');

                // Trigger the theme's own cart update event (ThemeEvents.cartUpdate is 'cart:update')
                // We pass an empty detail so CartItemsComponent calls sectionRenderer.renderSection
                const cartUpdateEvent = new CustomEvent('cart:update', {
                    bubbles: true,
                    detail: {
                        resource: await updateResponse.json(),
                        data: {
                            sections: {},
                            source: 'bundle-cleanup'
                        }
                    }
                });
                document.dispatchEvent(cartUpdateEvent);

                // Fallback for newer theme versions or different components
                window.dispatchEvent(new Event('cart:updated'));
            }
        } else {
            console.log('Bundle Cleanup: No orphans found.');
        }
    } catch (e) {
        console.error('Bundle Cleanup Error:', e);
    }
}

let bundleCleanupTimeout;
const debouncedBundleCleanup = () => {
    console.log('Bundle Cleanup: Trigger event detected. Scheduling check...');
    clearTimeout(bundleCleanupTimeout);
    bundleCleanupTimeout = setTimeout(cleanupOrphanBundleItems, 800);
};

// Listen for standard cart update events
document.addEventListener('cart:update', (e) => {
    if (e.detail?.data?.source === 'bundle-cleanup') return;
    debouncedBundleCleanup();
});
document.addEventListener('cart:change', debouncedBundleCleanup);

// Hook into Fetch to catch AJAX updates from theme
if (!window._bundleFetchIntercepted) {
    window._bundleFetchIntercepted = true;
    const originalFetch = window.fetch;
    window.fetch = function () {
        const url = arguments[0];
        const isCartUpdateCall = typeof url === 'string' &&
            (url.includes('/cart/add') ||
                url.includes('/cart/change') ||
                url.includes('/cart/update') ||
                url.includes('/cart/clear'));

        return originalFetch.apply(this, arguments).then(response => {
            if (isCartUpdateCall && response.ok) {
                // If it's a cart update, schedule a cleanup check
                debouncedBundleCleanup();
            }
            return response;
        });
    };
}

// Initial check on page load
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(cleanupOrphanBundleItems, 1000);
});
