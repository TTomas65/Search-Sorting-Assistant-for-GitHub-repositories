/**
 * Weekly Repository Offer funkció
 * Ez a script kezeli a heti repository ajánlatok betöltését és megjelenítését
 */

// Globális változó a betöltött repository-k tárolására
let weeklyRepos = [];
let currentWeeklyRepoIndex = 0;
let processingPaused = false;
let batchSize = 5; // Egyszerre csak 5 repository-t dolgozunk fel
let displayLimit = 30; // Egyszerre csak 30 repository-t jelenítünk meg
let displayedRepos = 0; // Eddig megjelenített repository-k száma
// Globálisan elérhető változó a heti ajánlatok aktív állapotának jelzésére
window.weeklyReposActive = false;

/**
 * Weekly repository-k betöltése a szerverről
 * @param {boolean} isLoadMore - Ha true, akkor a "LOAD MORE" gombra kattintva hívtuk meg
 */
function loadWeeklyRepos(isLoadMore = false) {
    // Beállítjuk, hogy a heti ajánlatok aktívak (globálisan)
    window.weeklyReposActive = true;
    
    // Kikapcsoljuk a start repos aktív állapotát, ha az aktív volt
    if (window.startReposActive !== undefined) {
        window.startReposActive = false;
    }
    
    // Ha nem "LOAD MORE" gombra kattintottunk, akkor alaphelyzetbe állítjuk
    if (!isLoadMore) {
        // Betöltés előtt töröljük a korábbi keresési eredményeket
        clearSearchResults();
        
        // Visszaállítjuk a feldolgozási állapotot
        currentWeeklyRepoIndex = 0;
        displayedRepos = 0;
        processingPaused = false;
        
        // Számláló nullázása
        const totalCountElement = document.getElementById('total-count');
        if (totalCountElement) {
            totalCountElement.textContent = '0';
        }
        
        // Keresőmező szövegének beállítása
        const searchTitleElement = document.getElementById('current-search-text');
        if (searchTitleElement) {
            searchTitleElement.textContent = 'Weekly repository offer';
        }
        
        // Custom keresőmező szövegének beállítása
        const customSearchInput = document.getElementById('custom-search');
        if (customSearchInput) {
            customSearchInput.value = 'Weekly repository offer';
        }
        
        // Custom keresés kapcsoló bekapcsolása
        const customSearchToggle = document.getElementById('custom-search-toggle');
        if (customSearchToggle) {
            customSearchToggle.checked = true;
            
            // Esemény kiváltása a UI frissítéséhez
            const event = new Event('change');
            customSearchToggle.dispatchEvent(event);
        }
        
        // Elrejtjük a normál keresés "LOAD MORE" gombját
        hideNormalLoadMoreButton();
    }
    
    // "Load More" gomb betöltési állapotba állítása
    setLoadMoreButtonLoading(true);
    
    // Megjegyzés: A külön betöltésjelzőt már nem használjuk, csak a gombon jelenik meg az állapot
    
    // Repository-k lekérése a szerverről
    fetch('get_weekly_repos.php')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP hiba: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.status === 'success' && Array.isArray(data.repos)) {
                // Tároljuk a repository-kat
                weeklyRepos = data.repos;
                
                // Frissítjük a teljes repository-k számát
                const totalCountElement = document.getElementById('total-count');
                if (totalCountElement) {
                    totalCountElement.textContent = weeklyRepos.length.toString();
                }
                
                // Elkezdjük a repository-k feldolgozását
                processWeeklyReposBatch();
                
                // "Load More" gomb kezelése
                updateLoadMoreButton();
            } else {
                throw new Error(data.message || 'Ismeretlen hiba történt a repository-k betöltése során');
            }
        })
        .catch(error => {
            console.error('Hiba a heti repository-k betöltése során:', error);
            hideLoadingIndicator();
            showError('Nem sikerült betölteni a heti repository ajánlatokat: ' + error.message);
        });
}

/**
 * Weekly repository-k feldolgozása kötegekben
 * Ez a megközelítés csökkenti a GitHub API rate limit problémákat
 */
