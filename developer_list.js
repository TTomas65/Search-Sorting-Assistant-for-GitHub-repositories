/**
 * Developer List - A JavaScript module for displaying favorite developers
 * This module handles the functionality for the "List my Developers" button
 */

// GlobĂˇlis vĂˇltozĂłk
let developerListContainer = document.getElementById('developer-list-container');
const developerData = {};
const developerRepoData = {};
const developerStarredRepoData = {}; // FejlesztĹ‘k starred repository adatainak tĂˇrolĂˇsa
let developerReposPagination = {}; // TĂˇrolja a fejlesztĹ‘ repository-k lapozĂˇsi adatait
let starredReposPagination = {}; // Object to store pagination info for each developer: { login: { page: 1, hasMore: true } }
let developerListVisible = false; // A fejlesztĹ‘k lista lĂˇthatĂłsĂˇgĂˇnak Ăˇllapota
let allDevelopers = []; // Az Ă¶sszes fejlesztĹ‘ adatait tĂˇrolĂł tĂ¶mb
let currentDevelopersPage = 1; // Az aktuĂˇlis fejlesztĹ‘i oldal
let loadMoreDevelopersButton = null; // A "Load More" gomb
const developersPerPage = 10; // Egy oldalon megjelenĂ­tendĹ‘ fejlesztĹ‘k szĂˇma

// Starred repositories pagination variables
const starredReposPerPage = 100; // GitHub API limit per page
const reposPerPage = 100; // Egy oldalon megjelenĹ‘ repository-k szĂˇma

// DOM betĂ¶ltĂŠsekor inicializĂˇljuk az esemĂŠnykezelĹ‘ket
document.addEventListener('DOMContentLoaded', () => {
    // "List my Developers" gomb esemĂŠnykezelĹ‘ hozzĂˇadĂˇsa
    // const listDevelopersButton = document.getElementById('list-developers-button');
    // if (listDevelopersButton) {
    //     listDevelopersButton.addEventListener('click', toggleDeveloperList);
    // }
    
    // LĂŠtrehozzuk a fejlesztĹ‘k listĂˇjĂˇnak kontĂŠnerĂŠt
    createDeveloperListContainer();
    
    // GlobĂˇlis esemĂŠnykezelĹ‘ a repository slider nyilakhoz
    document.addEventListener('click', handleRepositoryNavigation);
    
    // GlobĂˇlis esemĂŠnykezelĹ‘ a starred repository slider nyilakhoz
    document.addEventListener('click', handleStarredRepositoryNavigation);
    
    // FrissĂ­tjĂĽk a fejlesztĹ‘k szĂˇmĂˇt a betĂ¶ltĂŠskor
    // updateDevelopersCount();
});

/**
 * LĂŠtrehozza a fejlesztĹ‘k listĂˇjĂˇnak kontĂŠnerĂŠt
 */
function createDeveloperListContainer() {
    // EllenĹ‘rizzĂĽk, hogy lĂŠtezik-e mĂˇr a kontĂŠner
    if (document.getElementById('developer-list-container')) {
        developerListContainer = document.getElementById('developer-list-container');
        return;
    }
    
    // LĂŠtrehozzuk a kontĂŠnert
    const newContainer = document.createElement('div');
    newContainer.id = 'developer-list-container';
    newContainer.className = 'developer-list-container';
    newContainer.style.display = 'none';
    
    // HozzĂˇadjuk a DOM-hoz a Search Controls elĹ‘tt
    const searchControls = document.querySelector('.card.mb-4');
    if (searchControls) {
        searchControls.parentNode.insertBefore(newContainer, searchControls);
    } else {
        // Ha nincs searchControls, akkor a body-hoz adjuk
        document.body.appendChild(newContainer);
    }
    
    // Frissítjük a globális referenciát
    developerListContainer = document.getElementById('developer-list-container');
}

/**
 * Váltja a fejlesztők listájának láthatóságát
 */
async function toggleDeveloperList() {
    // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
    // Csak akkor engedünk hozzáférést a fejlesztők listájához, ha be van jelentkezve
    // A section-manager.js már kezeli ezt, de a biztonság kedvéért itt is ellenőrizzük
    if (document.getElementById('user-info').classList.contains('d-none')) {
        // Mivel a section-manager.js meghívta már a showLoginRequiredMessage-t, 
        // itt csak azt biztosítjuk, hogy ne fussanak tovább az adatbetöltési kódok
        return;
    }
    
    // Biztosítsuk, hogy a container létezik
    if (!developerListContainer) {
        createDeveloperListContainer();
        
        // Ha még mindig null, akkor hiba van
        if (!developerListContainer) {
            console.error('Could not create developer list container');
            return;
        }
    }
    
    // Ha a lista lĂˇthatĂł, elrejtjĂĽk
    if (developerListVisible) {
        developerListContainer.style.display = 'none';
        developerListVisible = false;
        // document.getElementById('list-developers-button').textContent = 'List my Developers';
        return;
    }
    
    // Ha a lista nem lĂˇthatĂł, megjelenĂ­tjĂĽk
    try {
        // JelezzĂĽk a betĂ¶ltĂŠst
        developerListContainer.innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-warning" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading developer data...</p>
            </div>
        `;
        developerListContainer.style.display = 'block';
        
        // TĂ¶rĂ¶ljĂĽk a korĂˇbbi repository adatokat, hogy kĂŠnyszerĂ­tsĂĽk az ĂşjrainicializĂˇlĂˇst
        Object.keys(developerRepoData).forEach(key => delete developerRepoData[key]);
        Object.keys(developerStarredRepoData).forEach(key => delete developerStarredRepoData[key]);
        Object.keys(developerReposPagination).forEach(key => delete developerReposPagination[key]);
        Object.keys(starredReposPagination).forEach(key => delete starredReposPagination[key]);
        
        const developers = await loadDeveloperDetails();
        console.log('Loaded developers:', developers);
        
        if (!developers || developers.length === 0) {
            showEmptyDeveloperList();
        } else {
            renderDeveloperList(developers);
        }
        
        developerListVisible = true;
        // document.getElementById('list-developers-button').textContent = 'Hide Developers';
    } catch (error) {
        console.error('Error displaying developer list:', error);
        showErrorMessage(error.message);
    }
}

/**
 * BetĂ¶lti a kedvenc fejlesztĹ‘k rĂŠszletes adatait
 * @returns {Promise<Array>} A fejlesztĹ‘k rĂŠszletes adatai
 */
async function loadDeveloperDetails() {
    try {
        // ElĹ‘szĂ¶r betĂ¶ltjĂĽk a kedvenc fejlesztĹ‘k alapadatait
        const response = await fetch('get_favorite_developers.php');
        if (!response.ok) {
            throw new Error('Failed to fetch favorite developers');
        }
        
        const data = await response.json();
        console.log('Favorite developers data:', data);
        
        if (!data.success || !Array.isArray(data.developers) || data.developers.length === 0) {
            // Frissítjük a fejlesztők számát a total-count elemben
            const totalCountElement = document.getElementById('total-count');
            if (totalCountElement) {
                totalCountElement.textContent = '0';
            }
            return [];
        }
        
        // Frissítjük a fejlesztők számát a total-count elemben
        const totalCountElement = document.getElementById('total-count');
        if (totalCountElement) {
            totalCountElement.textContent = data.developers.length.toString();
        }
        
        // Frissítjük a globális allDevelopers változót
        allDevelopers = data.developers;
        
        // RĂŠszletes adatok lekĂŠrĂŠse minden fejlesztĹ‘hĂ¶z
        const developerDetailsPromises = data.developers.map(async (dev) => {
            try {
                // A központi GitHub API token kezelést használjuk
                // Az új getHeaders() függvény már kezeli mind az OAuth, mind a hagyományos tokeneket
                const headers = getHeaders();
                
                // PrĂłbĂˇljuk meg lekĂŠrni a GitHub API-rĂłl
                try {
                    const response = await fetch(`https://api.github.com/users/${dev.login}`, { headers });
                    if (!response.ok) {
                        throw new Error(`Failed to fetch details for ${dev.login}`);
                    }
                    
                    const userData = await response.json();
                    console.log(`User data for ${dev.login}:`, userData);
                    
                    return {
                        id: dev.github_id,
                        login: dev.login,
                        avatar_url: userData.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
                        name: userData.name || dev.login,
                        bio: userData.bio || 'No bio available',
                        public_repos: userData.public_repos || 0,
                        followers: userData.followers || 0,
                        following: userData.following || 0,
                        location: userData.location || 'Unknown location',
                        html_url: userData.html_url || `https://github.com/${dev.login}`,
                        notes: dev.notes || ''
                    };
                } catch (apiError) {
                    console.error(`Error fetching from GitHub API for ${dev.login}:`, apiError);
                    
                    // Ha nem sikerĂĽlt a GitHub API-rĂłl lekĂŠrni, prĂłbĂˇljuk meg a cache-bĹ‘l
                    return {
                        id: dev.github_id,
                        login: dev.login,
                        avatar_url: `https://avatars.githubusercontent.com/u/${dev.github_id}?v=4`,
                        name: dev.login,
                        bio: 'Could not load developer details from GitHub API',
                        public_repos: 0,
                        followers: 0,
                        following: 0,
                        location: 'Unknown',
                        html_url: `https://github.com/${dev.login}`,
                        notes: dev.notes || ''
                    };
                }
            } catch (error) {
                console.error(`Error fetching details for ${dev.login}:`, error);
                // AlapĂŠrtelmezett adatok visszaadĂˇsa hiba esetĂŠn
                return {
                    id: dev.github_id,
                    login: dev.login,
                    avatar_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
                    name: dev.login,
                    bio: 'Could not load developer details',
                    public_repos: 0,
                    followers: 0,
                    following: 0,
                    location: 'Unknown',
                    html_url: `https://github.com/${dev.login}`,
                    notes: dev.notes || ''
                };
            }
        });
        
        // VĂˇrjuk meg az Ă¶sszes Ă­gĂŠret teljesĂĽlĂŠsĂŠt
        allDevelopers = await Promise.all(developerDetailsPromises);
        return allDevelopers;
    } catch (error) {
        console.error('Error loading developer details:', error);
        throw error;
    }
}

