/**
 * Képbetöltő modul a keresési találatok kártyáinak képeinek megbízhatóbb betöltéséhez.
 */

class ImageLoader {
    /**
     * Inicializálja a képbetöltőt
     * @param {HTMLElement} imgElement - A kép elem, amit betöltünk
     * @param {string} imageUrl - A betöltendő kép URL-je
     * @param {string} altText - Alternatív szöveg a képhez
     */
    constructor(imgElement, imageUrl, altText) {
        this.imgElement = imgElement;
        this.imageUrl = imageUrl;
        this.altText = altText || '';
        this.maxRetries = 3; // Maximum próbálkozások száma egy adott kísérletben
        this.retryDelay = 500; // Kezdeti késleltetés ms-ban
        this.maxRetryDelay = 3000; // Maximális késleltetés a kísérletek között
        this.retryCount = 0;
        this.attemptCount = 0;
        this.maxTotalAttempts = 6; // Összesen 6 próbálkozás (3 azonnali + 3 késleltetett)
        this.isLoading = false;
        
        // Egyedi azonosító a naplózáshoz
        this.id = 'img-' + Math.random().toString(36).substr(2, 9);
        
        // Beállítjuk az alapértelmezett attribútumokat
        this.imgElement.alt = this.altText;
        this.imgElement.classList.add('lazy-loading');
        
        console.log(`[${this.id}] ImageLoader initialized for ${imageUrl}`);
    }

    /**
     * Elindítja a kép betöltését
     */
    load() {
        if (this.isLoading) {
            console.log(`[${this.id}] Load already in progress, skipping...`);
            return;
        }
        
        this.isLoading = true;
        this.attemptCount++;
        
        console.log(`[${this.id}] Starting load attempt ${this.attemptCount} (retry ${this.retryCount})`);
        
        // Beállítjuk a betöltés állapotát
        this.imgElement.classList.add('lazy-loading');
        this.imgElement.classList.remove('lazy-loaded', 'lazy-failed');
        
        // Létrehozunk egy új Image objektumot a teszteléshez
        const tempImg = new Image();
        
        // Ha sikerült betölteni a képet
        tempImg.onload = () => {
            console.log(`[${this.id}] Image loaded successfully`);
            this.handleImageLoad(tempImg);
        };
        
        // Ha hiba történt a kép betöltésekor
        tempImg.onerror = (error) => {
            console.error(`[${this.id}] Error loading image:`, error);
            this.handleImageError();
        };
        
        // Beállítjuk a forrást, ami elindítja a betöltést
        // Használjuk a data-src attribútumot, ha az létezik, különben a közvetlen URL-t
        const srcToLoad = this.imgElement.getAttribute('data-src') || this.imageUrl;
        console.log(`[${this.id}] Loading image from:`, srcToLoad);
        tempImg.src = srcToLoad;
    }
    
    /**
     * Kezeli a sikeres képbetöltést
     * @param {HTMLImageElement} loadedImage - A betöltött kép
     */
    handleImageLoad(loadedImage) {
        console.log(`[${this.id}] Handling image load`);
        
        try {
            // Beállítjuk a képet az eredeti elemre
            this.imgElement.src = loadedImage.src;
            this.imgElement.classList.remove('lazy-loading');
            this.imgElement.classList.add('lazy-loaded');
            this.imgElement.classList.remove('lazy-failed');
            this.imgElement.style.display = 'block';
            this.isLoading = false;
            
            console.log(`[${this.id}] Image display updated`);
            
            // Töröljük a hibaüzenetet, ha létezik
            const retryButton = this.imgElement.parentNode.querySelector('.retry-load-btn');
            if (retryButton && retryButton.parentNode) {
                console.log(`[${this.id}] Removing existing retry button`);
                retryButton.parentNode.removeChild(retryButton);
            }
            
            // Esemény kiváltása a sikeres betöltésről
            const event = new Event('imageLoaded');
            this.imgElement.dispatchEvent(event);
            console.log(`[${this.id}] imageLoaded event dispatched`);
        } catch (error) {
            console.error(`[${this.id}] Error in handleImageLoad:`, error);
            this.handleImageError();
        }
    }
    