function processWeeklyReposBatch() {
    // Ellenőrizzük, hogy a heti ajánlatok még aktívak-e
    if (!window.weeklyReposActive) {
        console.log('Heti ajánlatok feldolgozása leállítva, mert már nem aktív.');
        setLoadMoreButtonLoading(false);
        return;
    }
    
    if (processingPaused) {
        console.log('Repository feldolgozás szüneteltetve. Kattintson a "Continue" gombra a folytatáshoz.');
        return;
    }
    
    // Ellenőrizzük, hogy van-e még feldolgozandó repository
    if (currentWeeklyRepoIndex >= weeklyRepos.length) {
        setLoadMoreButtonLoading(false);
        return;
    }
    
    // Ellenőrizzük, hogy elértük-e a megjelenítési limitet
    if (displayedRepos >= displayLimit) {
        setLoadMoreButtonLoading(false);
        return;
    }
    
    // Meghatározzuk a jelenlegi köteg végét
    const endIndex = Math.min(currentWeeklyRepoIndex + batchSize, weeklyRepos.length);
    
    // Feldolgozzuk a jelenlegi köteget
    processNextBatchItem(currentWeeklyRepoIndex, endIndex);
}

/**
 * Köteg következő elemének feldolgozása
 * @param {number} currentIndex - A jelenlegi elem indexe
 * @param {number} endIndex - A köteg utolsó elemének indexe + 1
 */
function processNextBatchItem(currentIndex, endIndex) {
    // Ellenőrizzük, hogy a heti ajánlatok még aktívak-e
    if (!window.weeklyReposActive) {
        console.log('Heti ajánlatok feldolgozása leállítva, mert már nem aktív.');
        setLoadMoreButtonLoading(false);
        return;
    }
    
    if (processingPaused || currentIndex >= endIndex) {
        // Ha a feldolgozás szünetel vagy elértük a köteg végét
        if (currentIndex >= weeklyRepos.length) {
            // Minden repository feldolgozva
            // Frissítjük a "Load More" gombot normál állapotba, mivel nincs több betöltendő elem
            setLoadMoreButtonLoading(false);
            updateLoadMoreButton();
        } else if (displayedRepos >= displayLimit) {
            // Elértük a megjelenítési limitet
            // Frissítjük a "Load More" gombot normál állapotba, mivel a betöltés megállt
            setLoadMoreButtonLoading(false);
            updateLoadMoreButton();
        } else if (!processingPaused) {
            // Következő köteg feldolgozása 0.1 másodperc múlva
            currentWeeklyRepoIndex = currentIndex;
            setTimeout(processWeeklyReposBatch, 100);
        }
        return;
    }
    
    // Ellenőrizzük, hogy elértük-e a megjelenítési limitet
    if (displayedRepos >= displayLimit) {
        currentWeeklyRepoIndex = currentIndex;
        setLoadMoreButtonLoading(false);
        updateLoadMoreButton();
        return;
    }
    
    const repoUrl = weeklyRepos[currentIndex];
    
    // Repository adatok lekérése a GitHub API-n keresztül
    fetchRepositoryData(repoUrl)
        .then(() => {
            // Ellenőrizzük újra, hogy a heti ajánlatok még aktívak-e
            if (!window.weeklyReposActive) {
                console.log('Heti ajánlatok feldolgozása leállítva API hívás után, mert már nem aktív.');
                hideLoadingIndicator();
                return;
            }
            
            // Növeljük a megjelenített repository-k számát
            displayedRepos++;
            
            // Folytatjuk a következő elemmel 0.1 másodperc múlva
            setTimeout(() => {
                processNextBatchItem(currentIndex + 1, endIndex);
            }, 100);
        })
        .catch(error => {
            console.error('Hiba a repository adatok lekérése során:', error);
            
            // Ha rate limit hiba történt, szüneteltetjük a feldolgozást
            if (error.message && error.message.includes('429')) {
                processingPaused = true;
                showRateLimitError();
                currentWeeklyRepoIndex = currentIndex + 1;
            } else {
                // Egyéb hiba esetén folytatjuk a következő elemmel 0.2 másodperc múlva
                setTimeout(() => {
                    processNextBatchItem(currentIndex + 1, endIndex);
                }, 200);
            }
        });
}

/**
 * Repository adatok lekérése a GitHub API-n keresztül
 * @param {string} repoUrl - A repository URL-je (pl. https://github.com/username/repo)
 * @returns {Promise} - Promise, ami a repository adatok feldolgozása után teljesül
 */
