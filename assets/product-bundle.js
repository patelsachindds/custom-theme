import { Component } from '@theme/component';

/**
 * A custom element that manages a product bundle.
 */
export class ProductBundleComponent extends Component {
    connectedCallback() {
        super.connectedCallback();

        this.submitButton = this.querySelector('.product-bundle__submit');
        this.checkboxes = this.querySelectorAll('.product-bundle__checkbox');
        this.items = this.querySelectorAll('.product-bundle__item');
        this.errorElement = this.querySelector('.product-bundle__error');
        this.totalPriceElement = this.querySelector('.product-bundle__total-price');

        if (this.submitButton) {
            this.submitButton.addEventListener('click', this.addToCart.bind(this));
        }

        this.checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', this.updateTotal.bind(this));
        });

        this.updateTotal();
    }

    updateTotal() {
        let total = 0;
        this.checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const item = checkbox.closest('.product-bundle__item');
                if (item) {
                    total += parseInt(item.dataset.price, 10);
                }
            }
        });

        if (this.totalPriceElement) {
            this.totalPriceElement.textContent = this.formatMoney(total);
        }
    }

    async addToCart(event) {
        if (event) event.preventDefault();

        if (this.submitButton.disabled) return;

        const originalText = this.submitButton.textContent;
        this.submitButton.disabled = true;
        this.submitButton.textContent = 'Adding...';

        if (this.errorElement) {
            this.errorElement.classList.add('hidden');
            this.errorElement.textContent = '';
        }

        try {
            const bundleId = Date.now().toString();
            const itemsToAdd = [];
            const mainVariantId = this.dataset.mainVariantId;

            // Add main product
            if (mainVariantId) {
                itemsToAdd.push({
                    id: mainVariantId,
                    quantity: 1,
                    properties: {
                        '_bundleId': bundleId,
                        '_bundleRole': 'main'
                    }
                });
            }

            // Add selected members
            this.checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    const item = checkbox.closest('.product-bundle__item');
                    const variantId = item ? item.dataset.variantId : null;

                    if (variantId && variantId !== mainVariantId) {
                        itemsToAdd.push({
                            id: variantId,
                            quantity: 1,
                            properties: {
                                '_bundleId': bundleId,
                                '_bundleRole': 'member'
                            }
                        });
                    }
                }
            });

            if (itemsToAdd.length === 0) {
                this.submitButton.disabled = false;
                this.submitButton.textContent = originalText;
                return;
            }

            // Prepare AJAX request with section rendering to refresh cart UI
            const cartItemsComponents = document.querySelectorAll('cart-items-component');
            const sections = Array.from(cartItemsComponents)
                .map(item => item.dataset.sectionId)
                .filter(Boolean);

            const formData = {
                items: itemsToAdd,
                sections: sections.join(',')
            };

            const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.description || 'Failed to add items to cart');
            }

            // Reset button state
            this.submitButton.disabled = false;
            this.submitButton.textContent = originalText;

            // 1. Dispatch theme-specific update event to refresh cart content
            // Defensive: ensure sections is at least an empty object
            const cartUpdateEvent = new CustomEvent('cart:update', {
                bubbles: true,
                detail: {
                    sourceId: this.id,
                    resource: result,
                    data: {
                        sections: result.sections || {},
                        source: 'product-bundle'
                    }
                }
            });
            document.dispatchEvent(cartUpdateEvent);

            // 2. Automatically open the cart drawer
            const cartDrawer = document.querySelector('cart-drawer-component');
            if (cartDrawer && typeof cartDrawer.open === 'function') {
                cartDrawer.open();
            }

            // 3. Fallback/Legacy events
            document.documentElement.dispatchEvent(new CustomEvent('cart:change', { bubbles: true }));
            window.dispatchEvent(new Event('cart:updated'));

        } catch (error) {
            console.error('Error adding bundle to cart:', error);
            if (this.errorElement) {
                this.errorElement.textContent = error.message;
                this.errorElement.classList.remove('hidden');
            }
            this.submitButton.disabled = false;
            this.submitButton.textContent = originalText;
        }
    }

    formatMoney(cents) {
        if (window.theme?.currency?.formatMoney) {
            return window.theme.currency.formatMoney(cents);
        }

        const format = (opt, def) => (typeof opt === 'undefined' ? def : opt);
        const formatWithDelimiters = (number, precision, thousands, decimal) => {
            precision = format(precision, 2);
            thousands = format(thousands, ',');
            decimal = format(decimal, '.');

            if (isNaN(number) || number == null) return 0;

            number = (number / 100.0).toFixed(precision);

            const parts = number.split('.');
            const dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
            const centsAmount = parts[1] ? decimal + parts[1] : '';

            return dollarsAmount + centsAmount;
        };

        return '$' + formatWithDelimiters(cents, 2, ',', '.');
    }
}

if (!customElements.get('product-bundle-component')) {
    customElements.define('product-bundle-component', ProductBundleComponent);
}
