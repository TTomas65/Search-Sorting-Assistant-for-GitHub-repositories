/**
 * Section Manager
 * Kezeli a különböző szekciók megjelenítését és elrejtését
 */

// Egy helyi változat a showLoginRequiredMessage függvénynek, hogy ne függjünk más JavaScript fájloktól
function showLoginRequiredMessage() {
    // Keresési eredmények konténer létrehozása/elérése
    let projectsContainer = document.getElementById('projects-container');
    if (projectsContainer) {
        projectsContainer.style.display = 'none';
    }
    
    // Létezik-e már a search-results div
    let searchResults = document.getElementById('search-results');
    if (!searchResults) {
        searchResults = document.createElement('div');
        searchResults.id = 'search-results';
        searchResults.className = 'container mt-4';
        document.querySelector('.main-content').appendChild(searchResults);
    }
    searchResults.style.display = 'block';
    
    // Eredmények lista létrehozása/tisztítása
    let resultsList = document.getElementById('results-list');
    if (!resultsList) {
        resultsList = document.createElement('div');
        resultsList.id = 'results-list';
        resultsList.className = 'row';
        searchResults.appendChild(resultsList);
    }
    
    // Az üzenet megjelenítése a results-list-ben
    resultsList.innerHTML = `
        <div class="col-12">
            <div class="alert alert-warning" role="alert">
                <h4 class="alert-heading">Login Required</h4>
                <p>The Favorites feature is only available after you have logged in. Please sign in with GitHub to access your favorite repositories.</p>
            </div>
        </div>
    `;
    resultsList.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', function() {
    // Program indulásakor csak a keresési szekció látható
    initializeSections();
    
    // Menüpontok eseménykezelője
    document.querySelectorAll('.menu-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            switchToSection(section);
        });
    });
});

/**
 * Inicializálja a szekciókat - program indulásakor csak a keresési szekció látható
 */
function initializeSections() {
    // Kedvencek és Fejlesztők paneljeinek elrejtése
    const favoritesInfo = document.querySelector('#favorites-info').closest('.card');
    // const developersInfo = document.querySelector('#developers-info').closest('.card');
    
    if (favoritesInfo) favoritesInfo.style.display = 'none';
    // if (developersInfo) developersInfo.style.display = 'none';
    
    // Keresési vezérlők megjelenítése
    const searchControls = document.querySelector('.card.mb-4');
    if (searchControls) searchControls.style.display = 'block';
    
    // Biztosítjuk, hogy a keresési eredmények konténere látható legyen
    const projectsContainer = document.getElementById('projects-container');
    if (projectsContainer) projectsContainer.style.display = 'flex';
    
    // Biztosítjuk, hogy a legfelső info panel mindig látható legyen
    const infoPanel = document.querySelector('#search-info').closest('.card');
    if (infoPanel) infoPanel.style.display = 'block';
}

/**
 * Átvált a megadott szekcióra
 * @param {string} sectionName - A megjelenítendő szekció neve
 */