/**
 * MegjelenĂ­ti a fejlesztĹ‘k listĂˇjĂˇt
 * @param {Array} developers A megjelenĂ­tendĹ‘ fejlesztĹ‘k adatai
 * @param {boolean} isNewList Ăşj lista betĂ¶ltĂŠse (nem hozzĂˇadĂˇs)
 */
function renderDeveloperList(developers, isNewList = true) {
    // EllenĹ‘rizzĂĽk, hogy a container lĂŠtezik-e
    if (!developerListContainer) {
        createDeveloperListContainer();
        
        if (!developerListContainer) {
            console.error('Could not create developer list container');
            alert('Error: Failed to create developer list container');
            return;
        }
    }
    
    // Ăšj lista esetĂŠn tĂ¶rĂ¶ljĂĽk a kontĂŠner tartalmĂˇt
    if (isNewList) {
        developerListContainer.innerHTML = '';
        
        // TĂˇroljuk az Ă¶sszes fejlesztĹ‘t
        allDevelopers = developers;
        currentDevelopersPage = 1;
    }
    
    // KiszĂˇmoljuk az aktuĂˇlis oldalon megjelenĂ­tendĹ‘ fejlesztĹ‘ket
    const startIndex = isNewList ? 0 : (currentDevelopersPage - 1) * developersPerPage;
    const endIndex = Math.min(startIndex + developersPerPage, allDevelopers.length);
    const currentPageDevelopers = allDevelopers.slice(startIndex, endIndex);
    
    // LĂŠtrehozzuk a fejlesztĹ‘k kĂˇrtyĂˇit
    currentPageDevelopers.forEach(dev => {
        const card = createDeveloperCard(dev);
        developerListContainer.appendChild(card);
    });
    
    // Load More gomb kezelĂŠse
    handleLoadMoreDevelopersButton();
    
    // EsemĂŠnykezelĹ‘k inicializĂˇlĂˇsa
    initDeveloperCardEvents();
}

/**
 * LĂŠtrehoz egy fejlesztĹ‘ kĂˇrtyĂˇt
 * @param {Object} developer A fejlesztĹ‘ adatai
 * @returns {HTMLElement} A lĂŠtrehozott kĂˇrtya elem
 */
function createDeveloperCard(developer) {
    const card = document.createElement('div');
    card.className = 'card mb-3 developer-card';
    card.dataset.login = developer.login;
    
    // BiztosĂ­tjuk, hogy van avatar_url
    const avatarUrl = developer.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
    
    // GitHub Readme Stats kĂˇrtyĂˇk URL-jei
    const statsCardUrl = `https://github-readme-stats.vercel.app/api?username=${developer.login}&show_icons=true&theme=slateorange&hide_border=true&bg_color=00000000`;
    const topLangsCardUrl = `https://github-readme-stats.vercel.app/api/top-langs/?username=${developer.login}&layout=compact&theme=slateorange&hide_border=true&bg_color=00000000`;
    
    // ElĹ‘szĂ¶r adjuk hozzĂˇ a hĂˇttĂŠr elemeket
    const cardBg1 = document.createElement('div');
    cardBg1.className = 'card-bg';
    card.appendChild(cardBg1);
    
    const cardBg2 = document.createElement('div');
    cardBg2.className = 'card-bg bg2';
    card.appendChild(cardBg2);
    
    const cardBg3 = document.createElement('div');
    cardBg3.className = 'card-bg bg3';
    card.appendChild(cardBg3);
    
    // Majd adjuk hozzĂˇ a tartalmat
    const content = document.createElement('div');
    content.className = 'row g-0';
    
    // LĂŠtrehozzuk a kĂŠp kontĂŠnert
    const imgCol = document.createElement('div');
    imgCol.className = 'col-md-2 col-sm-3 text-center';
    
    // LĂŠtrehozzuk a kĂŠp elemet
    const img = document.createElement('img');
    img.className = 'img-fluid developer-avatar';
    img.alt = developer.login;
    img.onerror = function() {
        this.src = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
    };
    
    // Crossorigin attribĂştum hozzĂˇadĂˇsa a kĂŠphez
    img.crossOrigin = 'anonymous';
    img.src = avatarUrl;
    
    imgCol.appendChild(img);
    content.appendChild(imgCol);
    
    // LĂŠtrehozzuk a tartalom kontĂŠnert
    const contentCol = document.createElement('div');
    contentCol.className = 'col-md-10 col-sm-9';
    contentCol.innerHTML = `
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h5 class="card-title">${developer.name}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">@${developer.login}</h6>
                </div>
                <div>
                    <a href="${developer.html_url}" target="_blank" class="btn btn-sm btn-outline-primary">
                        <img src="pictures/GitHub-Logo_button.png" alt="GitHub" class="github-button-icon"> View Profile
                    </a>
                    <button class="btn btn-sm btn-warning remove-dev-btn" data-login="${developer.login}">-Dev.</button>
                </div>
            </div>
            <p class="card-text">${developer.bio}</p>
            <div class="developer-stats">
                <button class="badge repo-button me-2" data-login="${developer.login}"><i class="bi bi-code-square"></i> ${developer.public_repos} repos</button>
                <span class="badge bg-secondary me-2"><i class="bi bi-people-fill"></i> ${developer.followers} followers</span>
                <span class="badge bg-secondary me-2"><i class="bi bi-person-plus-fill"></i> ${developer.following} following</span>
                ${developer.location ? `<span class="badge bg-secondary"><i class="bi bi-geo-alt-fill"></i> ${developer.location}</span>` : ''}
                <button class="badge starred-button" data-login="${developer.login}"><i class="bi bi-star-fill"></i> View Developer starred list = <span class="starred-count" data-login="${developer.login}">0</span></button>
            </div>
            <div class="notes-container mb-3 mt-3">
                <textarea class="developer-notes form-control" placeholder="Add notes here..." data-login="${developer.login}">${developer.notes || ''}</textarea>
            </div>
            <div class="github-stats-cards mt-3">
                <div class="stats-card-container" id="stats-${developer.login}">
                    <div class="text-center p-3 loading-stats">
                        <div class="spinner-border spinner-border-sm text-warning" role="status">
                            <span class="visually-hidden">Loading stats...</span>
                        </div>
                        <span class="ms-2">Loading GitHub stats...</span>
                    </div>
                </div>
                <div class="stats-card-container" id="langs-${developer.login}">
                    <div class="text-center p-3 loading-stats">
                        <div class="spinner-border spinner-border-sm text-warning" role="status">
                            <span class="visually-hidden">Loading languages...</span>
                        </div>
                        <span class="ms-2">Loading top languages...</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    content.appendChild(contentCol);
    card.appendChild(content);
    
    // Repository container hozzĂˇadĂˇsa
    const repoContainer = document.createElement('div');
    repoContainer.className = 'dev-repositories-container';
    repoContainer.style.display = 'none';
    repoContainer.innerHTML = `
        <div class="dev-repositories-grid"></div>
    `;
    card.appendChild(repoContainer);
    
    // Starred repository container hozzĂˇadĂˇsa
    const starredContainer = document.createElement('div');
    starredContainer.className = 'starred-list-container';
    starredContainer.style.display = 'none';
    card.appendChild(starredContainer);
    
    // KĂˇrtyĂˇk betĂ¶ltĂŠse a DOM-ba valĂł beillesztĂŠs utĂˇn
    setTimeout(() => {
        loadGitHubStats(developer.login, statsCardUrl, topLangsCardUrl);
    }, 100);
    
    return card;
}

/**
 * BetĂ¶lti a GitHub Stats kĂˇrtyĂˇt
 * @param {string} login A fejlesztĹ‘ login neve
 * @param {string} url A kĂˇrtya URL-je
 */
function loadGitHubStats(login, statsCardUrl, topLangsCardUrl) {
    const statsContainer = document.getElementById(`stats-${login}`);
    const langsContainer = document.getElementById(`langs-${login}`);
    
    if (!statsContainer || !langsContainer) return;
    
    const statsImg = new Image();
    statsImg.src = statsCardUrl;
    statsImg.alt = `${login} GitHub Stats`;
    statsImg.className = 'github-stats-card';
    
    statsImg.onload = () => {
        statsContainer.innerHTML = '';
        statsContainer.appendChild(statsImg);
    };
    
    statsImg.onerror = () => {
        statsContainer.innerHTML = `
            <div class="text-center p-3 text-danger">
                <i class="bi bi-exclamation-triangle"></i>
                <span class="ms-2">Failed to load GitHub stats</span>
            </div>
        `;
    };
    
    const langsImg = new Image();
    langsImg.src = topLangsCardUrl;
    langsImg.alt = `${login} Top Languages`;
    langsImg.className = 'github-stats-card';
    
    langsImg.onload = () => {
        langsContainer.innerHTML = '';
        langsContainer.appendChild(langsImg);
    };
    
    langsImg.onerror = () => {
        langsContainer.innerHTML = `
            <div class="text-center p-3 text-danger">
                <i class="bi bi-exclamation-triangle"></i>
                <span class="ms-2">Failed to load top languages</span>
            </div>
        `;
    };
}

/**
 * InicializĂˇlja a fejlesztĹ‘ kĂˇrtyĂˇk esemĂŠnykezelĹ‘it
 */
function initDeveloperCardEvents() {
    // FejlesztĹ‘ eltĂˇvolĂ­tĂˇsa gombok
    document.querySelectorAll('.remove-dev-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            const login = button.getAttribute('data-login');
            const card = button.closest('.developer-card');
            await removeDeveloperFromFavorites(login, card);
        });
    });
    
    // MegjegyzĂŠs mezĹ‘k
    document.querySelectorAll('.developer-notes').forEach(notesInput => {
        notesInput.addEventListener('blur', async function() {
            const login = this.dataset.login;
            const notes = this.value;
            
            try {
                const response = await fetch('update_developer_notes.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        developer_login: login,
                        notes: notes
                    })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.message || 'Failed to save notes');
                }
                
                console.log('Developer notes saved successfully');
            } catch (error) {
                console.error('Error saving developer notes:', error);
                alert('Failed to save notes: ' + error.message);
            }
        });
    });
    
    // Repository gombok
    document.querySelectorAll('.repo-button').forEach(button => {
        button.addEventListener('click', async function() {
            const login = this.dataset.login;
            const card = this.closest('.developer-card');
            const repoContainer = card.querySelector('.dev-repositories-container');
            const starredListContainer = card.querySelector('.starred-list-container');
            
            // Ha mĂˇr lĂˇthatĂł a repository container, akkor elrejtjĂĽk
            if (repoContainer.style.display === 'block') {
                repoContainer.style.display = 'none';
                return;
            }
            
            // ElrejtjĂĽk a starred list container-t, ha lĂˇthatĂł
            if (starredListContainer.style.display === 'block') {
                starredListContainer.style.display = 'none';
            }
            
            // MegjelenĂ­tjĂĽk a repository container-t betĂ¶ltĂŠs jelzĂŠssel
            repoContainer.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border text-warning" role="status">
                        <span class="visually-hidden">Loading repositories...</span>
                    </div>
                    <p class="mt-2">Loading repositories...</p>
                </div>
            `;
            repoContainer.style.display = 'block';
            
            // BetĂ¶ltjĂĽk a repository-kat
            try {
                await loadDeveloperRepositories(login, true); // Reset parameter hozzáadása
                renderDeveloperRepositories(login, card);
            } catch (error) {
                console.error(`Error loading repositories for ${login}:`, error);
                repoContainer.innerHTML = `
                    <div class="text-center p-4 text-danger">
                        <i class="bi bi-exclamation-triangle"></i>
                        <p class="mt-2">Failed to load repositories: ${error.message}</p>
                    </div>
                `;
            }
        });
    });
    
    // Starred list gombok
    document.querySelectorAll('.starred-button').forEach(button => {
        button.addEventListener('click', async function() {
            const login = this.dataset.login;
            const card = this.closest('.developer-card');
            const starredListContainer = card.querySelector('.starred-list-container');
            const repoContainer = card.querySelector('.dev-repositories-container');
            
            // Ha mĂˇr lĂˇthatĂł a starred list container, akkor elrejtjĂĽk
            if (starredListContainer.style.display === 'block') {
                starredListContainer.style.display = 'none';
                return;
            }
            
            // ElrejtjĂĽk a repository container-t, ha lĂˇthatĂł
            if (repoContainer.style.display === 'block') {
                repoContainer.style.display = 'none';
            }
            
            // Ha mĂŠg nem tĂ¶ltĂ¶ttĂĽk be a starred list-et, akkor betĂ¶ltjĂĽk
            if (!developerStarredRepoData[login]) {
                // MegjelenĂ­tjĂĽk a starred list container-t betĂ¶ltĂŠs jelzĂŠssel
                starredListContainer.innerHTML = `
                    <div class="text-center p-4">
                        <div class="spinner-border text-warning" role="status">
                            <span class="visually-hidden">Loading starred list...</span>
                        </div>
                        <p class="mt-2">Loading starred list...</p>
                    </div>
                `;
                starredListContainer.style.display = 'block';
                
                // BetĂ¶ltjĂĽk a starred list-et
                try {
                    await loadDeveloperStarredList(login);
                    renderDeveloperStarredList(login, card);
                } catch (error) {
                    console.error(`Error loading starred list for ${login}:`, error);
                    starredListContainer.innerHTML = `
                        <div class="text-center p-4 text-danger">
                            <i class="bi bi-exclamation-triangle"></i>
                            <p class="mt-2">Failed to load starred list: ${error.message}</p>
                        </div>
                    `;
                }
            } else {
                // Ha mĂˇr betĂ¶ltĂ¶ttĂĽk a starred list-et, csak megjelenĂ­tjĂĽk
                renderDeveloperStarredList(login, card);
                starredListContainer.style.display = 'block';
            }
        });
    });
    
    // ElĹ‘re betĂ¶ltjĂĽk a csillagozott repository-k szĂˇmĂˇt minden fejlesztĹ‘hĂ¶z
    document.querySelectorAll('.starred-button').forEach(button => {
        const login = button.dataset.login;
        fetchStarredCount(login);
    });
}