function fetchRepositoryData(repoUrl) {
    return new Promise(async (resolve, reject) => {
        // URL feldolgozása a username és repo név kinyeréséhez
        const urlParts = repoUrl.split('/');
        if (urlParts.length < 5) {
            reject(new Error('Érvénytelen repository URL: ' + repoUrl));
            return;
        }
        
        const username = urlParts[3];
        const repoName = urlParts[4];
        
        // GitHub API URL összeállítása
        const apiUrl = `https://api.github.com/repos/${username}/${repoName}`;
        
        // Token szinkronizáció megkísérlése, ha elérhető a syncGitHubToken függvény
        if (typeof window.syncGitHubToken === 'function') {
            try {
                await window.syncGitHubToken();
                console.log('Token szinkronizálva a heti repó adatok lekérése előtt');
            } catch (err) {
                console.warn('Nem sikerült a token szinkronizálása a heti repó adatok lekérése előtt:', err);
            }
        }
        
        // Repository adatok lekérése a getHeaders függvény használatával a hitelesítéshez
        // Mindig megpróbáljuk frissíteni a tokent vagy az auth fejlécet az aktuális munkamenetből
        let headers;
        if (typeof getHeaders === 'function') {
            // Ha elérhető a github-auth.js getHeaders függvénye, azt használjuk
            headers = getHeaders();
            console.log('GitHub API kérés getHeaders() függvénnyel a heti repó adatok lekéréséhez');
        } else {
            // Fallback fejlécek, ha a getHeaders függvény nem elérhető
            headers = {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GitHub Search App'
            };
            
            // Megpróbáljuk kiolvasni a tokent közvetlenül a sessionStorage-ból
            const token = sessionStorage.getItem('oauth_github_token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('GitHub API kérés közvetlen token felhasználásával a heti repó adatok lekéréséhez');
            } else {
                console.warn('Nincs elérhető OAuth token a heti repó adatok lekéréséhez');
            }
        }
        
        fetch(apiUrl, { headers: headers })
            .then(response => {
                // Rate limit információk kinyerése
                const rateLimit = response.headers.get('X-RateLimit-Remaining');
                const rateLimitReset = response.headers.get('X-RateLimit-Reset');
                
                if (rateLimit && parseInt(rateLimit) < 10) {
                    console.warn(`Figyelem: Kevés API kérés maradt (${rateLimit}). Következő reset: ${new Date(rateLimitReset * 1000).toLocaleTimeString()}`);
                }
                
                if (!response.ok) {
                    throw new Error(`GitHub API hiba: ${response.status}`);
                }
                return response.json();
            })
            .then(repoData => {
                // Repository adatok megjelenítése a keresési eredmények között
                displayRepositoryInResults(repoData);
                resolve();
            })
            .catch(error => {
                console.error(`Hiba a repository adatok lekérése során (${repoUrl}):`, error);
                reject(error);
            });
    });
}

/**
 * Repository megjelenítése a keresési eredmények között
 * @param {Object} repoData - A repository adatai a GitHub API-tól
 */
function displayRepositoryInResults(repoData) {
    // Ugyanazt a megjelenítési logikát használjuk, mint a keresési eredményeknél
    // Ez a függvény a script.js-ben található displayRepositories függvényt használja
    
    // Létrehozunk egy tömböt, ami csak ezt az egy repository-t tartalmazza
    const singleRepoArray = [repoData];
    
    // Meghívjuk a displayRepositories függvényt ezzel az egy elemmel
    displayRepositories(singleRepoArray);
}

/**
 * Betöltés jelző megjelenítése
 */
