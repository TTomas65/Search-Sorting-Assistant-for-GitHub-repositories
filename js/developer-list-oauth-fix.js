/**
 * GitHub OAuth Token kezelés javítása a developer_list.js fájlhoz
 * 
 * Ez a fájl felülírja és módosítja a szükséges függvényeket, hogy megfelelően működjenek az OAuth tokenekkel.
 */

// Felülírjuk a repository-k betöltéséért felelős függvényt
async function loadDeveloperRepositories(login, reset = false) {
    try {
        // Initialize or reset pagination info for this developer
        if (!developerReposPagination[login] || reset) {
            developerReposPagination[login] = { page: 1, hasMore: true };
            
            // If reset, clear existing data
            if (reset) {
                developerRepoData[login] = [];
            }
        }
        
        // If there are no more pages, return the current data
        if (!developerReposPagination[login].hasMore && !reset) {
            return developerRepoData[login] || [];
        }
        
        // Az új, központi token kezelést használjuk az API-helper fájlból
        const page = developerReposPagination[login].page;
        console.log(`Loading repositories for ${login} with OAuth token support, page ${page}`);
        
        // Az új API helper függvényt használjuk a developer-api-helper.js fájlból
        const result = await fetchDeveloperRepositories(login, page, reposPerPage);
        const repos = result.repos;
        
        // Frissítjük a lapozási adatokat
        developerReposPagination[login].hasMore = result.hasNextPage;
        developerReposPagination[login].page++;
        
        // Hozzáadjuk az új adatokat a meglévőkhöz
        if (!developerRepoData[login]) {
            developerRepoData[login] = repos;
        } else {
            developerRepoData[login] = [...developerRepoData[login], ...repos];
        }
        
        return developerRepoData[login];
    } catch (error) {
        console.error(`Error loading repositories for ${login}:`, error);
        throw error;
    }
}

// Felülírjuk a README fájl betöltéséért felelős függvényt
async function loadRepositoryReadme(owner, repoName) {
    try {
        return await fetchRepositoryReadme(owner, repoName);
    } catch (error) {
        console.error(`Error loading README for ${owner}/${repoName}:`, error);
        return `Error loading README: ${error.message}`;
    }
}

// Felülírjuk a csillagozott repository-k betöltéséért felelős függvényt
async function loadDeveloperStarredList(login, reset = false) {
    try {
        // Inicializáljuk vagy reseteljük a lapozási információkat ehhez a fejlesztőhöz
        if (!starredReposPagination[login] || reset) {
            starredReposPagination[login] = { page: 1, hasMore: true };
            
            // Ha reset, töröljük a meglévő adatokat
            if (reset) {
                developerStarredRepoData[login] = [];
            }
        }
        
        // Ha nincs több oldal, visszaadjuk a jelenlegi adatokat
        if (!starredReposPagination[login].hasMore && !reset) {
            return developerStarredRepoData[login] || [];
        }
        
        // Az új, központi token kezelést használjuk
        const page = starredReposPagination[login].page;
        console.log(`Loading starred repositories for ${login} with OAuth token support, page ${page}`);
        
        // Az új API helper függvényt használjuk
        const result = await fetchDeveloperStarredRepos(login, page, starredReposPerPage);
        const starredRepos = result.repos;
        
        // Frissítjük a lapozási adatokat
        starredReposPagination[login].hasMore = result.hasNextPage;
        starredReposPagination[login].page++;
        
        // Hozzáadjuk az új adatokat a meglévőkhöz
        if (!developerStarredRepoData[login]) {
            developerStarredRepoData[login] = starredRepos;
        } else {
            developerStarredRepoData[login] = [...developerStarredRepoData[login], ...starredRepos];
        }
        
        return developerStarredRepoData[login];
    } catch (error) {
        console.error(`Error loading starred repositories for ${login}:`, error);
        throw error;
    }
}

// Felülírjuk a csillagozott repository-k számának lekérdezéséért felelős függvényt
async function fetchStarredCount(login) {
    try {
        // Az új API helper függvényt használjuk
        const count = await fetchDeveloperStarredCount(login);
        
        // Frissítjük a számlálót a felhasználói felületen
        const starredCountElement = document.querySelector(`.starred-count[data-login="${login}"]`);
        if (starredCountElement) {
            starredCountElement.textContent = count;
        }
        
        return count;
    } catch (error) {
        console.error(`Error fetching starred count for ${login}:`, error);
        
        // Hiba esetén 0-ra állítjuk a számlálót
        const starredCountElement = document.querySelector(`.starred-count[data-login="${login}"]`);
        if (starredCountElement) {
            starredCountElement.textContent = '0';
        }
        
        return 0;
    }
}