/**
 * BetĂ¶lti egy fejlesztĹ‘ repository-jait
 * @param {string} login A fejlesztĹ‘ login neve
 * @param {boolean} reset Ha true, akkor Ăşjrakezdi a betĂ¶ltĂŠst az elsĹ‘ oldaltĂłl
 * @returns {Promise<Array>} A repository-k listĂˇja
 */
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
        
        // EllenĹ‘rizzĂĽk, hogy van-e token a GitHub API hĂ­vĂˇsokhoz
        const token = sessionStorage.getItem('oauth_github_token');
        const headers = token ? { 'Authorization': `token ${token}` } : {};
        
        // LekĂŠrjĂĽk a repository-kat az aktuĂˇlis oldalrĂłl
        const page = developerReposPagination[login].page;
        console.log(`Loading repositories for ${login}, page ${page}`);
        
        const response = await fetch(`https://api.github.com/users/${login}/repos?sort=updated&per_page=${reposPerPage}&page=${page}`, { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch repositories for ${login}: ${response.status}`);
        }
        
        const repos = await response.json();
        console.log(`Repositories for ${login} (page ${page}):`, repos.length, 'items');
        
        // Check if there are more pages
        const linkHeader = response.headers.get('Link');
        developerReposPagination[login].hasMore = linkHeader && linkHeader.includes('rel="next"');
        console.log(`Has more repositories for ${login}: ${developerReposPagination[login].hasMore}`);
        
        // Process the repositories
        const processedRepos = repos.map(repo => {
            // AlapĂŠrtelmezett kĂŠp a GitHub OpenGraph kĂŠp
            const repoImage = `https://opengraph.githubassets.com/${Date.now()}/${login}/${repo.name}`;
            
            return {
                id: repo.id,
                name: repo.name,
                description: repo.description,
                html_url: repo.html_url,
                stargazers_count: repo.stargazers_count,
                forks_count: repo.forks_count,
                language: repo.language,
                updated_at: repo.updated_at,
                image_url: repoImage,
                owner: {
                    login: repo.owner.login,
                    avatar_url: repo.owner.avatar_url,
                    html_url: repo.owner.html_url
                }
            };
        });
        
        // Initialize or append to the existing data
        if (!developerRepoData[login] || reset) {
            developerRepoData[login] = processedRepos;
        } else {
            developerRepoData[login] = [...developerRepoData[login], ...processedRepos];
        }
        
        // Increment the page for next load
        developerReposPagination[login].page++;
        
        return developerRepoData[login];
    } catch (error) {
        console.error(`Error loading repositories for ${login}:`, error);
        throw error;
    }
}

/**
 * MegjelenĂ­ti egy fejlesztĹ‘ repository-jait
 * @param {string} login A fejlesztĹ‘ login neve
 * @param {HTMLElement} card A fejlesztĹ‘ kĂˇrtya
 * @param {boolean} append Ha true, akkor hozzĂˇfĹ±zi az Ăşj elemeket a meglĂŠvĹ‘khĂ¶z
 */
function renderDeveloperRepositories(login, card, append = false) {
    const repos = developerRepoData[login];
    if (!repos || repos.length === 0) {
        const repoContainer = card.querySelector('.dev-repositories-container');
        repoContainer.innerHTML = `
            <div class="text-center p-4">
                <p>No repositories found for this developer.</p>
            </div>
        `;
        return;
    }
    
    // MegkeressĂĽk a repository container-t
    const repoContainer = card.querySelector('.dev-repositories-container');
    
    // Ha ez az elsĹ‘ betĂ¶ltĂŠs, akkor inicializĂˇljuk a container-t
    if (!append) {
        // LĂŠtrehozzuk a repository container-t
        repoContainer.innerHTML = `
            <div class="dev-repositories-grid"></div>
        `;
    }
    
    // LĂŠtrehozzuk vagy megkeressĂĽk a grid-et
    const grid = repoContainer.querySelector('.dev-repositories-grid');
    
    // Ha append mĂłd, akkor csak az Ăşj elemeket adjuk hozzĂˇ
    if (append) {
        const existingCount = grid.querySelectorAll('.dev-repo-card').length;
        const newRepos = repos.slice(existingCount);
        
        console.log(`Appending ${newRepos.length} new repositories to existing ${existingCount}`);
        
        // HozzĂˇadjuk az Ăşj repository kĂˇrtyĂˇkat
        newRepos.forEach(repo => {
            const repoCard = createRepositoryCard(repo);
            grid.appendChild(repoCard);
        });
    } else {
        // HozzĂˇadjuk a repository kĂˇrtyĂˇkat
        repos.forEach(repo => {
            const repoCard = createRepositoryCard(repo);
            grid.appendChild(repoCard);
        });
    }
    
    // EltĂˇvolĂ­tjuk a meglĂŠvĹ‘ "Load More" gombot, ha van
    const existingLoadMoreBtnContainer = repoContainer.querySelector('.load-more-btn-container');
    if (existingLoadMoreBtnContainer) {
        existingLoadMoreBtnContainer.remove();
    }
    
    // Ha van mĂŠg tĂ¶bb betĂ¶lthetĹ‘ repository, akkor megjelenĂ­tjĂĽk a "Load More" gombot
    if (developerReposPagination[login] && developerReposPagination[login].hasMore) {
        console.log(`Showing "Load More" button for ${login}`);
        
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'btn btn-primary load-more-repos-btn mt-3';
        loadMoreBtn.textContent = 'Load More Developer Repositories';
        loadMoreBtn.dataset.login = login;
        
        // EsemĂŠnykezelĹ‘ hozzĂˇadĂˇsa
        loadMoreBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            await loadMoreDeveloperRepositories(login, card);
        });
        
        // LĂŠtrehozunk egy kontĂŠnert a gombnak, hogy kĂ¶zĂŠpre igazĂ­tsuk
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'text-center mt-4 mb-3 load-more-btn-container';
        buttonContainer.appendChild(loadMoreBtn);
        
        // HozzĂˇadjuk a container-hez
        repoContainer.appendChild(buttonContainer);
    } else {
        console.log(`No more repositories to load for ${login}`);
    }
    
    // MegjelenĂ­tjĂĽk a repository container-t
    repoContainer.style.display = 'block';
}