function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
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
    // Ellenőrizzük, hogy létezik-e már a rate limit hiba konténer
    let rateLimitErrorContainer = document.getElementById('rate-limit-error-container');
    
    if (!rateLimitErrorContainer) {
        // Ha nem létezik, létrehozzuk
        rateLimitErrorContainer = document.createElement('div');
        rateLimitErrorContainer.id = 'rate-limit-error-container';
        rateLimitErrorContainer.className = 'alert alert-warning mt-3';
        rateLimitErrorContainer.style.position = 'fixed';
        rateLimitErrorContainer.style.top = '20px';
        rateLimitErrorContainer.style.left = '50%';
        rateLimitErrorContainer.style.transform = 'translateX(-50%)';
        rateLimitErrorContainer.style.zIndex = '1050';
        rateLimitErrorContainer.style.maxWidth = '80%';
        rateLimitErrorContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        
        // Hozzáadjuk a dokumentumhoz
        document.body.appendChild(rateLimitErrorContainer);
    }
    
    // Beállítjuk a tartalmát
    rateLimitErrorContainer.innerHTML = `
        <h5>GitHub API Rate Limit Reached</h5>
        <p>The GitHub API has limited the number of requests. Please wait a few minutes or log in to your GitHub account for higher limits.</p>
        <button id="continue-weekly-repos" class="btn btn-primary">Continue</button>
        <button id="close-rate-limit-error" class="btn btn-secondary ms-2">Close</button>
    `;
    
    // Megjelenítjük a konténert
    rateLimitErrorContainer.style.display = 'block';
    
    // Eseménykezelők hozzáadása
    document.getElementById('continue-weekly-repos').addEventListener('click', () => {
        processingPaused = false;
        rateLimitErrorContainer.style.display = 'none';
        processWeeklyReposBatch();
    });
    
    document.getElementById('close-rate-limit-error').addEventListener('click', () => {
        rateLimitErrorContainer.style.display = 'none';
    });
}

/**
 * Hibaüzenet megjelenítése
 * @param {string} message - A megjelenítendő hibaüzenet
 */
function showError(message) {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        
        // 5 másodperc után elrejtjük a hibaüzenetet
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 5000);
    } else {
        // Ha nincs error container, akkor alert-et használunk
        alert(message);
    }
}

/**
 * Weekly "Load More" gomb elrejtése
 */
function hideWeeklyLoadMoreButton() {
    const weeklyLoadMoreButton = document.getElementById('weekly-load-more-button');
    if (weeklyLoadMoreButton) {
        weeklyLoadMoreButton.style.display = 'none';
    }
    
    const weeklyLoadMoreContainer = document.getElementById('weekly-load-more-container');
    if (weeklyLoadMoreContainer) {
        weeklyLoadMoreContainer.style.display = 'none';
    }
}

/**
 * Normál keresés "Load More" gomb elrejtése
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

/**
 * Keresési eredmények törlése
 */
function clearSearchResults() {
    const resultsContainer = document.getElementById('results');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }
    
    // Töröljük a projekteket tartalmazó konténert is
    const projectsContainer = document.getElementById('projects-container');
    if (projectsContainer) {
        projectsContainer.innerHTML = '';
    }
    
    // Elrejtjük a heti ajánlatok "Load More" gombját
    hideWeeklyLoadMoreButton();
}

/**
 * Repository megjelenítése a keresési eredmények között
 * @param {Object} repoData - A GitHub API-tól kapott repository adatok
 */