/**
 * Generateál egy megfelelő repository kép URL-t egy adott repository-hoz
 * @param {Object} repo A repository objektum
 * @returns {string} A repository kép URL
 */
function generateRepoImageUrl(repo) {
    // GitHub OpenGraph kép URL generálása a repository teljes nevéből
    if (repo && repo.owner && repo.owner.login && repo.name) {
        return `https://opengraph.githubassets.com/1/${repo.owner.login}/${repo.name}`;
    }
    
    // Backup URL, ha valami hiányozna
    return 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
}

/**
 * Felülírjuk a repository kártya létrehozásért felelős függvényt
 * @param {Object} repo A repository adatai
 * @returns {HTMLElement} A létrehozott kártya elem
 */
function createRepositoryCard(repo) {
    const formattedUpdateDate = new Date(repo.updated_at).toLocaleDateString();
    
    // Először generáljuk a repository kép URL-t
    const repoImageUrl = generateRepoImageUrl(repo);
    
    const repoCardContainer = document.createElement('div');
    repoCardContainer.className = 'dev-repo-card';
    
    repoCardContainer.innerHTML = `
        <div class="card">
            <div class="repo-image-container">
                <img src="${repoImageUrl}" alt="${repo.name} repository image" class="repo-image">
            </div>
            <div class="repo-actions mb-3">
                <button class="btn-readme" data-owner="${repo.owner.login}" data-repo="${repo.name}">View README</button>
                <button class="btn-repo-favorite" data-repo-id="${repo.id}">+Repo.</button>
            </div>
            <div class="card-body">
                <h5 class="card-title">${repo.name}</h5>
                <p class="project-meta mb-2">
                    <span class="update-date">Last update: ${formattedUpdateDate}</span>
                </p>
                <p class="card-text">${repo.description || 'No description available'}</p>
                <div class="repository-stats mb-2">
                    <span class="me-3"><i class="bi bi-star-fill text-warning"></i> ${repo.stargazers_count}</span>
                    <span class="me-3"><i class="bi bi-diagram-2-fill"></i> ${repo.forks_count}</span>
                    <span>${repo.language || 'Unknown'}</span>
                </div>
                <div class="d-flex justify-content-between">
                    <a href="${repo.html_url}" target="_blank" class="btn btn-sm btn-outline-primary">
                        <img src="pictures/GitHub-Logo_button.png" alt="GitHub" class="github-button-icon"> View Repository
                    </a>
                </div>
            </div>
        </div>
    `;
    
    // README gomb eseménykezelőjének hozzáadása
    const readmeBtn = repoCardContainer.querySelector('.btn-readme');
    readmeBtn.addEventListener('click', async () => {
        const owner = readmeBtn.getAttribute('data-owner');
        const repoName = readmeBtn.getAttribute('data-repo');
        
        try {
            // Az új API helper függvényt használjuk a README betöltéséhez
            const content = await fetchRepositoryReadme(owner, repoName);
            showReadmePopup(content, owner, repoName);
        } catch (error) {
            console.error('Error fetching readme:', error);
            showReadmePopup(`Error loading README: ${error.message}`, owner, repoName);
        }
    });
    
    // Kedvencek gomb eseménykezelőjének hozzáadása
    const favoriteBtn = repoCardContainer.querySelector('.btn-repo-favorite');
    checkAndSetupFavoriteButton(repo, favoriteBtn);
    
    return repoCardContainer;
}

// Hasonló javitás a starred repository kártyákra is - ha azok is használják az image_url-t
function createStarredRepoCard(repo) {
    // Ez a függvény teljesen hasonló a createRepositoryCard-hoz, az eredeti kódtól függően
    // Ha a developer_list.js külön függvényt használ a starred repo kártyákra, azt is át kell írni
    // A példa kód ugyanazt a metódust használja
    return createRepositoryCard(repo);
}

// Console üzenet a sikeres betöltésről
console.log('OAuth-compatible developer list functions loaded successfully');

// Eseménykezelők újrainicializálása a következő alkalommal, amikor a developer_list.js aktiválja őket
document.addEventListener('developerListReady', function() {
    console.log('Reinitializing developer list event handlers with OAuth support');
    initDeveloperCardEvents();
});