/**
 * LĂŠtrehoz egy repository kĂˇrtyĂˇt
 * @param {Object} repo A repository adatai
 * @returns {HTMLElement} A lĂŠtrehozott kĂˇrtya elem
 */
function createRepositoryCard(repo) {
    const formattedUpdateDate = new Date(repo.updated_at).toLocaleDateString();
    
    const repoCardContainer = document.createElement('div');
    repoCardContainer.className = 'dev-repo-card';
    
    repoCardContainer.innerHTML = `
        <div class="card">
            <div class="repo-image-container">
                <img src="${repo.image_url}" alt="${repo.name} repository image" class="repo-image">
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
    
    // README gomb esemĂŠnykezelĹ‘jĂŠnek hozzĂˇadĂˇsa
    const readmeBtn = repoCardContainer.querySelector('.btn-readme');
    readmeBtn.addEventListener('click', async () => {
        const owner = readmeBtn.getAttribute('data-owner');
        const repoName = readmeBtn.getAttribute('data-repo');
        try {
            // EllenĹ‘rizzĂĽk, hogy van-e token a GitHub API hĂ­vĂˇsokhoz
            const token = sessionStorage.getItem('oauth_github_token');
            const headers = token ? { 'Authorization': `token ${token}` } : {};
            
            // README lekĂŠrĂŠse
            const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/readme`, { headers });
            
            if (response.ok) {
                const data = await response.json();
                const rawResponse = await fetch(data.download_url);
                if (!rawResponse.ok) {
                    throw new Error('Failed to fetch README content');
                }
                const content = await rawResponse.text();
                showReadmePopup(content, owner, repoName);
            } else if (response.status === 404) {
                showReadmePopup('No README available for this repository.', owner, repoName);
            } else {
                throw new Error(`Failed to fetch README: ${response.status}`);
            }
        } catch (error) {
            console.error('Error fetching readme:', error);
            showReadmePopup(`Error loading README: ${error.message}`, owner, repoName);
        }
    });
    
    // Kedvencek gomb esemĂŠnykezelĹ‘jĂŠnek hozzĂˇadĂˇsa
    const favoriteBtn = repoCardContainer.querySelector('.btn-repo-favorite');
    checkAndSetupFavoriteButton(repo, favoriteBtn);
    
    return repoCardContainer;
}

/**
 * EllenĹ‘rzi Ă©s beĂˇllĂ­tja a kedvencek gomb ĂˇllapotĂˇt
 * @param {Object} repo A repository adatai
 * @param {HTMLElement} button A kedvencek gomb
 */
async function checkAndSetupFavoriteButton(repo, button) {
    // EllenĹ‘rizzĂĽk, hogy be van-e jelentkezve a felhasznĂˇlĂł
    if (!document.getElementById('user-info').classList.contains('d-none')) {
        try {
            // Kedvencek lekĂŠrĂŠse az adatbĂˇzisbĂłl
            const response = await fetch('check_favorite.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    repo_id: repo.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // BeĂˇllĂ­tjuk a gomb megjelenĂŠsĂŠt a kedvenc stĂˇtusz alapjĂˇn
                    if (data.isFavorite) {
                        button.style.setProperty('background-color', 'yellow', 'important');
                        button.textContent = '-Repo.';
                    }
                }
            }
        } catch (error) {
            console.error('Error checking favorite status:', error);
        }
    }
    
    // Kedvencek gomb esemĂŠnykezelĹ‘
    button.addEventListener('click', async () => {
        await saveRepositoryAsFavorite(repo, button);
    });
}

/**
 * Repository mentĂŠse kedvenckĂŠnt
 * @param {Object} repo A repository adatai
 * @param {HTMLElement} button A kedvencek gomb
 */
async function saveRepositoryAsFavorite(repo, button) {
    // EllenĹ‘rizzĂĽk, hogy be van-e jelentkezve a felhasznĂˇlĂł
    if (!document.getElementById('user-info').classList.contains('d-none')) {
        try {
            console.log('Checking favorite status for repository:', repo);
            
            // Repository statisztikĂˇk lekĂŠrĂŠse
            const owner = repo.owner.login;
            const repoName = repo.name;
            
            // Nyelvek lekĂŠrĂŠse
            const token = sessionStorage.getItem('oauth_github_token');
            const headers = token ? { 'Authorization': `token ${token}` } : {};
            
            const languagesResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/languages`, { headers });
            const languages = await languagesResponse.json();
            const languagesArray = Object.keys(languages).map(lang => ({
                name: lang,
                percentage: ((languages[lang] / Object.values(languages).reduce((a, b) => a + b, 0)) * 100).toFixed(1)
            }));
            
            // KĂ¶zremĹ±kĂ¶dĹ‘k szĂˇmĂˇnak lekĂŠrĂŠse
            const contributorsUrl = `https://api.github.com/repos/${owner}/${repoName}/contributors?per_page=1&anon=true`;
            const contributorsResponse = await fetch(contributorsUrl, { headers });
            
            // A Link header ellenĹ‘rzĂŠse az Ă¶sszes kĂ¶zremĹ±kĂ¶dĹ‘ szĂˇmĂˇhoz
            const contributorsLinkHeader = contributorsResponse.headers.get('Link');
            let contributorsCount = 0;
            
            if (contributorsLinkHeader) {
                // Ha van Link header, akkor tĂ¶bb oldal van
                const matches = contributorsLinkHeader.match(/page=(\d+)>; rel="last"/);
                if (matches) {
                    contributorsCount = parseInt(matches[1]);
                }
            } else {
                // Ha nincs Link header, akkor csak egy oldal van
                const contributors = await contributorsResponse.json();
                contributorsCount = Array.isArray(contributors) ? contributors.length : 0;
            }
            
            // Commitok szĂˇmĂˇnak lekĂŠrĂŠse
            const commitsUrl = `https://api.github.com/repos/${owner}/${repoName}/commits`;
            const commitsResponse = await fetch(commitsUrl, { headers });
            
            // A Link header ellenĹ‘rzĂŠse az Ă¶sszes oldal szĂˇmĂˇhoz
            const linkHeader = commitsResponse.headers.get('Link');
            let commitsCount = 0;
            
            if (linkHeader) {
                // Ha van Link header, akkor tĂ¶bb oldal van
                const matches = linkHeader.match(/page=(\d+)>; rel="last"/);
                if (matches) {
                    const lastPage = parseInt(matches[1]);
                    // Az utolsĂł oldal szĂˇma szorozva az oldalankĂŠnti elemszĂˇmmal (30 az alapĂŠrtelmezett)
                    commitsCount = (lastPage - 1) * 30;
                }
                // HozzĂˇadjuk az utolsĂł oldal commitjait
                const commits = await commitsResponse.json();
                commitsCount += Array.isArray(commits) ? commits.length : 0;
            } else {
                // Ha nincs Link header, akkor csak egy oldal van
                const commits = await commitsResponse.json();
                commitsCount = Array.isArray(commits) ? commits.length : 0;
            }
            
            // EllenĹ‘rizzĂĽk, hogy a projekt mĂˇr kedvenc-e
            const checkResponse = await fetch('check_favorite.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    repo_id: repo.id
                })
            });

            if (!checkResponse.ok) {
                throw new Error('Failed to check favorite status');
            }

            const checkData = await checkResponse.json();
            const { isFavorite } = checkData;

            // Projekt adatok elĹ‘kĂŠszĂ­tĂŠse
            const projectData = {
                repo_id: repo.id,
                name: repo.name,
                full_name: `${owner}/${repoName}`,
                description: repo.description || '',
                html_url: repo.html_url,
                owner: owner,
                owner_url: repo.owner.html_url,
                stars_count: repo.stargazers_count,
                forks_count: repo.forks_count,
                updated_at: repo.updated_at,
                contributors_count: contributorsCount,
                commits_count: commitsCount,
                languages: languagesArray
            };

            // Kedvenc hozzĂˇadĂˇsa vagy eltĂˇvolĂ­tĂˇsa
            const response = await fetch('add_favorite.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: isFavorite ? 'remove' : 'add',
                    repo_data: projectData
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update favorite');
            }

            const result = await response.json();

            if (result.success) {
                // Gomb megjelenĂŠsĂŠnek frissĂ­tĂŠse
                button.style.setProperty('background-color', !isFavorite ? 'yellow' : 'gray', 'important');
                button.textContent = !isFavorite ? '-Repo.' : '+Repo.';
            } else {
                throw new Error(result.message || 'Failed to update favorite');
            }

        } catch (error) {
            console.error('Error handling favorite:', error);
            alert('Error: ' + error.message);
        }
    } else {
        console.log('User not logged in');
        alert('Please log in to use the favorites feature');
    }
}

/**
 * MegjelenĂ­ti a README popup-ot
 * @param {string} content A README tartalma
 */
function showReadmePopup(content) {
    const existingPopup = document.getElementById('readme-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.id = 'readme-popup';
    popup.className = 'readme-popup';
    
    const popupContent = document.createElement('div');
    popupContent.className = 'readme-content';
    
    // Markdown formĂˇzĂˇs, ha a marked kĂ¶nyvtĂˇr elĂ©rhetĹ‘
    let renderedContent = content;
    if (typeof marked !== 'undefined') {
        renderedContent = marked.parse(content);
    }
    
    popupContent.innerHTML = `
        <div class="readme-header">
            <h3>README</h3>
            <button class="close-popup"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="readme-body markdown-body">
            ${renderedContent}
        </div>
    `;
    
    popup.appendChild(popupContent);
    document.body.appendChild(popup);
    
    popup.querySelector('.close-popup').addEventListener('click', () => {
        popup.remove();
    });
    
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.remove();
        }
    });
}

