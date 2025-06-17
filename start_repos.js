/**
 * Start Repository Loader
 * Ez a script kezeli a kezdeti repository ajánlatok betöltését és megjelenítését
 * az alkalmazás indításakor
 */

// Globális változó a betöltött repository-k tárolására
let startRepos = [];
let currentStartRepoIndex = 0;
let startProcessingPaused = false;
let startBatchSize = 5; // Egyszerre csak 5 repository-t dolgozunk fel
let startDisplayLimit = 30; // Egyszerre csak 30 repository-t jelenítünk meg
let startDisplayedRepos = 0; // Eddig megjelenített repository-k száma
// Globálisan elérhető változó a kezdeti ajánlatok aktív állapotának jelzésére
window.startReposActive = false;

/**
 * Start repository-k betöltése a szerverről
 */
function loadStartRepos() {
    // Beállítjuk, hogy a kezdeti ajánlatok aktívak (globálisan)
    window.startReposActive = true;
    
    // Alaphelyzetbe állítjuk
    // Betöltés előtt töröljük a korábbi keresési eredményeket
    clearStartSearchResults();
    
    // Visszaállítjuk a feldolgozási állapotot
    currentStartRepoIndex = 0;
    startDisplayedRepos = 0;
    startProcessingPaused = false;
    
    // Számláló nullázása
    const totalCountElement = document.getElementById('total-count');
    if (totalCountElement) {
        totalCountElement.textContent = '0';
    }
    
    // Keresőmező szövegének beállítása
    const searchTitleElement = document.getElementById('current-search-text');
    if (searchTitleElement) {
        searchTitleElement.textContent = 'Start repositories';
    }
    
    // Elrejtjük a normál keresés "LOAD MORE" gombját
    hideNormalLoadMoreButton();
    
    // Repository-k lekérése a szerverről
    fetch('get_start_repos.php')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP hiba: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.status === 'success' && Array.isArray(data.repos)) {
                // Tároljuk a repository-kat
                startRepos = data.repos;
                
                // Frissítjük a teljes repository-k számát
                const totalCountElement = document.getElementById('total-count');
                if (totalCountElement) {
                    // Fixált érték: 12 repository
                    totalCountElement.textContent = '0';
                }
                
                // Elkezdjük a repository-k feldolgozását
                processStartReposBatch();
            } else {
                throw new Error(data.message || 'Ismeretlen hiba történt a repository-k betöltése során');
            }
        })
        .catch(error => {
            console.error('Hiba a kezdeti repository-k betöltése során:', error);
            showError(error.message);
        });
}

/**
 * Start repository-k feldolgozása kötegekben
 * Ez a megközelítés csökkenti a GitHub API rate limit problémákat
 */
function processStartReposBatch() {
    if (startProcessingPaused || currentStartRepoIndex >= startRepos.length) {
        return;
    }
    
    // Meghatározzuk a köteg határait
    const endIndex = Math.min(currentStartRepoIndex + startBatchSize, startRepos.length);
    
    // Megjelenítjük a betöltés jelzőt
    showLoadingIndicator();
    
    // Elkezdjük a köteg feldolgozását
    processNextStartBatchItem(currentStartRepoIndex, endIndex);
}

/**
 * Köteg következő elemének feldolgozása
 * @param {number} currentIndex - A jelenlegi elem indexe
 * @param {number} endIndex - A köteg utolsó elemének indexe + 1
 */