function displayRepositoryInResults(repoData) {
    // Ellenőrizzük, hogy létezik-e a projectsContainer
    const projectsContainer = document.getElementById('projects-container');
    if (!projectsContainer) {
        console.error('Nem található a projects-container elem');
        return;
    }
    
    // Beállítjuk a projektek konténer megjelenítését
    projectsContainer.style.display = 'flex';
    projectsContainer.className = 'row row-cols-1 row-cols-md-3 g-4';
    
    // Létrehozzuk a kártyát a repository adatokból
    if (typeof createProjectCard === 'function') {
        // Ha létezik a createProjectCard függvény, használjuk azt
        createProjectCard(repoData).then(card => {
            projectsContainer.appendChild(card);
            
            // Frissítjük a találatok számát, de csak ha nem a heti ajánlatok aktívak
            // A heti ajánlatok esetén már a betöltéskor beállítottuk a teljes számot
            if (!window.weeklyReposActive) {
                const totalCountElement = document.getElementById('total-count');
                if (totalCountElement) {
                    const currentCount = parseInt(totalCountElement.textContent) || 0;
                    totalCountElement.textContent = currentCount + 1;
                }
            }
        });
    } else {
        // Ha nem létezik a createProjectCard függvény, egyszerű kártyát hozunk létre
        const card = document.createElement('div');
        card.className = 'col';
        card.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${repoData.name}</h5>
                    <p class="card-text">${repoData.description || 'No description available'}</p>
                    <p class="card-text">
                        <small class="text-muted">
                            Stars: ${repoData.stargazers_count} | 
                            Forks: ${repoData.forks_count} | 
                            Language: ${repoData.language || 'Not specified'}
                        </small>
                    </p>
                    <a href="${repoData.html_url}" target="_blank" class="btn btn-primary">View on GitHub</a>
                </div>
            </div>
        `;
        projectsContainer.appendChild(card);
        
        // Frissítjük a találatok számát, de csak ha nem a heti ajánlatok aktívak
        // A heti ajánlatok esetén már a betöltéskor beállítottuk a teljes számot
        if (!window.weeklyReposActive) {
            const totalCountElement = document.getElementById('total-count');
            if (totalCountElement) {
                const currentCount = parseInt(totalCountElement.textContent) || 0;
                totalCountElement.textContent = currentCount + 1;
            }
        }
    }
}

/**
 * Betöltés jelző megjelenítése
 */
function showLoadingIndicator() {
    // Ellenőrizzük, hogy létezik-e a loading-indicator
    let loadingIndicator = document.getElementById('loading-indicator');
    
    if (!loadingIndicator) {
        // Ha nem létezik, létrehozzuk
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.className = 'text-center mt-3';
        loadingIndicator.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Betöltés folyamatban...</p>
        `;
        
        // Hozzáadjuk a dokumentumhoz
        const resultsContainer = document.getElementById('results');
        if (resultsContainer) {
            resultsContainer.appendChild(loadingIndicator);
        } else {
            document.body.appendChild(loadingIndicator);
        }
    }
    
    // Megjelenítjük a betöltés jelzőt
    loadingIndicator.style.display = 'block';
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
 * "Load More" gomb elrejtése
 * A heti ajánlatok "Load More" gombjának elrejtése
 */
function hideWeeklyLoadMoreButton() {
    const loadMoreButton = document.getElementById('weekly-load-more-button');
    if (loadMoreButton) {
        loadMoreButton.style.display = 'none';
    }
    
    const loadMoreContainer = document.getElementById('weekly-load-more-container');
    if (loadMoreContainer) {
        loadMoreContainer.style.display = 'none';
    }
}

/**
 * Normál keresés "Load More" gombjának elrejtése
 */
function hideNormalLoadMoreButton() {
    // A normál keresés "Load More" gombja
    const loadMoreButton = document.getElementById('load-more');
    if (loadMoreButton) {
        loadMoreButton.style.display = 'none';
    }
    
    // A normál keresés "Load More" gomb konténere
    const loadMoreContainer = document.getElementById('load-more-container');
    if (loadMoreContainer) {
        loadMoreContainer.style.display = 'none';
    }
}

/**
 * "Load More" gomb frissítése
 * Elrejti vagy megjeleníti a "Load More" gombot a feldolgozási állapot alapján
 * Betöltés közben forgó ikont és "Loading..." feliratot jelenít meg
 */
function updateLoadMoreButton() {
    // Ellenőrizzük, hogy létezik-e a "Load More" gomb, ha nem, létrehozzuk
    let loadMoreButton = document.getElementById('weekly-load-more-button');
    const projectsContainer = document.getElementById('projects-container');
    
    if (!loadMoreButton) {
        // Létrehozzuk a "Load More" gombot
        loadMoreButton = document.createElement('button');
        loadMoreButton.id = 'weekly-load-more-button';
        loadMoreButton.className = 'btn mt-3 mb-3';
        // Kezdetben a "LOAD MORE" feliratot jelenítjük meg
        loadMoreButton.innerHTML = 'LOAD MORE';
        loadMoreButton.style.display = 'none';
        // Beállítjuk az alap háttérszínt
        loadMoreButton.style.backgroundColor = '#505050';
        loadMoreButton.style.color = 'white';
        
        // Hover effektus hozzáadása
        loadMoreButton.addEventListener('mouseover', function() {
            this.style.backgroundColor = '#ff9538';
        });
        loadMoreButton.addEventListener('mouseout', function() {
            this.style.backgroundColor = '#505050';
        });
        
        // Eseménykezelő hozzáadása
        loadMoreButton.addEventListener('click', () => {
            // Új displayLimit beállítása
            displayLimit += 30;
            // Betöltés állapot beállítása a gombra
            setLoadMoreButtonLoading(true);
            // Folytatjuk a betöltést
            loadWeeklyRepos(true);
        });
        
        // Létrehozunk egy konténert a gombnak
        const loadMoreContainer = document.createElement('div');
        loadMoreContainer.className = 'd-flex justify-content-center';
        loadMoreContainer.id = 'weekly-load-more-container';
        loadMoreContainer.appendChild(loadMoreButton);
        
        // Hozzáadjuk a konténert a dokumentumhoz
        if (projectsContainer && projectsContainer.parentNode) {
            projectsContainer.parentNode.insertBefore(loadMoreContainer, projectsContainer.nextSibling);
        } else {
            document.body.appendChild(loadMoreContainer);
        }
    }
    
    // Ellenőrizzük, hogy van-e még betöltendő repository
    if (currentWeeklyRepoIndex < weeklyRepos.length && !processingPaused) {
        // Beállítjuk a gomb állapotát a feldolgozási állapot alapján
        setLoadMoreButtonLoading(!processingPaused && currentWeeklyRepoIndex < weeklyRepos.length && displayedRepos < displayLimit);
        loadMoreButton.style.display = 'block';
        
        // Ellenőrizzük, hogy a konténer is látható legyen
        const loadMoreContainer = document.getElementById('weekly-load-more-container');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = 'flex';
        }
    } else {
        loadMoreButton.style.display = 'none';
        
        // A konténert is elrejtjük
        const loadMoreContainer = document.getElementById('weekly-load-more-container');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = 'none';
        }
    }
}