/**
 * InicializĂˇlja a repository slider-t
 * @param {HTMLElement} card A fejlesztĹ‘ kĂˇrtya
 */
function initRepositorySlider(card) {
    const slider = card.querySelector('.dev-repositories-slider');
    const prevBtn = card.querySelector('.dev-repo-nav.prev');
    const nextBtn = card.querySelector('.dev-repo-nav.next');
    
    if (!slider || !prevBtn || !nextBtn) return;
    
    // Alaphelyzetbe ĂˇllĂ­tjuk a slider pozĂ­ciĂłjĂˇt
    slider.style.transform = 'translateX(0)';
    
    // BeĂˇllĂ­tjuk a gombok kezdeti lĂˇthatĂłsĂˇgĂˇt
    const repoCards = slider.querySelectorAll('.dev-repo-card');
    const visibleCards = 3; // Egyszerre lĂˇthatĂł kĂˇrtyĂˇk szĂˇma
    
    prevBtn.style.display = 'none'; // Kezdetben mindig az elsĹ‘ pozĂ­ciĂłban vagyunk
    nextBtn.style.display = repoCards.length <= visibleCards ? 'none' : 'flex';
}

/**
 * Kezeli a repository slider navigĂˇciĂłs gombjainak kattintĂˇsait
 * @param {Event} event Az esemĂŠny objektum
 */
function handleRepositoryNavigation(event) {
    // EllenĹ‘rizzĂĽk, hogy a kattintĂˇs egy navigĂˇciĂłs gombra tĂ¶rtĂŠnt-e
    if (event.target.closest('.dev-repo-nav')) {
        const navButton = event.target.closest('.dev-repo-nav');
        const isNext = navButton.classList.contains('next');
        const repoContainer = navButton.closest('.dev-repositories-container');
        
        if (!repoContainer) return;
        
        const slider = repoContainer.querySelector('.dev-repositories-slider');
        if (!slider) return;
        
        const repoCards = slider.querySelectorAll('.dev-repo-card');
        const cardWidth = repoCards.length > 0 ? repoCards[0].offsetWidth : 0;
        const visibleCards = 3; // Egyszerre lĂˇthatĂł kĂˇrtyĂˇk szĂˇma
        const maxPosition = Math.max(0, repoCards.length - visibleCards);
        
        // LekĂŠrjĂĽk az aktuĂˇlis pozĂ­ciĂłt a transform tulajdonsĂˇgbĂłl
        let currentPosition = 0;
        const transformValue = slider.style.transform;
        if (transformValue) {
            const match = transformValue.match(/translateX\(-?(\d+)px\)/);
            if (match && match[1]) {
                currentPosition = parseInt(match[1]) / cardWidth;
            }
        }
        
        // FrissĂ­tjĂĽk a pozĂ­ciĂłt a kattintĂˇs irĂˇnyĂˇnak megfelelĹ‘en
        if (isNext && currentPosition < maxPosition) {
            currentPosition++;
        } else if (!isNext && currentPosition > 0) {
            currentPosition--;
        }
        
        // FrissĂ­tjĂĽk a slider pozĂ­ciĂłjĂˇt
        slider.style.transform = `translateX(-${currentPosition * cardWidth}px)`;
        
        // FrissĂ­tjĂĽk a gombok lĂˇthatĂłsĂˇgĂˇt
        const prevBtn = repoContainer.querySelector('.dev-repo-nav.prev');
        const nextBtn = repoContainer.querySelector('.dev-repo-nav.next');
        
        if (prevBtn) prevBtn.style.display = currentPosition === 0 ? 'none' : 'flex';
        if (nextBtn) nextBtn.style.display = currentPosition >= maxPosition ? 'none' : 'flex';
    }
}

/**
 * EltĂˇvolĂ­t egy fejlesztĹ‘t a kedvencek kĂ¶zĂĽl
 * @param {string} login A fejlesztĹ‘ bejelentkezĂŠsi neve
 * @param {HTMLElement} card A fejlesztĹ‘ kĂˇrtya
 */
async function removeDeveloperFromFavorites(login, card) {
    try {
        const response = await fetch('remove_favorite_developer.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `owner=${encodeURIComponent(login)}`
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to remove developer from favorites');
        }
        
        // AnimĂˇljuk a kĂˇrtya eltĂˇvolĂ­tĂˇsĂˇt
        card.style.opacity = '0';
        card.style.height = '0';
        card.style.margin = '0';
        card.style.padding = '0';
        card.style.transition = 'all 0.5s ease';
        
        // EltĂˇvolĂ­tjuk a kĂˇrtyĂˇt a DOM-bĂłl az animĂˇciĂł utĂˇn
        setTimeout(() => {
            card.remove();
            
            // FrissĂ­tjĂĽk a fejlesztĹ‘k szĂˇmĂˇt
            // updateDevelopersCount();
            
            // EllenĹ‘rizzĂĽk, hogy van-e mĂŠg fejlesztĹ‘ a listĂˇban
            const remainingCards = developerListContainer.querySelectorAll('.developer-card');
            if (remainingCards.length === 0) {
                showEmptyDeveloperList();
            }
        }, 500);
    } catch (error) {
        console.error('Error removing developer from favorites:', error);
        alert('An error occurred while removing the developer from favorites');
    }
}

/**
 * MegjelenĂ­ti az ĂĽres fejlesztĹ' listĂˇt
 */
function showEmptyDeveloperList() {
    if (!developerListContainer) {
        createDeveloperListContainer();
        
        if (!developerListContainer) {
            console.error('Could not create developer list container');
            return;
        }
    }
    
    developerListContainer.innerHTML = `
        <div class="alert alert-info" role="alert">
            <h4 class="alert-heading">No Favorite Developers</h4>
            <p>You don't have any favorite developers yet. Search for repositories and add developers to your favorites!</p>
        </div>
    `;
}

/**
 * MegjelenĂ­ti a hibaĂĽzenetet
 * @param {string} message A hibaĂĽzenet
 */
function showErrorMessage(message) {
    if (!developerListContainer) {
        createDeveloperListContainer();
        
        if (!developerListContainer) {
            console.error('Could not create developer list container to show error:', message);
            alert('Error: ' + message);
            return;
        }
    }
    
    developerListContainer.innerHTML = `
        <div class="alert alert-danger" role="alert">
            <h4 class="alert-heading">Error</h4>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Kezeli a "Load More" gomb megjelenĂ­tĂŠsĂŠt Ă©s mĹ±kĂ¶dĂŠsĂŠt
 */
function handleLoadMoreDevelopersButton() {
    // EltĂˇvolĂ­tjuk a meglĂŠvĹ‘ gombot, ha van
    const existingButton = document.getElementById('load-more-developers');
    if (existingButton) {
        existingButton.remove();
    }
    
    // EllenĹ‘rizzĂĽk, hogy van-e mĂŠg tĂ¶bb fejlesztĹ‘
    const startIndex = currentDevelopersPage * developersPerPage;
    if (startIndex < allDevelopers.length) {
        // LĂŠtrehozzuk a "Load More" gombot
        loadMoreDevelopersButton = document.createElement('button');
        loadMoreDevelopersButton.id = 'load-more-developers';
        loadMoreDevelopersButton.className = 'btn btn-primary mt-3 mb-4';
        loadMoreDevelopersButton.textContent = 'Load More';
        
        // EsemĂŠnykezelĹ‘ hozzĂˇadĂˇsa
        loadMoreDevelopersButton.addEventListener('click', loadMoreDevelopers);
        
        // HozzĂˇadjuk a DOM-hoz
        developerListContainer.appendChild(loadMoreDevelopersButton);
    }
}

/**
 * BetĂ¶lti a kĂ¶vetkezĹ‘ oldalnyi fejlesztĹ‘t
 */
function loadMoreDevelopers() {
    // Gomb ĂˇllapotĂˇnak mĂłdosĂ­tĂˇsa
    loadMoreDevelopersButton.disabled = true;
    loadMoreDevelopersButton.textContent = 'Loading...';
    
    // NĂ¶veljĂĽk az oldalszĂˇmot
    currentDevelopersPage++;
    
    // KĂŠsleltetĂŠs a betĂ¶ltĂŠs szimulĂˇlĂˇsĂˇra (opcionĂˇlis)
    setTimeout(() => {
        // BetĂ¶ltjĂĽk a kĂ¶vetkezĹ‘ oldalt
        renderDeveloperList(allDevelopers, false);
        
        // GĂ¶rgetĂŠs a legutĂłbb betĂ¶ltĂ¶tt kĂˇrtyĂˇkhoz
        const cards = document.querySelectorAll('.developer-card');
        if (cards.length > 0) {
            const lastVisibleCardIndex = Math.min((currentDevelopersPage - 1) * developersPerPage, cards.length - 1);
            cards[lastVisibleCardIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 500);
}

/**
 * MegjelenĂ­ti a fejlesztĹ‘k listĂˇjĂˇt
 * @param {Array} developers A fejlesztĹ‘k listĂˇja
 */
// Ez a függvény-definíció nem szükséges, mert már van egy teljesebb renderDeveloperList függvényünk
// Eltávolítjuk ezt a redundáns kódrészt
// function renderDeveloperList(developers) {
//     // FejlĂŠc lĂŠtrehozĂˇsa
//     developerListContainer.innerHTML = `
//         <div class="developer-list-header">
//             <h3>My Favorite Developers</h3>
//         </div>
//         <div id="developer-cards-container"></div>
//     `;
//     
//     const cardsContainer = document.getElementById('developer-cards-container');
//     
//     // FejlesztĹ‘k megjelenĂ­tĂŠse
//     developers.forEach(developer => {
//         const card = createDeveloperCard(developer);
//         cardsContainer.appendChild(card);
//     });
//     
//     // EsemĂŠnykezelĹ‘k inicializĂˇlĂˇsa
//     initDeveloperCardEvents();
// }

/**
 * BetĂ¶lti egy fejlesztĹ‘ csillagozott repository-jait
 * @param {string} login A fejlesztĹ‘ login neve
 * @param {boolean} reset Ha true, akkor Ăşjrakezdi a betĂ¶ltĂŠst az elsĹ‘ oldaltĂłl
 * @returns {Promise<Array>} A csillagozott repository-k listĂˇja
 */
async function loadDeveloperStarredList(login, reset = false) {
    try {
        // Initialize or reset pagination info for this developer
        if (!starredReposPagination[login] || reset) {
            starredReposPagination[login] = { page: 1, hasMore: true };
            
            // If reset, clear existing data
            if (reset) {
                developerStarredRepoData[login] = [];
            }
        }
        
        // If there are no more pages, return the current data
        if (!starredReposPagination[login].hasMore && !reset) {
            return developerStarredRepoData[login] || [];
        }
        
        // EllenĹ‘rizzĂĽk, hogy van-e token a GitHub API hĂ­vĂˇsokhoz
        const token = sessionStorage.getItem('oauth_github_token');
        const headers = token ? { 'Authorization': `token ${token}` } : {};
        
        // LekĂŠrjĂĽk a csillagozott repository-kat az aktuĂˇlis oldalrĂłl
        const page = starredReposPagination[login].page;
        const response = await fetch(`https://api.github.com/users/${login}/starred?sort=updated&per_page=${starredReposPerPage}&page=${page}`, { headers });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch starred repositories for ${login}`);
        }
        
        const starredRepos = await response.json();
        console.log(`Starred repositories for ${login} (page ${page}):`, starredRepos);
        
        // Check if there are more pages
        const linkHeader = response.headers.get('Link');
        starredReposPagination[login].hasMore = linkHeader && linkHeader.includes('rel="next"');
        
        // Process the repositories
        const processedRepos = starredRepos.map(repo => {
            // AlapĂŠrtelmezett kĂŠp a GitHub OpenGraph kĂŠp
            const repoImage = `https://opengraph.githubassets.com/${Date.now()}/${repo.owner.login}/${repo.name}`;
            
            return {
                id: repo.id,
                name: repo.name,
                description: repo.description,
                html_url: repo.html_url,
                stargazers_count: repo.stargazers_count,
                forks_count: repo.forks_count,
                language: repo.language,
                updated_at: repo.updated_at,
                image_url: repoImage,
                owner: {
                    login: repo.owner.login,
                    avatar_url: repo.owner.avatar_url,
                    html_url: repo.owner.html_url
                }
            };
        });
        
        // Initialize or append to the existing data
        if (!developerStarredRepoData[login]) {
            developerStarredRepoData[login] = processedRepos;
        } else {
            developerStarredRepoData[login] = [...developerStarredRepoData[login], ...processedRepos];
        }
        
        // Update the total count on the button
        const totalCount = await fetchStarredCount(login);
        updateStarredCount(login, totalCount);
        
        // Increment the page for next load
        starredReposPagination[login].page++;
        
        return developerStarredRepoData[login];
    } catch (error) {
        console.error(`Error loading starred repositories for ${login}:`, error);
        updateStarredCount(login, '?');
        throw error;
    }
}