    /**
     * Kezeli a képbetöltési hibát
     */
    handleImageError() {
        this.retryCount++;
        console.log(`[${this.id}] Image load error (attempt ${this.attemptCount}, retry ${this.retryCount})`);
        
        // Ha elértük a maximális próbálkozások számát
        if (this.attemptCount >= this.maxTotalAttempts) {
            console.log(`[${this.id}] Max attempts (${this.maxTotalAttempts}) reached, showing retry button`);
            this.showRetryButton();
            return;
        }
        
        // Ha elértük az aktuális kör maximális próbálkozásait
        if (this.retryCount > this.maxRetries) {
            // Várunk egy kicsit, mielőtt újra próbálkoznánk
            const delay = this.maxRetryDelay;
            console.log(`[${this.id}] Retry ${this.retryCount} failed, waiting ${delay}ms before next attempt`);
            
            this.isLoading = false;
            
            setTimeout(() => {
                this.retryCount = 0;
                this.attemptCount++;
                this.load();
            }, delay);
        } else {
            // Kisebb késleltetéssel próbálkozunk újra
            const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
            console.log(`[${this.id}] Retry ${this.retryCount} failed, retrying in ${delay}ms`);
            
            this.isLoading = false;
            
            setTimeout(() => {
                this.load();
            }, delay);
        }
    }
    
    /**
     * Megjelenít egy gombot a kép helyén, amivel újra lehet próbálkozni a betöltéssel
     */
    showRetryButton() {
        console.log(`[${this.id}] Showing retry button`);
        
        try {
            // Ellenőrizzük, hogy már van-e gomb a kép mellett
            const existingButton = this.imgElement.parentNode.querySelector('.retry-load-btn');
            if (existingButton) {
                console.log(`[${this.id}] Retry button already exists, skipping...`);
                return; // Ha már van gomb, nem csinálunk semmit
            }
            
            console.log(`[${this.id}] Creating new retry button`);
            
            // Létrehozzuk a gombot
            const button = document.createElement('button');
            button.className = 'btn btn-sm btn-warning retry-load-btn';
            button.textContent = 'Retry Loading Image';
            button.style.width = '100%';
            button.style.padding = '10px';
            button.style.marginTop = '10px';
            
            // Eseménykezelő a gombhoz
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`[${this.id}] Retry button clicked`);
                
                // Eltávolítjuk a gombot
                if (button.parentNode) {
                    button.parentNode.removeChild(button);
                }
                
                // Megjelenítjük a képet újra
                this.imgElement.style.display = 'block';
                
                // Újraindítjuk a betöltést
                this.retryCount = 0;
                this.attemptCount = 0;
                this.load();
                
                return false;
            });
            
            // Beállítjuk a kép helyére a gombot
            if (this.imgElement.parentNode) {
                this.imgElement.parentNode.appendChild(button);
                console.log(`[${this.id}] Retry button added to DOM`);
            } else {
                console.error(`[${this.id}] Could not add retry button: parentNode is null`);
            }
            
            // Elrejtjük a képet, ha még látható lenne
            this.imgElement.style.display = 'none';
            this.imgElement.classList.add('lazy-failed');
        } catch (error) {
            console.error(`[${this.id}] Error in showRetryButton:`, error);
        } finally {
            this.isLoading = false;
        }
    }
}

/**
 * Inicializálja a képbetöltést egy adott kép elemre
 * @param {HTMLElement} imgElement - A kép elem
 * @param {string} imageUrl - A betöltendő kép URL-je
 * @param {string} altText - Alternatív szöveg a képhez
 * @returns {ImageLoader} Az inicializált képbetöltő példány
 */
function initImageLoader(imgElement, imageUrl, altText = '') {
    const loader = new ImageLoader(imgElement, imageUrl, altText);
    loader.load();
    return loader;
}

// Exportáljuk a függvényt, hogy más fájlokból is elérhető legyen
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        ImageLoader,
        initImageLoader
    };
} else {
    window.ImageLoader = ImageLoader;
    window.initImageLoader = initImageLoader;
}
