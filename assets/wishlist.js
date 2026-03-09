/**
 * Wishlist Button Component
 * Handles adding/removing products to/from a localStorage wishlist.
 */

class WishlistButton extends HTMLElement {
  constructor() {
    super();
    this.storageKey = 'theme_wishlist';
    this.productId = this.dataset.productId;
    this.productHandle = this.dataset.productHandle;
    
    // Fallbacks just in case
    if (!this.productId && !this.productHandle) return;
    
    this.button = this.querySelector('button');
    this.iconOutline = this.querySelector('.icon-wishlist-outline');
    this.iconSolid = this.querySelector('.icon-wishlist-solid');
    
    this.boundOnClick = this.onClick.bind(this);
    this.boundOnStorage = this.onStorage.bind(this);
    
    this.init();
  }

  connectedCallback() {
    if (!this.button) return;
    this.button.addEventListener('click', this.boundOnClick);
    // Listen for storage changes across tabs or from other buttons on the page
    window.addEventListener('wishlist:updated', this.boundOnStorage);
  }

  disconnectedCallback() {
    if (!this.button) return;
    this.button.removeEventListener('click', this.boundOnClick);
    window.removeEventListener('wishlist:updated', this.boundOnStorage);
  }

  init() {
    const list = this.getWishlist();
    if (this.isInWishlist(list)) {
      this.setActiveState(true);
    } else {
      this.setActiveState(false);
    }
  }

  onClick(event) {
    event.preventDefault();
    event.stopPropagation(); // Prevent card clicks if in a collection grid
    
    let list = this.getWishlist();
    const isInList = this.isInWishlist(list);
    
    if (isInList) {
      // Remove
      list = list.filter(item => item.id !== this.productId);
      this.setActiveState(false);
    } else {
      // Add
      list.push({
        id: this.productId,
        handle: this.productHandle
      });
      this.setActiveState(true);
      this.triggerAnimation();
    }
    
    this.setWishlist(list);
    
    // Dispatch custom event so other buttons can update immediately
    window.dispatchEvent(new CustomEvent('wishlist:updated', {
      detail: { list: list }
    }));
  }

  onStorage(event) {
    const list = event.detail ? event.detail.list : this.getWishlist();
    if (this.isInWishlist(list)) {
      this.setActiveState(true);
    } else {
      this.setActiveState(false);
    }
  }

  getWishlist() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading wishlist from storage:', e);
      return [];
    }
  }

  setWishlist(list) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(list));
    } catch (e) {
      console.error('Error writing wishlist to storage:', e);
    }
  }

  isInWishlist(list) {
    return list.some(item => item.id === this.productId);
  }

  setActiveState(isActive) {
    if (isActive) {
      this.setAttribute('data-active', 'true');
      if (this.iconOutline) this.iconOutline.classList.add('hidden');
      if (this.iconSolid) this.iconSolid.classList.remove('hidden');
      this.button.setAttribute('aria-pressed', 'true');
      this.button.setAttribute('aria-label', 'Remove from wishlist');
    } else {
      this.setAttribute('data-active', 'false');
      if (this.iconOutline) this.iconOutline.classList.remove('hidden');
      if (this.iconSolid) this.iconSolid.classList.add('hidden');
      this.button.setAttribute('aria-pressed', 'false');
      this.button.setAttribute('aria-label', 'Add to wishlist');
    }
  }
  
  triggerAnimation() {
    this.iconSolid.style.transform = 'scale(1.2)';
    setTimeout(() => {
      this.iconSolid.style.transform = 'scale(1)';
    }, 200);
  }
}

customElements.define('wishlist-button', WishlistButton);