/**
 * FrissĂ­ti a csillagozott repository-k szĂˇmĂˇt a gombon
 * @param {string} login A fejlesztĹ‘ login neve
 * @param {number|string} count A csillagozott repository-k szĂˇma
 */
function updateStarredCount(login, count) {
    const countElements = document.querySelectorAll(`.starred-count[data-login="${login}"]`);
    countElements.forEach(element => {
        element.textContent = count;
    });
}

/**
 * MegjelenĂ­ti egy fejlesztĹ‘ csillagozott repository-jait
 * @param {string} login A fejlesztĹ‘ login neve
 * @param {HTMLElement} card A fejlesztĹ‘ kĂˇrtya
 * @param {boolean} append Ha true, akkor hozzĂˇfĹ±zi az Ăşj elemeket a meglĂŠvĹ‘khĂ¶z
 */
function renderDeveloperStarredList(login, card, append = false) {
    const starredRepos = developerStarredRepoData[login];
    if (!starredRepos || starredRepos.length === 0) {
        const starredListContainer = card.querySelector('.starred-list-container');
        starredListContainer.innerHTML = `
            <div class="text-center p-4">
                <p>No starred repositories found for this developer.</p>
            </div>
        `;
        return;
    }
    
    // MegkeressĂĽk a starred list container-t
    const starredListContainer = card.querySelector('.starred-list-container');
    
    // Ha ez az elsĹ‘ betĂ¶ltĂŠs, akkor inicializĂˇljuk a container-t
    if (!append) {
        starredListContainer.innerHTML = `
            <div class="starred-repositories-slider"></div>
        `;
    }
    
    // LĂŠtrehozzuk vagy megkeressĂĽk a slider-t
    const slider = starredListContainer.querySelector('.starred-repositories-slider');
    
    // Ha append mĂłd, akkor csak az Ăşj elemeket adjuk hozzĂˇ
    if (append) {
        const existingCount = slider.querySelectorAll('.starred-repo-card').length;
        const newRepos = starredRepos.slice(existingCount);
        
        // HozzĂˇadjuk az Ăşj starred repository kĂˇrtyĂˇkat
        newRepos.forEach(repo => {
            const repoCard = createStarredRepositoryCard(repo);
            slider.appendChild(repoCard);
        });
    } else {
        // HozzĂˇadjuk a starred repository kĂˇrtyĂˇkat
        starredRepos.forEach(repo => {
            const repoCard = createStarredRepositoryCard(repo);
            slider.appendChild(repoCard);
        });
    }
    
    // EltĂˇvolĂ­tjuk a meglĂŠvĹ‘ "Load More" gombot, ha van
    const existingLoadMoreBtnContainer = starredListContainer.querySelector('.load-more-btn-container');
    if (existingLoadMoreBtnContainer) {
        existingLoadMoreBtnContainer.remove();
    }
    
    // Ha van mĂŠg tĂ¶bb betĂ¶lthetĹ‘ repository, akkor megjelenĂ­tjĂĽk a "Load More" gombot
    if (starredReposPagination[login] && starredReposPagination[login].hasMore) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'btn btn-primary load-more-starred-btn mt-3';
        loadMoreBtn.textContent = 'Load More Starred Repositories';
        loadMoreBtn.dataset.login = login;
        
        // EsemĂŠnykezelĹ‘ hozzĂˇadĂˇsa
        loadMoreBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            await loadMoreStarredRepositories(login, card);
        });
        
        // LĂŠtrehozunk egy kontĂŠnert a gombnak, hogy kĂ¶zĂŠpre igazĂ­tsuk
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'text-center mt-4 mb-3 load-more-btn-container';
        buttonContainer.appendChild(loadMoreBtn);
        
        // HozzĂˇadjuk a container-hez
        starredListContainer.appendChild(buttonContainer);
    }
}

/**
 * LĂŠtrehoz egy starred repository kĂˇrtyĂˇt
 * @param {Object} repo A starred repository adatai
 * @returns {HTMLElement} A lĂŠtrehozott kĂˇrtya elem
 */
function createStarredRepositoryCard(repo) {
    const formattedUpdateDate = new Date(repo.updated_at).toLocaleDateString();
    
    const repoCardContainer = document.createElement('div');
    repoCardContainer.className = 'starred-repo-card';
    
    repoCardContainer.innerHTML = `
        <div class="card">
            <div class="repo-image-container">
                <img src="${repo.image_url}" alt="${repo.name} repository image" class="repo-image">
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
    
    // README gomb esemĂŠnykezelĹ‘jĂŠnek hozzĂˇadĂˇsa
    const readmeBtn = repoCardContainer.querySelector('.btn-readme');
    readmeBtn.addEventListener('click', async () => {
        const owner = readmeBtn.getAttribute('data-owner');
        const repoName = readmeBtn.getAttribute('data-repo');
        try {
            // EllenĹ‘rizzĂĽk, hogy van-e token a GitHub API hĂ­vĂˇsokhoz
            const token = sessionStorage.getItem('oauth_github_token');
            const headers = token ? { 'Authorization': `token ${token}` } : {};
            
            // README lekĂŠrĂŠse
            const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/readme`, { headers });
            
            if (response.ok) {
                const data = await response.json();
                const rawResponse = await fetch(data.download_url);
                if (!rawResponse.ok) {
                    throw new Error('Failed to fetch README content');
                }
                const content = await rawResponse.text();
                showReadmePopup(content, owner, repoName);
            } else if (response.status === 404) {
                showReadmePopup('No README available for this repository.', owner, repoName);
            } else {
                throw new Error(`Failed to fetch README: ${response.status}`);
            }
        } catch (error) {
            console.error('Error fetching readme:', error);
            showReadmePopup(`Error loading README: ${error.message}`, owner, repoName);
        }
    });
    
    // Kedvencek gomb esemĂŠnykezelĹ‘jĂŠnek hozzĂˇadĂˇsa
    const favoriteBtn = repoCardContainer.querySelector('.btn-repo-favorite');
    favoriteBtn.addEventListener('click', async () => {
        await saveRepositoryAsFavorite(repo, favoriteBtn);
    });
    
    // Ellenőrizzük, hogy a repository már kedvenc-e
    checkRepositoryFavoriteStatus(repo, repoCardContainer.querySelector('.btn-repo-favorite'));

    return repoCardContainer;
}

/**
 * InicializĂˇlja a starred repository slider-t
 * @param {HTMLElement} card A fejlesztĹ‘ kĂˇrtya
 */
function initStarredRepositorySlider(card) {
    const slider = card.querySelector('.starred-repositories-slider');
    const prevBtn = card.querySelector('.starred-repo-nav.prev');
    const nextBtn = card.querySelector('.starred-repo-nav.next');
    
    if (!slider || !prevBtn || !nextBtn) return;
    
    // ElrejtjĂĽk a navigĂˇciĂłs gombokat, mivel most mĂˇr tĂ¶bb sorban jelennek meg a kĂˇrtyĂˇk
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
}