/**
 * "Load More" gomb állapotának beállítása
 * @param {boolean} isLoading - Ha true, akkor betöltés állapotot mutat, egyébként "LOAD MORE" feliratot
 */
function setLoadMoreButtonLoading(isLoading) {
    const loadMoreButton = document.getElementById('weekly-load-more-button');
    if (!loadMoreButton) return;
    
    // Biztosítjuk, hogy a háttérszín mindig megfelelő legyen
    loadMoreButton.style.backgroundColor = '#505050';
    loadMoreButton.style.color = 'white';
    
    // Újra hozzáadjuk a hover eseménykezelőket, hogy a betöltés után is működjenek
    loadMoreButton.onmouseover = function() {
        this.style.backgroundColor = '#ff9538';
    };
    loadMoreButton.onmouseout = function() {
        this.style.backgroundColor = '#505050';
    };
    
    if (isLoading) {
        // Betöltés állapot: forgó ikon + "Loading..." felirat
        loadMoreButton.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <span class="ms-2">Loading...</span>
        `;
    } else {
        // Normál állapot: "LOAD MORE" felirat
        loadMoreButton.innerHTML = 'LOAD MORE';
    }
}

// Event listener hozzáadása a Weekly Repository Offer gombhoz és a keresőmező figyelése
document.addEventListener('DOMContentLoaded', () => {
    // Weekly Repository Offer gomb eseménykezelő
    const weeklyRepoButton = document.getElementById('weekly-repo-button');
    if (weeklyRepoButton) {
        weeklyRepoButton.addEventListener('click', () => loadWeeklyRepos(false));
    }
    
    // NEM töltjük be automatikusan a heti repository-kat induláskor
    // A betöltés csak a gombra kattintáskor történik meg
    
    // Keresőmező eseménykezelő
    const searchTopic = document.getElementById('search-topic');
    if (searchTopic) {
        // Eseménykezelő a keresőmező változásához
        searchTopic.addEventListener('change', (event) => {
            if (event.target.value === 'Weekly repository offer') {
                loadWeeklyRepos(false);
            }
        });
        
        // "Weekly repository offer" opció hozzáadása a keresőmezőhöz, ha még nem létezik
        let weeklyOptionExists = false;
        for (let i = 0; i < searchTopic.options.length; i++) {
            if (searchTopic.options[i].value === 'Weekly repository offer') {
                weeklyOptionExists = true;
                break;
            }
        }
        
        if (!weeklyOptionExists) {
            const weeklyOption = document.createElement('option');
            weeklyOption.value = 'Weekly repository offer';
            weeklyOption.textContent = 'Weekly repository offer';
            searchTopic.appendChild(weeklyOption);
        }
    }
    
    // Custom keresőmező eseménykezelő
    const customSearchInput = document.getElementById('custom-search');
    const customSearchToggle = document.getElementById('custom-search-toggle');
    if (customSearchInput && customSearchToggle) {
        customSearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && customSearchToggle.checked && 
                customSearchInput.value.trim().toLowerCase() === 'weekly repository offer') {
                loadWeeklyRepos(false);
            }
        });
    }
});
