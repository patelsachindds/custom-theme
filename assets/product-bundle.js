/**
 * Product Bundle Component
 * Manages checking/unchecking bundle items, calculating totals, and adding multiple items to the cart using Shopify AJAX API.
 */

class ProductBundleComponent extends HTMLElement {
    constructor() {
        super();
        this.items = Array.from(this.querySelectorAll('.product-bundle__item'));
        this.checkboxes = Array.from(this.querySelectorAll('.product-bundle__checkbox'));
        this.totalPriceElement = this.querySelector('[data-bundle-total]');
        this.submitButton = this.querySelector('.product-bundle__submit');
        this.errorElement = this.querySelector('.product-bundle__error');
        this.moneyFormat = window.theme?.moneyFormat || '${{amount}}'; // Fallback

        this.init();
    }

    init() {
        this.calculateTotal();

        this.checkboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => this.calculateTotal());
        });

        if (this.submitButton) {
            this.submitButton.addEventListener('click', (e) => this.addToCart(e));
        }
    }

    calculateTotal() {
        let total = 0;
        let selectedCount = 0;

        this.items.forEach((item) => {
            const checkbox = item.querySelector('.product-bundle__checkbox');
            if (checkbox && checkbox.checked) {
                const price = parseInt(item.dataset.price, 10);
                if (!isNaN(price)) {
                    total += price;
                    selectedCount++;
                }
            }
        });

        if (this.totalPriceElement) {
            this.totalPriceElement.innerHTML = this.formatMoney(total, this.moneyFormat);
        }

        if (this.submitButton) {
            if (selectedCount === 0) {
                this.submitButton.disabled = true;
                this.submitButton.textContent = 'Select items to add';
            } else {
                this.submitButton.disabled = false;
                this.submitButton.textContent = `Add ${selectedCount} item${selectedCount > 1 ? 's' : ''} to Cart`;
            }
        }
    }

    async addToCart(event) {
        event.preventDefault();
        if (this.submitButton.disabled) return;

        this.errorElement.classList.add('hidden');
        const originalText = this.submitButton.textContent;
        this.submitButton.disabled = true;
        this.submitButton.innerHTML = '<span class="loading-spinner"></span> Adding...';

        const itemsToAdd = [];
        const bundleId = Date.now().toString(); // Shared ID for all items in this bundle add action
        const mainVariantId = parseInt(this.dataset.mainVariantId, 10);

        this.items.forEach((item) => {
            const checkbox = item.querySelector('.product-bundle__checkbox');
            if (checkbox && checkbox.checked) {
                const variantId = parseInt(item.dataset.variantId, 10);
                const role = (variantId === mainVariantId) ? 'main' : 'member';

                itemsToAdd.push({
                    id: variantId,
                    quantity: 1,
                    properties: {
                        '_bundleId': bundleId,
                        '_bundleRole': role
                    }
                });
            }
        });

        if (itemsToAdd.length === 0) {
            this.submitButton.disabled = false;
            this.submitButton.textContent = originalText;
            return;
        }

        try {
            const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items: itemsToAdd })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.description || 'Error adding to cart');
            }

            // Success! 
            this.submitButton.disabled = false;
            this.submitButton.textContent = originalText;


            // Trigger theme cart updates globally
            document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: { source: 'product-bundle' } }));
            document.documentElement.dispatchEvent(new CustomEvent('cart:change', { bubbles: true }));
            window.dispatchEvent(new Event('cart:updated')); // Keep as secondary fallback for non-theme listeners

        } catch (error) {
            console.error('Error adding bundle to cart:', error);
            this.errorElement.textContent = error.message;
            this.errorElement.classList.remove('hidden');
            this.submitButton.disabled = false;
            this.submitButton.textContent = originalText;
        }
    }

    // Basic money formatter copied from liquid/standard JS to act as safe fallback
    formatMoney(cents, format) {
        if (typeof cents == 'string') { cents = cents.replace('.', ''); }
        let value = '';
        const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
        const formatString = format || '${{amount}}';

        function defaultOption(opt, def) { return (typeof opt == 'undefined' ? def : opt); }

        function formatWithDelimiters(number, precision, thousands, decimal) {
            precision = defaultOption(precision, 2);
            thousands = defaultOption(thousands, ',');
            decimal = defaultOption(decimal, '.');
            if (isNaN(number) || number == null) { return 0; }
            number = (number / 100.0).toFixed(precision);
            const parts = number.split('.'),
                dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands),
                cents = parts[1] ? (decimal + parts[1]) : '';
            return dollars + cents;
        }

        switch (formatString.match(placeholderRegex)[1]) {
            case 'amount': value = formatWithDelimiters(cents, 2); break;
            case 'amount_no_decimals': value = formatWithDelimiters(cents, 0); break;
            case 'amount_with_comma_separator': value = formatWithDelimiters(cents, 2, '.', ','); break;
            case 'amount_no_decimals_with_comma_separator': value = formatWithDelimiters(cents, 0, '.', ','); break;
        }
        return formatString.replace(placeholderRegex, value);
    }
}

customElements.define('product-bundle-component', ProductBundleComponent);