/**
 * Kezeli a starred repository slider navigĂˇciĂłs gombjainak kattintĂˇsait
 * @param {Event} event Az esemĂŠny objektum
 */
function handleStarredRepositoryNavigation(event) {
    // Mivel a kĂˇrtyĂˇk most mĂˇr tĂ¶bb sorban jelennek meg, ez a funkĂ­Ăł nem szĂĽksĂŠges
    // De megtartjuk a kompatibilitĂˇs miatt, csak nem csinĂˇlunk benne semmit
    return;
}

/**
 * BetĂ¶lti a kĂ¶vetkezĹ‘ oldalnyi csillagozott repository-t
 * @param {string} login A fejlesztĹ‘ login neve
 * @param {HTMLElement} card A fejlesztĹ‘ kĂˇrtya
 */
async function loadMoreStarredRepositories(login, card) {
    try {
        // MegkeressĂĽk a "Load More" gombot
        const loadMoreBtn = card.querySelector('.load-more-starred-btn');
        if (loadMoreBtn) {
            // FrissĂ­tjĂĽk a gomb ĂˇllapotĂˇt
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Loading...';
        }
        
        // BetĂ¶ltjĂĽk a kĂ¶vetkezĹ‘ oldalt
        await loadDeveloperStarredList(login);
        
        // FrissĂ­tjĂĽk a megjelenĂ­tĂŠst
        renderDeveloperStarredList(login, card, true);
        
    } catch (error) {
        console.error(`Error loading more starred repositories for ${login}:`, error);
        alert(`Failed to load more repositories: ${error.message}`);
        
        // VisszaĂˇllĂ­tjuk a gomb ĂˇllapotĂˇt
        const loadMoreBtn = card.querySelector('.load-more-starred-btn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Load More Starred Repositories';
            
            // Hibaüzenet megjelenítése
            const errorMsg = document.createElement('div');
            errorMsg.className = 'alert alert-danger mt-2';
            errorMsg.textContent = `Error loading more repositories: ${error.message}`;
            loadMoreBtn.parentNode.appendChild(errorMsg);
            
            // Hibaüzenet eltávolítása 5 másodperc után
            setTimeout(() => {
                if (errorMsg.parentNode) {
                    errorMsg.parentNode.removeChild(errorMsg);
                }
            }, 5000);
        }
    }
}

/**
 * FrissĂ­ti a fejlesztĹ‘k szĂˇmĂˇt
 */
function updateDevelopersCount() {
    // const developersCountElement = document.getElementById('developers-count');
    // if (developersCountElement) {
    //     fetch('get_favorite_developers.php')
    //         .then(response => response.json())
    //         .then(data => {
    //             if (data.success && Array.isArray(data.developers)) {
    //                 const developersCount = data.developers.length.toString();
    //                 developersCountElement.textContent = developersCount;
                    
    //                 // Frissítjük a total-count számlálót is, ha a fejlesztők szekció aktív
    //                 const developersInfo = document.querySelector('#developers-info').closest('.card');
    //                 if (developersInfo && developersInfo.style.display !== 'none') {
    //                     const totalCountElement = document.getElementById('total-count');
    //                     if (totalCountElement) {
    //                         totalCountElement.textContent = developersCount;
    //                     }
    //                 }
                    
    //                 // Update the allDevelopers array with the fetched data
    //                 allDevelopers = data.developers;
    //             }
    //         })
    //         .catch(error => {
    //             console.error('Error updating developers count:', error);
    //         });
    // }
}

/**
 * LekĂŠri egy fejlesztĹ‘ csillagozott repository-inak szĂˇmĂˇt
 * @param {string} login A fejlesztĹ‘ login neve
 * @returns {Promise<number>} A csillagozott repository-k szĂˇma
 */
async function fetchStarredCount(login) {
    try {
        // EllenĹ‘rizzĂĽk, hogy van-e token a GitHub API hĂ­vĂˇsokhoz
        const token = sessionStorage.getItem('oauth_github_token');
        const headers = token ? { 'Authorization': `token ${token}` } : {};
        
        // LekĂŠrjĂĽk a csillagozott repository-k szĂˇmĂˇt
        const response = await fetch(`https://api.github.com/users/${login}/starred?per_page=1`, { 
            headers,
            method: 'HEAD'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch starred count for ${login}`);
        }
        
        // A Link header tartalmazza a lapozĂˇsi informĂˇciĂłkat, amibĹ‘l kiszĂˇmolhatjuk a teljes szĂˇmot
        const linkHeader = response.headers.get('Link');
        if (linkHeader && linkHeader.includes('rel="last"')) {
            const match = linkHeader.match(/page=(\d+)>; rel="last"/);
            if (match && match[1]) {
                const totalPages = parseInt(match[1]);
                // Mivel a per_page=1, ezĂ©rt a lapok szĂˇma megegyezik a repository-k szĂˇmĂˇval
                updateStarredCount(login, totalPages);
                return totalPages;
            }
        }
        
        // Ha nincs Link header vagy nincs benne last, akkor csak 1 oldal van
        // Ez azt jelenti, hogy 0 vagy 1 repository van
        const count = response.status === 200 ? 1 : 0;
        updateStarredCount(login, count);
        return count;
    } catch (error) {
        console.error(`Error fetching starred count for ${login}:`, error);
        // Hiba esetĂŠn nem frissĂ­tjĂĽk a szĂˇmot, marad az alapĂŠrtelmezett
        return 0;
    }
}

/**
 * InicializĂˇlja a starred repository slider-t
 * @param {HTMLElement} card A fejlesztĹ‘ kĂˇrtya
 */
function initStarredRepositorySlider(card) {
    const slider = card.querySelector('.starred-repositories-slider');
    const prevBtn = card.querySelector('.starred-repo-nav.prev');
    const nextBtn = card.querySelector('.starred-repo-nav.next');
    
    if (!slider || !prevBtn || !nextBtn) return;
    
    // ElrejtjĂĽk a navigĂˇciĂłs gombokat, mivel most mĂˇr tĂ¶bb sorban jelennek meg a kĂˇrtyĂˇk
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
}

/**
 * Ellenőrzi, hogy egy repository szerepel-e a felhasználó kedvencei között
 * @param {Object} repo A repository adatai
 * @param {HTMLElement} button A kedvencek gomb
 */
async function checkRepositoryFavoriteStatus(repo, button) {
    // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
    if (!document.getElementById('user-info').classList.contains('d-none')) {
        try {
            // Kedvencek lekérése az adatbázisból
            const response = await fetch('check_favorite.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    repo_id: repo.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Beállítjuk a gomb megjelenését a kedvenc státusz alapján
                    if (data.isFavorite) {
                        button.style.setProperty('background-color', 'yellow', 'important');
                        button.textContent = '-Repo.';
                    }
                }
            }
        } catch (error) {
            console.error('Error checking favorite status:', error);
        }
    }
}

/**
 * További repository-k betöltése egy fejlesztőhöz
 * @param {string} login A fejlesztő login neve
 * @param {HTMLElement} card A fejlesztő kártya
 * @returns {Promise<void>}
 */
async function loadMoreDeveloperRepositories(login, card) {
    try {
        // Megkeressük a betöltő gombot és frissítjük az állapotát
        const loadMoreBtn = card.querySelector('.load-more-repos-btn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Loading...';
        }
        
        // Betöltjük a következő oldalt
        await loadDeveloperRepositories(login);
        
        // Frissítjük a megjelenítést
        renderDeveloperRepositories(login, card, true);
    } catch (error) {
        console.error(`Error loading more repositories for ${login}:`, error);
        
        // Hiba esetén frissítjük a gomb állapotát
        const loadMoreBtn = card.querySelector('.load-more-repos-btn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Load More Developer Repositories';
            
            // Hibaüzenet megjelenítése
            const errorMsg = document.createElement('div');
            errorMsg.className = 'alert alert-danger mt-2';
            errorMsg.textContent = `Error loading more repositories: ${error.message}`;
            loadMoreBtn.parentNode.appendChild(errorMsg);
            
            // Hibaüzenet eltávolítása 5 másodperc után
            setTimeout(() => {
                if (errorMsg.parentNode) {
                    errorMsg.parentNode.removeChild(errorMsg);
                }
            }, 5000);
        }
    }
}
/**
 * Megjeleníti a README popup-ot
 * @param {string} content A README tartalma
 * @param {string} owner A repository tulajdonosa
 * @param {string} repo A repository neve
 */
function showReadmePopup(content, owner, repo) {
    const existingPopup = document.getElementById('readme-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.id = 'readme-popup';
    popup.className = 'readme-popup';
    
    const popupContent = document.createElement('div');
    popupContent.className = 'readme-content';
    
    // Markdown formázás, ha a marked könyvtár elérhető
    let renderedContent = content;
    if (typeof marked !== 'undefined') {
        renderedContent = marked.parse(content);
    }
    
    // Ideiglenes div a HTML tartalom kezeléséhez
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderedContent;
    
    // Képek és videók relatív hivatkozásainak javítása
    if (typeof fixRelativeUrls === 'function' && owner && repo) {
        fixRelativeUrls(tempDiv, owner, repo);
    }
    
    popupContent.innerHTML = `
        <div class="readme-header">
            <h3>README</h3>
            <button class="close-popup"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="readme-body markdown-body">
            ${tempDiv.innerHTML}
        </div>
    `;
    
    popup.appendChild(popupContent);
    document.body.appendChild(popup);
    
    popup.querySelector('.close-popup').addEventListener('click', () => {
        popup.remove();
    });
    
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.remove();
        }
    });
}/**
 * Visszaadja a GitHub OAuth token-t
 * Csak az OAuth token-t használja, a régi API kulcsot már nem
 * @returns {string|null} A GitHub OAuth token vagy null, ha nincs token
 */
function getGitHubToken() {
    return sessionStorage.getItem('oauth_github_token');
}

/**
 * Létrehoz egy headers objektumot a GitHub API hívásokhoz
 * @returns {Object} Headers objektum a GitHub API hívásokhoz
 */
function getGitHubHeaders() {
    const token = getGitHubToken();
    return token ? { 'Authorization': `token ${token}` } : {};
}/**
 * Lekéri egy repository README fájlját
 * @param {string} owner A repository tulajdonosa
 * @param {string} repoName A repository neve
 * @returns {Promise<string>} A README tartalma
 */
async function fetchRepositoryReadme(owner, repoName) {
    try {
        // Használjuk az új getGitHubHeaders függvényt a megfelelő hitelesítéshez
        const headers = getGitHubHeaders();
        
        // README lekérése
        const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/readme`, { headers });
        
        if (response.ok) {
            const data = await response.json();
            const rawResponse = await fetch(data.download_url);
            if (!rawResponse.ok) {
                throw new Error('Failed to fetch README content');
            }
            return await rawResponse.text();
        } else if (response.status === 404) {
            return 'No README available for this repository.';
        } else {
            throw new Error(`Failed to fetch README: ${response.status}`);
        }
    } catch (error) {
        console.error('Error fetching readme:', error);
        throw error;
    }
}/**
 * README gomb eseménykezelője
 * @param {Event} event Az esemény objektum
 */
async function handleReadmeButtonClick(event) {
    const readmeBtn = event.currentTarget;
    const owner = readmeBtn.getAttribute('data-owner');
    const repoName = readmeBtn.getAttribute('data-repo');
    
    try {
        const content = await fetchRepositoryReadme(owner, repoName);
        showReadmePopup(content, owner, repoName);
    } catch (error) {
        console.error('Error fetching readme:', error);
        showReadmePopup(`Error loading README: ${error.message}`, owner, repoName);
    }
}/**
 * Inicializálja a README gombokat az összes repository kártyán
 * Ezt a függvényt a dokumentum betöltése után kell meghívni
 */
function initializeReadmeButtons() {
    // Összes README gomb kiválasztása
    const readmeButtons = document.querySelectorAll('.btn-readme');
    
    // Eseménykezelők hozzárendelése minden gombhoz
    readmeButtons.forEach(button => {
        // Eltávolítjuk a régi eseménykezelőket
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Hozzáadjuk az új eseménykezelőt
        newButton.addEventListener('click', handleReadmeButtonClick);
    });
    
    console.log(`Initialized ${readmeButtons.length} README buttons with new event handlers`);
}

// A dokumentum betöltése után inicializáljuk a README gombokat
document.addEventListener('DOMContentLoaded', function() {
    // Meghívjuk az inicializáló függvényt
    initializeReadmeButtons();
    
    // Figyelünk a DOM változásaira, hogy az újonnan hozzáadott gombokat is inicializáljuk
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                // Ellenőrizzük, hogy van-e új README gomb
                const newButtons = document.querySelectorAll('.btn-readme:not([data-initialized])');
                if (newButtons.length > 0) {
                    newButtons.forEach(button => {
                        button.setAttribute('data-initialized', 'true');
                        button.addEventListener('click', handleReadmeButtonClick);
                    });
                    console.log(`Initialized ${newButtons.length} new README buttons`);
                }
            }
        });
    });
    
    // Figyeljük a teljes dokumentumot
    observer.observe(document.body, { childList: true, subtree: true });
});/**
 * Inicializálja a README gombokat az összes meglévő repository kártyán
 * Ezt a függvényt a renderDeveloperStarredList és renderDeveloperReposList után kell meghívni
 */