function switchToSection(sectionName) {
    // Aktív menüpont kezelése
    document.querySelectorAll('.menu-link').forEach(link => {
        if (link.getAttribute('data-section') === sectionName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // Meglévő elemek lekérése
    const searchControls = document.querySelector('.card.mb-4');
    const favoritesInfo = document.querySelector('#favorites-info')?.closest('.card'); // Biztonságosabb lekérdezés
    // const developersInfo = document.querySelector('#developers-info')?.closest('.card'); // Biztonságosabb lekérdezés
    const projectsContainer = document.getElementById('projects-container');
    const resultsList = document.getElementById('results-list'); // Új változó
    const developerListContainer = document.getElementById('developer-list-container');
    // searchResults már létezik, de resultsList azonosítóval hivatkozunk a kedvencek listájára
    const infoPanel = document.querySelector('#search-info')?.closest('.card'); // Biztonságosabb lekérdezés
    const totalResultsLabel = document.querySelector('.total-results-label'); // Közös label elem
    const totalCountSpan = document.getElementById('total-count'); // Számláló span
    const loadMoreButton = document.getElementById('load-more'); // Load More gomb (kereséshez)
    const loadMoreContainer = document.getElementById('load-more-container'); // Load More gomb konténere
    const loadMoreFavoritesButton = document.getElementById('load-more-favorites-button'); // Load More gomb (kedvencekhez)
    const loadMoreDevelopersButton = document.getElementById('load-more-developers-button'); // Load More gomb (fejlesztőkhöz)
    const weeklyLoadMoreButton = document.getElementById('weekly-load-more-button'); // Weekly Load More gomb
    const weeklyLoadMoreContainer = document.getElementById('weekly-load-more-container'); // Weekly Load More konténer
    const excelExportPanel = document.getElementById('excel-export-panel'); // Excel export panel
    const githubImportExportPanel = document.getElementById('github-import-export-panel'); // GitHub import/export panel


    // Minden konténer elrejtése alapból
    if (searchControls) searchControls.style.display = 'none';
    if (favoritesInfo) favoritesInfo.style.display = 'none';
    // if (developersInfo) developersInfo.style.display = 'none';
    if (projectsContainer) projectsContainer.style.display = 'none';
    if (resultsList) resultsList.style.display = 'none'; // resultsList elrejtése
    if (developerListContainer) {
        developerListContainer.style.display = 'none';
        // Reset a developerListVisible változót, hogy a toggleDeveloperList helyesen működjön
        if (typeof developerListVisible !== 'undefined') {
            developerListVisible = false;
        }
    }
    if (loadMoreButton) loadMoreButton.style.display = 'none'; // Load More gomb elrejtése
    if (loadMoreContainer) loadMoreContainer.style.display = 'none'; // Load More gomb konténer elrejtése
    if (loadMoreFavoritesButton) loadMoreFavoritesButton.style.display = 'none'; // Load More gomb elrejtése
    if (loadMoreDevelopersButton) loadMoreDevelopersButton.style.display = 'none'; // Load More gomb elrejtése
    if (weeklyLoadMoreButton) weeklyLoadMoreButton.style.display = 'none'; // Weekly Load More gomb elrejtése
    if (weeklyLoadMoreContainer) weeklyLoadMoreContainer.style.display = 'none'; // Weekly Load More konténer elrejtése
    if (excelExportPanel) excelExportPanel.style.display = 'none'; // Excel export panel elrejtése
    if (githubImportExportPanel) githubImportExportPanel.style.display = 'none'; // GitHub import/export panel elrejtése
    
    // Ha létezik a weeklyReposActive globális változó, állítsuk false-ra, kivéve a search szekciónál
    if (typeof window.weeklyReposActive !== 'undefined' && sectionName !== 'search') {
        window.weeklyReposActive = false;
    }

    // Keresési szövegek elrejtése
    const currentSearchText = document.getElementById('current-search-text');
    const currentSearchOptions = document.getElementById('current-search-options');
    if (currentSearchText) currentSearchText.style.display = 'none';
    if (currentSearchOptions) currentSearchOptions.style.display = 'none';

    // A kiválasztott szekció és a hozzá tartozó elemek megjelenítése
    switch(sectionName) {
        case 'search':
            if (searchControls) searchControls.style.display = 'block';
            if (projectsContainer) projectsContainer.style.display = 'flex'; // Keresési találatok
            if (currentSearchText) currentSearchText.style.display = 'block';
            if (currentSearchOptions) currentSearchOptions.style.display = 'flex';

            // Load More gomb konténer megjelenítése a keresés szekcióban
            if (loadMoreContainer) loadMoreContainer.style.display = 'flex';

            // Ellenőrizzük, hogy a Load More gomb létezik és látható-e
            if (loadMoreButton && loadMoreButton.dataset.visible === 'true') {
                loadMoreButton.style.display = 'block';
            } else if (loadMoreButton) {
                 loadMoreButton.style.display = 'none'; // Rejtsd el, ha nem látható
            }


            // Címke és számláló beállítása (a tényleges számot a keresési logika frissíti)
            if (totalResultsLabel && totalCountSpan) {
                totalResultsLabel.innerHTML = 'Total Results: <span id="total-count" class="fw-bold">0</span>';
                // A számlálót a search logika frissíti
            }
            break;

        case 'favorites':
            if (favoritesInfo) favoritesInfo.style.display = 'block';
            
            // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
            if (document.getElementById('user-info').classList.contains('d-none')) {
                // Címke beállítása 0-ra
                if (totalResultsLabel) {
                    totalResultsLabel.innerHTML = 'Category favourites: <span id="total-count" class="fw-bold">0</span>';
                }
                
                // Közvetlenül hívjuk meg a saját függvényünket
                showLoginRequiredMessage();
            } else {
                // Ha be van jelentkezve, megjelenítjük a kedvencek listáját
                if (resultsList) resultsList.style.display = 'flex'; // Kedvencek listája (flexbox elrendezés)
                
                // Automatikusan meghívjuk a kedvencek listázása gombot, ha van
                const listFavoritesButton = document.getElementById('list-favorites-button');
                if (listFavoritesButton) {
                    listFavoritesButton.click(); // Ez elindítja a loadFavorites-t, ami frissíti a countot
                } else {
                    // Ha nincs gomb, manuálisan frissítjük a számot 0-ra vagy a meglévő elemek számára
                    if (typeof updateFavoriteResultsCount === 'function') {
                       updateFavoriteResultsCount(); // Meghívjuk a favorites.js-ben definiált frissítő függvényt
                    }
                }
            }


            // Címke beállítása (a számot a favorites logika frissíti)
            if (totalResultsLabel) {
                totalResultsLabel.innerHTML = 'Category favourites: <span id="total-count" class="fw-bold">0</span>';
            }
            // Ellenőrizzük, hogy a Load More gomb létezik és látható-e
             if (loadMoreFavoritesButton && loadMoreFavoritesButton.style.display !== 'none') {
                 loadMoreFavoritesButton.style.display = 'block';
             }
             break;

        case 'favorite-developers':
            const favoriteDevelopersInfo = document.querySelector('#favorite-developers-info').closest('.card');
            if (favoriteDevelopersInfo) favoriteDevelopersInfo.style.display = 'block';
            
            // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
            if (document.getElementById('user-info').classList.contains('d-none')) {
                // Címke beállítása 0-ra ha van
                if (totalResultsLabel) {
                    totalResultsLabel.innerHTML = 'Category favourites: <span id="total-count" class="fw-bold">0</span>';
                }
                
                // Közvetlenül hívjuk meg a saját bejelentkezési üzenet függvényünket
                showLoginRequiredMessage();
            } else {
                // Reset a developerListVisible változót, hogy a toggleDeveloperList helyesen működjön
                developerListVisible = false;
                
                toggleDeveloperList(); // A lista megjelenítését/elrejtését és betöltését végző függvény hívása
            }

            // Címke és számláló beállítása (a számot a fejlesztői logika frissíti)
            if (totalResultsLabel) {
                 totalResultsLabel.innerHTML = 'Number of favorite Developers: <span id="total-count" class="fw-bold">0</span>';
                 // A tényleges számot a loadDeveloperList vagy hasonló frissíti
            }

            // Ellenőrizzük, hogy a Load More gomb létezik és látható-e
            if (loadMoreDevelopersButton && loadMoreDevelopersButton.style.display !== 'none') {
                loadMoreDevelopersButton.style.display = 'block';
            }
            break;

        case 'developers':
            // const developersInfo = document.querySelector('#developers-info').closest('.card');
            // if (developersInfo) developersInfo.style.display = 'block';
            
            // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
            if (document.getElementById('user-info').classList.contains('d-none')) {
                // Címke beállítása 0-ra ha van
                if (totalResultsLabel) {
                    totalResultsLabel.innerHTML = 'Developers: <span id="total-count" class="fw-bold">0</span>';
                }
                
                // Közvetlenül hívjuk meg a saját bejelentkezési üzenet függvényünket
                showLoginRequiredMessage();
            } else {
                if (developerListContainer) developerListContainer.style.display = 'flex'; // Fejlesztők listája (lehet 'block' is)
                toggleDeveloperList(); // A lista megjelenítését/elrejtését és betöltését végző függvény hívása

                // Címke és számláló beállítása (a számot a fejlesztői logika frissíti)
                if (totalResultsLabel) {
                    totalResultsLabel.innerHTML = 'Number of favorite Developers: <span id="total-count" class="fw-bold">0</span>';
                    // A tényleges számot a loadDeveloperList vagy hasonló frissíti
                }

                // Ellenőrizzük, hogy a Load More gomb létezik és látható-e
                if (loadMoreDevelopersButton && loadMoreDevelopersButton.style.display !== 'none') {
                    loadMoreDevelopersButton.style.display = 'block';
                }
            }
            break;

        case 'excel-export':
            if (excelExportPanel) excelExportPanel.style.display = 'block';
            
            // Címke és számláló beállítása
            if (totalResultsLabel) {
                totalResultsLabel.innerHTML = 'Excel Export: <span id="total-count" class="fw-bold">Options</span>';
            }
            break;

        case 'import-export':
            if (githubImportExportPanel) githubImportExportPanel.style.display = 'block';
            
            // Címke és számláló beállítása
            if (totalResultsLabel) {
                totalResultsLabel.innerHTML = 'GitHub Import: <span id="total-count" class="fw-bold">Options</span>';
            }
            break;

        default:
            // Alapértelmezetten a keresési elemeket jelenítjük meg
            if (searchControls) searchControls.style.display = 'block';
            if (projectsContainer) projectsContainer.style.display = 'flex';
            if (loadMoreButton && loadMoreButton.dataset.visible === 'true') { // Load More itt is kellhet
                 loadMoreButton.style.display = 'block';
            }
    }

    // A legfelső info panel mindig látható
    if (infoPanel) infoPanel.style.display = 'block';
}