function processNextStartBatchItem(currentIndex, endIndex) {
    // Ha elértük a köteg végét vagy a feldolgozás szünetel, kilépünk vagy új köteget indítunk
    if (currentIndex >= endIndex || startProcessingPaused) {
        // Elrejtjük a betöltés jelzőt
        hideLoadingIndicator();
        
        // Ha még vannak feldolgozatlan repository-k, indítunk egy új köteget
        if (currentIndex < startRepos.length && !startProcessingPaused) {
            setTimeout(() => {
                processStartReposBatch();
            }, 500);
        }
        return;
    }
    
    // Ha elértük a megjelenítési limitet, megállunk
    if (startDisplayedRepos >= startDisplayLimit) {
        // Elrejtjük a betöltés jelzőt
        hideLoadingIndicator();
        return;
    }
    
    // Lekérjük a következő repository URL-t
    const repoUrl = startRepos[currentIndex];
    
    // Lekérjük a repository adatait
    fetchRepositoryData(repoUrl)
        .then(repoData => {
            // Megjelenítjük a repository-t
            if (repoData) {
                displayRepositoryInResults(repoData);
                startDisplayedRepos++;
            }
            
            // Frissítjük az indexet
            currentStartRepoIndex = currentIndex + 1;
            
            // Folytatjuk a következő elemmel
            setTimeout(() => {
                processNextStartBatchItem(currentStartRepoIndex, endIndex);
            }, 100);
        })
        .catch(error => {
            console.error(`Hiba a repository feldolgozása során: ${repoUrl}`, error);
            
            // Ha rate limit hiba történt, megjelenítjük a hibát és szüneteltetjük a feldolgozást
            if (error.message.includes('API rate limit exceeded')) {
                showRateLimitError();
                startProcessingPaused = true;
            }
            
            // Frissítjük az indexet és folytatjuk a következő elemmel
            currentStartRepoIndex = currentIndex + 1;
            setTimeout(() => {
                processNextStartBatchItem(currentStartRepoIndex, endIndex);
            }, 100);
        });
}

/**
 * Repository adatok lekérése a GitHub API-n keresztül
 * @param {string} repoUrl - A repository URL-je (pl. https://github.com/username/repo)
 * @returns {Promise} - Promise, ami a repository adatok feldolgozása után teljesül
 */
function fetchRepositoryData(repoUrl) {
    // Ellenőrizzük, hogy érvényes GitHub URL-e
    if (!repoUrl.startsWith('https://github.com/')) {
        return Promise.reject(new Error('Invalid GitHub repository URL'));
    }
    
    // Repository adatok kinyerése az URL-ből
    const parts = repoUrl.replace('https://github.com/', '').split('/');
    if (parts.length < 2) {
        return Promise.reject(new Error('Invalid GitHub repository URL format'));
    }
    
    const owner = parts[0];
    const repo = parts[1];
    
    // Repository adatok lekérése a GitHub API-n keresztül
    return fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: getHeaders()
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('API rate limit exceeded');
            } else if (response.status === 404) {
                throw new Error(`Repository not found: ${owner}/${repo}`);
            } else {
                throw new Error(`GitHub API error: ${response.status}`);
            }
        }
        return response.json();
    });
}

/**
 * Keresési eredmények törlése
 */
function clearStartSearchResults() {
    // Projektek konténer megjelenítése
    const projectsContainer = document.getElementById('projects-container');
    if (projectsContainer) {
        projectsContainer.style.display = 'flex';
        projectsContainer.className = 'row row-cols-1 row-cols-md-3 g-4';
        projectsContainer.innerHTML = '';
    }
    
    // Kedvencek konténer elrejtése
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
        searchResults.style.display = 'none';
        const resultsList = document.getElementById('results-list');
        if (resultsList) {
            resultsList.style.display = 'none';
        }
    }
    
    // Keresési elemek megjelenítése
    document.getElementById('current-search-text').style.display = 'block';
    document.getElementById('current-search-options').style.display = 'block';
}

/**
 * Repository megjelenítése a keresési eredmények között
 * @param {Object} repoData - A GitHub API-tól kapott repository adatok
 */
function displayRepositoryInResults(repoData) {
    // Létrehozzuk a kártyát a repository-hoz
    createProjectCard(repoData)
        .then(card => {
            // Hozzáadjuk a kártyát a projektek konténeréhez
            const projectsContainer = document.getElementById('projects-container');
            if (projectsContainer) {
                projectsContainer.appendChild(card);
            }
        })
        .catch(error => {
            console.error('Hiba a repository kártya létrehozása során:', error);
        });
}

// A weekly_repos.js fájlból átvett segédfüggvények
// Ezeket újra implementáljuk, hogy ne legyen függőség a weekly_repos.js fájltól