function initializeExistingReadmeButtons() {
    // Összes meglévő README gomb kiválasztása
    const existingButtons = document.querySelectorAll('.btn-readme:not([data-initialized])');
    
    // Eseménykezelők hozzárendelése minden gombhoz
    existingButtons.forEach(button => {
        button.setAttribute('data-initialized', 'true');
        
        // Eltávolítjuk a régi eseménykezelőket (klónozással)
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Hozzáadjuk az új eseménykezelőt
        newButton.addEventListener('click', handleReadmeButtonClick);
    });
    
    console.log(`Initialized ${existingButtons.length} existing README buttons`);
}/**
 * Felülírjuk a loadDeveloperStarredList függvényt, hogy inicializálja a README gombokat
 * Az eredeti loadDeveloperStarredList függvény a developer_list.js fájlban található
 */
const originalLoadDeveloperStarredList = loadDeveloperStarredList;

loadDeveloperStarredList = async function(login, card, reset = false) {
    // Meghívjuk az eredeti függvényt
    await originalLoadDeveloperStarredList(login, card, reset);
    
    // Inicializáljuk a README gombokat
    setTimeout(() => {
        initializeExistingReadmeButtons();
    }, 100);
};/**
 * Felülírjuk a loadMoreStarredRepositories függvényt, hogy inicializálja a README gombokat
 * Az eredeti loadMoreStarredRepositories függvény a developer_list.js fájlban található
 */
const originalLoadMoreStarredRepositories = loadMoreStarredRepositories;

loadMoreStarredRepositories = async function(login, card) {
    // Meghívjuk az eredeti függvényt
    await originalLoadMoreStarredRepositories(login, card);
    
    // Inicializáljuk a README gombokat
    setTimeout(() => {
        initializeExistingReadmeButtons();
    }, 100);
};/**
 * Visszaadja a GitHub OAuth token-t
 * Csak az OAuth token-t használja, a régi API kulcsot már nem
 * @returns {string|null} A GitHub OAuth token vagy null, ha nincs token
 */
function getOAuthToken() {
    return sessionStorage.getItem('oauth_github_token');
}

/**
 * Létrehoz egy headers objektumot a GitHub API hívásokhoz csak OAuth token használatával
 * @returns {Object} Headers objektum a GitHub API hívásokhoz
 */
function getOAuthHeaders() {
    const token = getOAuthToken();
    return token ? { 'Authorization': `token ${token}` } : {};
}/**
 * Lekéri egy repository README fájlját csak OAuth token használatával
 * @param {string} owner A repository tulajdonosa
 * @param {string} repoName A repository neve
 * @returns {Promise<string>} A README tartalma
 */
async function fetchRepositoryReadmeOAuth(owner, repoName) {
    try {
        // Csak OAuth tokent használunk
        const headers = getOAuthHeaders();
        
        // README lekérése
        const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/readme`, { headers });
        
        if (response.ok) {
            const data = await response.json();
            const rawResponse = await fetch(data.download_url);
            if (!rawResponse.ok) {
                throw new Error('Failed to fetch README content');
            }
            return await rawResponse.text();
        } else if (response.status === 404) {
            return 'No README available for this repository.';
        } else {
            throw new Error(`Failed to fetch README: ${response.status}`);
        }
    } catch (error) {
        console.error('Error fetching readme:', error);
        throw error;
    }
}/**
 * README gomb eseménykezelője csak OAuth token használatával
 * @param {Event} event Az esemény objektum
 */
async function handleReadmeButtonClickOAuth(event) {
    const readmeBtn = event.currentTarget;
    const owner = readmeBtn.getAttribute('data-owner');
    const repoName = readmeBtn.getAttribute('data-repo');
    
    try {
        const content = await fetchRepositoryReadmeOAuth(owner, repoName);
        showReadmePopup(content, owner, repoName);
    } catch (error) {
        console.error('Error fetching readme:', error);
        showReadmePopup(`Error loading README: ${error.message}`, owner, repoName);
    }
}/**
 * Inicializálja a README gombokat az összes repository kártyán csak OAuth token használatával
 * Ezt a függvényt a dokumentum betöltése után kell meghívni
 */
function initializeReadmeButtonsOAuth() {
    // Összes README gomb kiválasztása
    const readmeButtons = document.querySelectorAll('.btn-readme');
    
    // Eseménykezelők hozzárendelése minden gombhoz
    readmeButtons.forEach(button => {
        // Eltávolítjuk a régi eseménykezelőket
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Hozzáadjuk az új eseménykezelőt
        newButton.addEventListener('click', handleReadmeButtonClickOAuth);
    });
    
    console.log(`Initialized ${readmeButtons.length} README buttons with OAuth handlers`);
}

// A dokumentum betöltése után inicializáljuk a README gombokat
document.addEventListener('DOMContentLoaded', function() {
    // Meghívjuk az inicializáló függvényt
    initializeReadmeButtonsOAuth();
    
    // Figyelünk a DOM változásaira, hogy az újonnan hozzáadott gombokat is inicializáljuk
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                // Ellenőrizzük, hogy van-e új README gomb
                const newButtons = document.querySelectorAll('.btn-readme:not([data-initialized])');
                if (newButtons.length > 0) {
                    newButtons.forEach(button => {
                        button.setAttribute('data-initialized', 'true');
                        button.addEventListener('click', handleReadmeButtonClickOAuth);
                    });
                    console.log(`Initialized ${newButtons.length} new README buttons with OAuth`);
                }
            }
        });
    });
    
    // Figyeljük a teljes dokumentumot
    observer.observe(document.body, { childList: true, subtree: true });
});// Automatikusan inicializáljuk a README gombokat, amikor a dokumentum betöltődik
(function() {
    // Meghívjuk az inicializáló függvényt, amikor a dokumentum betöltődött
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeReadmeButtonsOAuth);
    } else {
        initializeReadmeButtonsOAuth();
    }
    
    // Figyelünk a DOM változásaira, hogy az újonnan hozzáadott gombokat is inicializáljuk
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                // Ellenőrizzük, hogy van-e új README gomb
                const newButtons = document.querySelectorAll('.btn-readme:not([data-initialized])');
                if (newButtons.length > 0) {
                    newButtons.forEach(button => {
                        button.setAttribute('data-initialized', 'true');
                        button.addEventListener('click', handleReadmeButtonClickOAuth);
                    });
                    console.log(`Initialized ${newButtons.length} new README buttons with OAuth`);
                }
            }
        });
    });
    
    // Figyeljük a teljes dokumentumot
    observer.observe(document.body, { childList: true, subtree: true });
})();