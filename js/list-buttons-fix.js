/**
 * List Buttons Fix - Kiegészítő javítás a csillagozott és repo listák képbetöltéséhez
 */

// Biztosítjuk, hogy csak egyszer fusson le
if (typeof window.listButtonsFixLoaded === 'undefined') {
    window.listButtonsFixLoaded = true;
    
    console.log('List Buttons Fix betöltve - fejlesztői és repository listák javítása');

    // Fejlett repo lista gomb figyelés
    function setupRepoButtonListeners() {
        console.log('Repo és csillagozott lista gombok figyelése inicializálva');
        
        // Mindkét típusú gombot figyeljük: View Starred és Repos
        document.addEventListener('click', function(event) {
            // Debug log az eseményről
            console.log('Kattintás esemény:', 
                       'elem:', event.target.tagName, 
                       'class:', event.target.className, 
                       'text:', event.target.textContent?.trim().substring(0, 30));
            
            let triggerReload = false;
            let buttonType = '';
            
            // Csillagozott lista gomb ellenőrzése - több módon is
            if (event.target.textContent?.includes('View Developer Starred List') || 
                (event.target.closest('button') && event.target.closest('button').textContent?.includes('View Developer Starred List')) ||
                event.target.classList?.contains('btn-view-starred') || 
                event.target.getAttribute?.('data-action') === 'view-starred' ||
                event.target.closest?.('.btn-view-starred') || 
                event.target.closest?.('[data-action="view-starred"]')) {
                
                triggerReload = true;
                buttonType = 'csillagozott';
            }
            
            // Repos gomb ellenőrzése - több módon is
            else if (event.target.textContent?.includes('Repos') || 
                    (event.target.closest('button') && event.target.closest('button').textContent?.includes('Repos')) ||
                    event.target.classList?.contains('btn-view-repos') || 
                    event.target.getAttribute?.('data-action') === 'view-repos' ||
                    event.target.closest?.('.btn-view-repos') || 
                    event.target.closest?.('[data-action="view-repos"]')) {
                
                triggerReload = true;
                buttonType = 'repos';
            }
            
            // Ha bármelyik gombot megtaláltuk, indítjuk a képbetöltés ellenőrzést
            if (triggerReload) {
                console.log(`${buttonType} lista gombra kattintás észlelve - képbetöltés ellenőrzés indítása...`);
                
                // Több kísérlet különböző késleltetéssel a biztos működés érdekében
                const delays = [100, 300, 500, 1000, 2000]; // ms
                
                delays.forEach(delay => {
                    setTimeout(() => {
                        console.log(`${buttonType} lista képbetöltés ellenőrzés: ${delay}ms késleltetés után`);
                        if (typeof window.recheckRepositoryImages === 'function') {
                            window.recheckRepositoryImages();
                        } else {
                            console.error('recheckRepositoryImages függvény nem elérhető!');
                        }
                    }, delay);
                });
            }
        });
        
        // Konténer változások figyelése - MutationObserver
        const containerObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Ellenőrizzük, hogy vannak-e releváns konténerek vagy képek
                    let hasRelevantContent = false;
                    
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Elem csomópont
                            // Ha tartalmaz repo képet vagy konténert
                            if (node.querySelectorAll) {
                                const hasRepoImages = node.querySelectorAll('.repo-image').length > 0;
                                const hasContainer = 
                                    node.querySelectorAll('.starred-list-container').length > 0 || 
                                    node.querySelectorAll('.dev-repositories-container').length > 0 ||
                                    node.querySelectorAll('.repos-container').length > 0;
                                
                                if (hasRepoImages || hasContainer) {
                                    hasRelevantContent = true;
                                }
                                
                                // Ha maga a csomópont konténer
                                if (node.classList && (
                                    node.classList.contains('starred-list-container') || 
                                    node.classList.contains('dev-repositories-container') ||
                                    node.classList.contains('repos-container'))) {
                                    
                                    hasRelevantContent = true;
                                }
                            }
                        }
                    });
                    
                    // Ha találtunk releváns tartalmat, ellenőrizzük a képeket
                    if (hasRelevantContent) {
                        console.log('Releváns tartalom változás észlelve - képek újraellenőrzése...');
                        
                        // Késleltetett ellenőrzés a DOM frissítés után
                        setTimeout(() => {
                            if (typeof window.recheckRepositoryImages === 'function') {
                                window.recheckRepositoryImages();
                            }
                        }, 300);
                    }
                }
            });
        });
        
        // Figyeljük a body-t és a konténereket is
        containerObserver.observe(document.body, { childList: true, subtree: true });
        
        // Időzített periodikus ellenőrzés a biztonság kedvéért
        setInterval(() => {
            // Ellenőrizzük, hogy van-e látható repository kép konténer
            const hasVisibleContainers = 
                document.querySelectorAll('.starred-list-container').length > 0 || 
                document.querySelectorAll('.dev-repositories-container').length > 0 ||
                document.querySelectorAll('.repos-container').length > 0;
                
            if (hasVisibleContainers) {
                console.log('Időzített képellenőrzés - látható konténerek miatt');
                if (typeof window.recheckRepositoryImages === 'function') {
                    window.recheckRepositoryImages();
                }
            }
        }, 5000); // 5 másodpercenként
    }
    
    // Exportáljuk a függvényt, hogy más scriptek is használhassák
    window.setupRepoButtonListeners = setupRepoButtonListeners;
    
    // Automatikusan indítsuk el, ha az eredeti script már betöltött
    if (typeof window.recheckRepositoryImages === 'function') {
        setupRepoButtonListeners();
    } else {
        // Ha az eredeti script még nem töltött be, várjunk az eseményre
        document.addEventListener('imageLoadFixLoaded', function() {
            setupRepoButtonListeners();
        });
        
        // Biztonsági időzítő, ha az esemény valamiért nem érkezne meg
        setTimeout(() => {
            if (typeof window.recheckRepositoryImages === 'function' && !window.listButtonFixInitialized) {
                console.log('Biztonsági időzítő bekapcsolta a lista gomb figyelést');
                setupRepoButtonListeners();
            }
        }, 2000);
    }
    
    console.log('List Buttons Fix konfigurálva és készen áll');
}