/**
 * Betöltés jelző megjelenítése
 */
function showLoadingIndicator() {
    // Ellenőrizzük, hogy létezik-e már a betöltés jelző
    let loadingIndicator = document.getElementById('loading-indicator');
    
    // Ha nem létezik, létrehozzuk
    if (!loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="spinner-border text-warning" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <span class="ms-2">Loading repositories...</span>
        `;
        
        // Hozzáadjuk a dokumentumhoz
        document.body.appendChild(loadingIndicator);
    }
    
    // Megjelenítjük a betöltés jelzőt
    loadingIndicator.style.display = 'flex';
}

/**
 * Betöltés jelző elrejtése
 */
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Rate limit hiba megjelenítése és folytatás gomb létrehozása
 */
function showRateLimitError() {
    // Ellenőrizzük, hogy létezik-e már a rate limit hiba
    let rateLimitError = document.getElementById('rate-limit-error');
    
    // Ha nem létezik, létrehozzuk
    if (!rateLimitError) {
        rateLimitError = document.createElement('div');
        rateLimitError.id = 'rate-limit-error';
        rateLimitError.className = 'alert alert-warning';
        rateLimitError.innerHTML = `
            <h4 class="alert-heading">GitHub API Rate Limit Exceeded</h4>
            <p>The GitHub API rate limit has been reached. Please wait a few minutes and try again.</p>
            <hr>
            <p class="mb-0">
                <button id="continue-loading" class="btn btn-warning">Continue Loading</button>
            </p>
        `;
        
        // Hozzáadjuk a dokumentumhoz
        const projectsContainer = document.getElementById('projects-container');
        if (projectsContainer) {
            projectsContainer.parentNode.insertBefore(rateLimitError, projectsContainer);
        } else {
            document.body.appendChild(rateLimitError);
        }
        
        // Eseménykezelő a folytatás gombhoz
        const continueButton = document.getElementById('continue-loading');
        if (continueButton) {
            continueButton.addEventListener('click', () => {
                // Elrejtjük a rate limit hibát
                rateLimitError.style.display = 'none';
                
                // Folytatjuk a feldolgozást
                startProcessingPaused = false;
                processStartReposBatch();
            });
        }
    }
    
    // Megjelenítjük a rate limit hibát
    rateLimitError.style.display = 'block';
}

/**
 * Hibaüzenet megjelenítése
 * @param {string} message - A megjelenítendő hibaüzenet
 */
function showError(message) {
    // Ellenőrizzük, hogy létezik-e már a hibaüzenet
    let errorMessage = document.getElementById('error-message');
    
    // Ha nem létezik, létrehozzuk
    if (!errorMessage) {
        errorMessage = document.createElement('div');
        errorMessage.id = 'error-message';
        errorMessage.className = 'alert alert-danger';
    }
    
    // Beállítjuk a hibaüzenetet
    errorMessage.innerHTML = `
        <h4 class="alert-heading">Error</h4>
        <p>${message}</p>
    `;
    
    // Hozzáadjuk a dokumentumhoz
    const projectsContainer = document.getElementById('projects-container');
    if (projectsContainer) {
        projectsContainer.parentNode.insertBefore(errorMessage, projectsContainer);
    } else {
        document.body.appendChild(errorMessage);
    }
    
    // Megjelenítjük a hibaüzenetet
    errorMessage.style.display = 'block';
}

/**
 * Normál keresés "Load More" gombjának elrejtése
 */
function hideNormalLoadMoreButton() {
    const loadMoreButton = document.getElementById('load-more');
    if (loadMoreButton) {
        loadMoreButton.style.display = 'none';
    }
    
    const loadMoreContainer = document.getElementById('load-more-container');
    if (loadMoreContainer) {
        loadMoreContainer.style.display = 'none';
    }
}

// Az alkalmazás indításakor NEM töltjük be itt a start repository-kat,
// mert a script.js már meghívja a loadStartRepos() függvényt
// document.addEventListener('DOMContentLoaded', () => {
//     // Start repository-k betöltése
//     loadStartRepos();
// });
