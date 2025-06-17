let currentPage = 1;
const perPage = 51;
// Globális változó a kedvenc fejlesztők tárolásához
let favoriteDevelopers = [];
// DOM elemek biztonságos elérése
const projectsContainer = document.getElementById('projects-container');
// A load-more gomb csak akkor kerül lekérésre, ha létezik
let loadMoreButton;
let loadMoreContainer;
document.addEventListener('DOMContentLoaded', () => {
    loadMoreButton = document.getElementById('load-more');
    loadMoreContainer = document.getElementById('load-more-container');
    
    // Törlés gomb eseménykezelő
    const deleteFromFixListBtn = document.getElementById('delete-from-fix-list');
    if (deleteFromFixListBtn) {
        deleteFromFixListBtn.addEventListener('click', deleteFromFixList);
    }
    
    // Fix keresések betöltése az adatbázisból
    loadStoredSearchTerms();
    
    // Nem indítunk automatikus keresést, mert a start_repos.js fogja kezelni az indulást
});
const sortSelect = document.getElementById('sort-select');
const searchTopic = document.getElementById('search-topic');
const customSearchToggle = document.getElementById('custom-search-toggle');
const customSearchContainer = document.getElementById('custom-search-container');
const searchTopicContainer = document.getElementById('search-topic-container');
const customSearchInput = document.getElementById('custom-search');
const addToFixListBtn = document.getElementById('add-to-fix-list');
const apiStatusIndicator = document.getElementById('api-status-indicator');
const saveTokenButton = document.getElementById('save-token');
const tokenInput = document.getElementById('github-token');
const tokenModal = document.getElementById('tokenModal') ? new bootstrap.Modal(document.getElementById('tokenModal')) : null;
const weeklySpotlightCheckbox = document.getElementById('search-weekly-spotlight');

// Fix URL kezelése
const fixedUrlToggle = document.getElementById('fixed-url-toggle');
const fixedUrlContainer = document.getElementById('fixed-url-container');
const fixedUrlInput = document.getElementById('fixed-url-input');

fixedUrlToggle.addEventListener('change', (e) => {
    // Reset input value before displaying to prevent autofill
    fixedUrlInput.value = '';
    fixedUrlContainer.style.display = e.target.checked ? 'block' : 'none';
});

fixedUrlInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const url = fixedUrlInput.value.trim();
        
        // URL ellenőrzése
        if (!url.startsWith('https://github.com/')) {
            alert('Please enter a valid GitHub URL starting with https://github.com/');
            return;
        }

        // Repository adatok kinyerése az URL-ből
        const parts = url.replace('https://github.com/', '').split('/');
        if (parts.length < 2) {
            alert('Invalid GitHub repository URL');
            return;
        }

        const owner = parts[0];
        const repo = parts[1];

        try {
            // Kedvencek panel elrejtése ha látható
            const searchResults = document.getElementById('search-results');
            if (searchResults) {
                searchResults.style.display = 'none';
                const resultsList = document.getElementById('results-list');
                if (resultsList) {
                    resultsList.style.display = 'none';
                }
            }

            // Projektek konténer beállítása és megjelenítése
            projectsContainer.style.display = 'flex';
            projectsContainer.className = 'row row-cols-1 row-cols-md-3 g-4';
            projectsContainer.style.opacity = '0.5';

            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: getHeaders()
            });

            if (!response.ok) {
                throw new Error('Repository not found');
            }

            const data = await response.json();
            
            // Töröljük a korábbi találatokat
            projectsContainer.innerHTML = '';
            document.getElementById('total-count').textContent = '1';
            
            // Megjelenítjük az egy találatot
            const card = await createProjectCard(data);
            projectsContainer.appendChild(card);
            
            // Elrejtjük a "Load More" gombot
            if (loadMoreButton) {
                loadMoreButton.style.display = 'none';
                if (loadMoreContainer) {
                    loadMoreContainer.style.display = 'none';
                }
            }
            
            // Frissítjük a rate limit infót
            await updateRateLimit();

            // Sikeres keresés után kikapcsoljuk a jelölőnégyzetet
            fixedUrlToggle.checked = false;
            fixedUrlContainer.style.display = 'none';
            fixedUrlInput.value = '';
            
        } catch (error) {
            console.error('Error fetching repository:', error);
            alert(error.message);
        } finally {
            projectsContainer.style.opacity = '1';
        }
    }
});

async function handleGitHubResponse(response, searchTerm, exactMatch) {
    if (response.status === 429) {
        throw new Error('You have reached your hourly GitHub API request limit!');
    }
    if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please try again later.');
    }
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }
    const data = await response.json();
    if (exactMatch) {
        // Filter results to include only those with exact name matches
        data.items = data.items.filter(item => item.name.toLowerCase() === searchTerm.toLowerCase());
    }
    return data;
}

async function searchComfyUIProjects(page = 1, searchTerm, exactMatch) {
    const sortOption = sortSelect.value;
    let sortQuery = '';
    let orderQuery = 'desc';
    
    switch(sortOption) {
        case 'updated':
            sortQuery = 'updated';
            break;
        case 'forks':
            sortQuery = 'forks';
            break;
        case 'new':
            sortQuery = 'created';
            break;
        case 'committer-date':
            sortQuery = 'committer-date';
            break;
        case 'stars':
        default:
            sortQuery = 'stars';
            break;
    }
    
    try {
        const response = await fetch(`https://api.github.com/search/repositories?q=ComfyUI+in:name,description,readme&sort=${sortQuery}&order=${orderQuery}&page=${page}&per_page=${perPage}`, {
            headers: getHeaders()
        });
        const data = await handleGitHubResponse(response, searchTerm, exactMatch);
        return data;
    } catch (error) {
        console.error('Error fetching projects:', error);
        alert(error.message);
        return null;
    }
}

async function getRepositoryReadme(owner, repo) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
            headers: getHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            const rawResponse = await fetch(data.download_url);
            if (!rawResponse.ok) {
                throw new Error('Failed to fetch README content');
            }
            const content = await rawResponse.text();
            return content;
        }
        if (response.status === 404) {
            return 'No README available for this repository.';
        }
        throw new Error(`Failed to fetch README: ${response.status}`);
    } catch (error) {
        console.error('Error fetching readme:', error);
        return `Error loading README: ${error.message}`;
    }
}

async function getRepositoryLanguages(owner, repo) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
            headers: getHeaders()
        });
        const data = await handleGitHubResponse(response);
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        return Object.entries(data).map(([lang, bytes]) => ({
            name: lang,
            percentage: ((bytes / total) * 100).toFixed(1)
        }));
    } catch (error) {
        console.error('Error fetching languages:', error);
        return [];
    }
}

async function getLastCommitDate(owner, repo) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, {
            headers: getHeaders()
        });
        const data = await handleGitHubResponse(response);
        if (data && data.length > 0) {
            return data[0].commit.committer.date;
        }
        return null;
    } catch (error) {
        console.error('Error fetching last commit:', error);
        return null;
    }
}

// Új függvény a repozitórium frissítési dátumának lekéréséhez
async function getRepoUpdateDate(owner, repo) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: getHeaders()
        });
        const data = await handleGitHubResponse(response);
        if (data && data.updated_at) {
            return data.updated_at;
        }
        return null;
    } catch (error) {
        console.error('Error fetching repo update date:', error);
        return null;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function createLanguageBadges(languages) {
    return languages.map(lang => {
        // Nyelv nevének tisztítása és formázása
        let cssClass = lang.name;
        if (lang.name === 'C#') {
            cssClass = 'CSharp';
        } else if (lang.name === 'ASP.NET') {
            cssClass = 'ASPNET';
        } else {
            cssClass = cssClass.replace(/\+/g, 'P').replace(/\s+/g, '').replace(/#/g, 'Sharp');
        }
        return `<span class="project-language lang-${cssClass}">${lang.name} ${lang.percentage}%</span>`;
    }).join('');
}

/**
 * Relatív URL-ek átalakítása abszolút URL-ekké
 * @param {HTMLElement} tempDiv A HTML tartalom ideiglenes tárolója
 * @param {string} owner A repository tulajdonosa
 * @param {string} repo A repository neve
 */
function fixRelativeUrls(tempDiv, owner, repo) {
    if (!owner || !repo) return;
    
    const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/`;
    const githubUrl = `https://github.com/${owner}/${repo}/blob/master/`;
    const githubRawUrl = `https://github.com`;
    
    // Képek kezelése
    tempDiv.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
            if (src.startsWith('/') && src.includes('/raw/')) {
                // GitHub relatív URL-ek kezelése (/username/repo/raw/...)
                img.src = githubRawUrl + src;
            } else if (!src.startsWith('http')) {
                // Eltávolítjuk a ./ előtagot, ha van
                const cleanSrc = src.startsWith('./') ? src.substring(2) : src;
                img.src = baseUrl + cleanSrc;
            }
        }
    });
    
    // Videók kezelése
    tempDiv.querySelectorAll('video source').forEach(source => {
        const src = source.getAttribute('src');
        if (src) {
            if (src.startsWith('/') && src.includes('/raw/')) {
                // GitHub relatív URL-ek kezelése (/username/repo/raw/...)
                source.src = githubRawUrl + src;
            } else if (!src.startsWith('http')) {
                // Eltávolítjuk a ./ előtagot, ha van
                const cleanSrc = src.startsWith('./') ? src.substring(2) : src;
                source.src = baseUrl + cleanSrc;
            }
        }
    });
    
    // Linkek kezelése
    tempDiv.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
            if (href.startsWith('/') && (href.includes('/blob/') || href.includes('/tree/'))) {
                // GitHub relatív URL-ek kezelése (/username/repo/blob/...)
                link.href = githubRawUrl + href;
            } else {
                // Eltávolítjuk a ./ előtagot, ha van
                const cleanHref = href.startsWith('./') ? href.substring(2) : href;
                
                // Ha markdown fájlra mutat, akkor GitHub linkre konvertáljuk
                if (cleanHref.endsWith('.md')) {
                    link.href = githubUrl + cleanHref;
                } else {
                    link.href = baseUrl + cleanHref;
                }
            }
        }
    });
}

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
    
    // Markdown formázás
    const renderedContent = marked.parse(content);
    
    // Ideiglenes div a HTML tartalom kezeléséhez
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderedContent;
    
    // Képek és videók relatív hivatkozásainak javítása
    fixRelativeUrls(tempDiv, owner, repo);
    
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
}

async function createProjectCard(project) {
    await loadFavoriteDevelopers();  // Kedvenc fejlesztők betöltése
    
    const card = document.createElement('div');
    card.className = 'col-md-4 mb-4';
    
    const defaultImage = 'https://opengraph.githubassets.com/1/' + project.full_name;
    const [owner, repo] = project.full_name.split('/');
    
    // Ellenőrizzük, hogy a fejlesztő kedvenc-e
    const isDevFavorite = isDeveloperFavorite(owner);
    
    // Format update date
    const updateDate = new Date(project.updated_at);
    const formattedUpdateDate = formatDate(updateDate);

    card.innerHTML = `
        <div class="card">
            <div class="card-bg"></div>
            <div class="card-bg bg2"></div>
            <div class="card-bg bg3"></div>
            <div class="card-img-container">
                <img src="" data-src="${defaultImage}" class="card-img-top lazy-loading" alt="${project.name}">
            </div>
            <div class="card-body">
                <div class="card-header-flex mb-3">
                    <div class="card-header-right w-100">
                        <div class="d-flex justify-content-between">
                            <button class="btn-readme" data-owner="${owner}" data-repo="${repo}">View README</button>
                            <button class="btn btn-sm dev-btn" data-project-id="${project.id}" style="min-width: 70px;${isDevFavorite ? ' background-color: #ffff00 !important;' : ''}">${isDevFavorite ? '-Dev.' : '+Dev.'}</button>
                            <button class="btn btn-sm favorite-btn" data-project-id="${project.id}">+My favourite</button>
                        </div>
                    </div>
                </div>
                <h5 class="card-title">${project.name}</h5>
                <p class="project-meta mb-2">
                    <span class="update-date">Last update: ${formattedUpdateDate}</span><br>
                    <span class="commit-date">Last commit: Loading...</span>
                </p>
                <p class="card-text">${project.description || 'No description available'}</p>
                <div class="repository-stats mb-2">
                    <span class="me-3">⭐ ${project.stargazers_count}</span>
                    <span class="me-3">🔄 ${project.forks_count}</span>
                    <span>👥 <span class="contributors-count">Loading...</span></span>
                </div>
                <div class="languages-container mb-3">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">Loading languages...</span>
                    </div>
                </div>
                <div class="d-flex justify-content-between gap-2">
                    <a href="${project.html_url}" target="_blank" class="btn btn-outline-primary" style="flex: 0.8.1">
                        <img src="pictures/GitHub-Logo_button.png" alt="GitHub" class="github-button-icon"> View Project
                    </a>
                    <a href="${project.owner.html_url}" target="_blank" class="btn btn-outline-primary" style="flex: 0.8">
                        <img src="pictures/GitHub-Logo_button.png" alt="GitHub" class="github-button-icon"> View Developer
                    </a>
                </div>
            </div>
        </div>
    `;

    // Képbetöltő inicializálása
    const imgElement = card.querySelector('.card-img-top');
    if (imgElement && window.initImageLoader) {
        window.initImageLoader(imgElement, defaultImage, project.name);
    }
    
    // Kedvencek gomb inicializálása
    const favoriteButton = card.querySelector('.favorite-btn');
    
    // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
    if (!document.getElementById('user-info').classList.contains('d-none')) {
        try {
            // Kedvencek lekérése az adatbázisból
            const response = await fetch('get_favorites.php');
            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.favorites)) {
                    // Ellenőrizzük, hogy a projekt szerepel-e a kedvencek között
                    const isFavorite = data.favorites.some(fav => fav.id === project.id);
                    if (isFavorite) {
                        favoriteButton.style.setProperty('background-color', 'yellow', 'important');
                        favoriteButton.textContent = '-My favourite';
                    }
                }
            }
        } catch (error) {
            console.error('Error checking favorite status:', error);
        }
    }
    
    // Kedvencek gomb eseménykezelő
    favoriteButton.addEventListener('click', async () => {
        favoriteButton.style.backgroundColor = '#888';
        favoriteButton.style.color = '#fff'; 
        await saveFavorite(project, favoriteButton);
    });

    // Dev gomb eseménykezelő
    const devButton = card.querySelector('.dev-btn');
    devButton.addEventListener('click', async () => {
        devButton.disabled = true;
        try {
            await saveDeveloper(owner, devButton);
        } finally {
            devButton.disabled = false;
        }
    });

    // README gomb eseménykezelő
    const readmeBtn = card.querySelector('.btn-readme');
    readmeBtn.addEventListener('click', async () => {
        readmeBtn.disabled = true;
        readmeBtn.textContent = 'Loading...';
        try {
            const content = await getRepositoryReadme(owner, repo);
            showReadmePopup(content, owner, repo);
        } finally {
            readmeBtn.disabled = false;
            readmeBtn.textContent = 'View README';
        }
    });

    // Nyelvek betöltése
    const languagesContainer = card.querySelector('.languages-container');
    getRepositoryLanguages(owner, repo).then(languages => {
        if (languages.length > 0) {
            languagesContainer.innerHTML = createLanguageBadges(languages);
        } else {
            languagesContainer.innerHTML = '<span class="text-muted">No language data available</span>';
        }
    }).catch(() => {
        languagesContainer.innerHTML = '<span class="text-danger">Error loading languages</span>';
    });

    // Fejlesztők számának betöltése
    const contributorsCountElement = card.querySelector('.contributors-count');
    fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1&anon=true`, {
        headers: getHeaders()
    }).then(response => {
        const linkHeader = response.headers.get('Link');
        if (linkHeader) {
            const match = linkHeader.match(/page=(\d+)>; rel="last"/);
            if (match) {
                contributorsCountElement.textContent = match[1];
                return;
            }
        }
        return response.json().then(contributors => {
            contributorsCountElement.textContent = Array.isArray(contributors) ? contributors.length : 0;
        });
    }).catch(() => {
        contributorsCountElement.textContent = 'N/A';
    });

    // Utolsó commit dátum betöltése
    const commitDateElement = card.querySelector('.commit-date');
    getLastCommitDate(owner, repo).then(date => {
        if (date) {
            commitDateElement.textContent = `Last commit: ${formatDate(date)}`;
        } else {
            commitDateElement.textContent = 'Last commit: N/A';
        }
    }).catch(() => {
        commitDateElement.textContent = 'Last commit: Error loading';
    });

    return card;
}

async function buildSearchQuery(searchTerm) {
    let query = searchTerm;
    let searchParts = [];
    
    // Name match opciók
    const nameApprox = document.getElementById('search-name-approx').checked;
    const nameExact = document.getElementById('search-name-exact').checked;
    
    // Description match opciók
    const descApprox = document.getElementById('search-desc-approx').checked;
    
    // README keresés
    const searchReadme = document.getElementById('search-readme').checked;
    
    // Új repók ezen a héten
    const newThisWeek = document.getElementById('search-new-week').checked;
    
    // Kijelölt programnyelvek összegyűjtése
    const selectedLanguages = Array.from(document.querySelectorAll('.language-item input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);
    
    // Név keresés
    if (nameApprox) searchParts.push(searchTerm + ' in:name');
    if (nameExact) {
        searchParts.push(`"${searchTerm}" in:name`); // Use quotes for exact match by repository name
    }
    
    // Leírás keresés
    if (descApprox) searchParts.push(searchTerm + ' in:description');
    
    // README keresés
    if (searchReadme) searchParts.push(searchTerm + ' in:readme');
    
    // Ha nincs kiválasztva egyik sem, akkor alapértelmezett keresés
    if (searchParts.length === 0) {
        searchParts.push(`${searchTerm} in:name,description,readme`);
    }

    // Keresési részek egyesítése OR operátorral
    query = searchParts.join(' OR ');
    
    // Programnyelvek hozzáadása
    if (selectedLanguages.length > 0) {
        const languageQuery = selectedLanguages.map(lang => `language:${lang}`).join(' ');
        query += ` ${languageQuery}`;
    }
    
    // Új repók ezen a héten
    if (newThisWeek) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const dateString = oneWeekAgo.toISOString().split('T')[0];
        query += ` created:>${dateString}`;
    }

    // Get sort option
    const sortOption = sortSelect.value;
    let sortQuery = '';
    let orderQuery = 'desc';
    
    switch(sortOption) {
        case 'updated':
            sortQuery = 'updated';
            break;
        case 'forks':
            sortQuery = 'forks';
            break;
        case 'help-wanted-issues':
            sortQuery = 'help-wanted-issues';
            break;
        case 'new':
            sortQuery = 'created';
            break;
        case 'last-commit':
            sortQuery = 'committer-date';
            break;
        case 'stars':
            sortQuery = 'stars';
            break;
        default:
            sortQuery = 'stars'; // Alapértelmezetten csillagok szerint rendezünk
            break;
    }

    return { query, sortQuery, orderQuery };
}

function formatResetTime(timestamp) {
    const resetDate = new Date(timestamp * 1000);
    const now = new Date();
    const diffMinutes = Math.round((resetDate - now) / (1000 * 60));
    
    if (diffMinutes < 1) {
        return 'Less than a minute';
    } else if (diffMinutes === 1) {
        return '1 minute';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} minutes`;
    } else {
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        if (minutes === 0) {
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        }
        return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
    }
}

// A getHeaders() függvény most már a github-auth.js fájlban található

async function updateRateLimit() {
    try {
        const response = await fetch('https://api.github.com/rate_limit', {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const { remaining, limit, reset } = data.rate;

        document.getElementById('rate-limit').textContent = remaining;
        document.getElementById('rate-limit-max').textContent = limit;
        document.getElementById('rate-reset').textContent = `in ${formatResetTime(reset)}`;

        // Frissítjük a reset időt percenként
        setTimeout(() => {
            const resetElement = document.getElementById('rate-reset');
            if (resetElement) {
                resetElement.textContent = `in ${formatResetTime(reset)}`;
            }
        }, 60000);
    } catch (error) {
        console.error('Error fetching rate limit:', error);
    }
}

async function loadProjects(page = 1) {
    try {
        projectsContainer.style.opacity = '0.5';
        
        // Keresési elemek megjelenítése
        document.getElementById('current-search-text').style.display = 'block';
        document.getElementById('current-search-options').style.display = 'block';
        
        // Kedvencek konténer teljes elrejtése
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
            searchResults.style.display = 'none';
            const resultsList = document.getElementById('results-list');
            if (resultsList) {
                resultsList.style.display = 'none';
            }
        }
        
        // Leállítjuk a heti ajánlatok feldolgozását, ha aktív volt
        if (window.weeklyReposActive !== undefined) {
            window.weeklyReposActive = false;
            window.processingPaused = true;
        }
        
        // Elrejtjük a heti ajánlatok "Load More" gombját, ha létezik
        if (typeof hideWeeklyLoadMoreButton === 'function') {
            hideWeeklyLoadMoreButton();
        } else {
            // Ha a függvény nem létezik, akkor közvetlenül elrejtjük a gombot
            const weeklyLoadMoreButton = document.getElementById('weekly-load-more-button');
            if (weeklyLoadMoreButton) {
                weeklyLoadMoreButton.style.display = 'none';
            }
            const weeklyLoadMoreContainer = document.getElementById('weekly-load-more-container');
            if (weeklyLoadMoreContainer) {
                weeklyLoadMoreContainer.style.display = 'none';
            }
        }

        // Projektek konténer megjelenítése
        projectsContainer.style.display = 'flex';
        projectsContainer.className = 'row row-cols-1 row-cols-md-3 g-4';

        const searchTerm = customSearchToggle.checked ? 
            customSearchInput.value.trim() : 
            searchTopic.value;

        // Build the search query
        const { query, sortQuery, orderQuery } = await buildSearchQuery(searchTerm);
        
        // Construct API URL
        let apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}`;
        if (sortQuery) {
            apiUrl += `&sort=${sortQuery}&order=${orderQuery}`;
        }
        apiUrl += `&page=${page}&per_page=${perPage}`;

        // Make the API call
        const response = await fetch(apiUrl, {
            headers: getHeaders()
        });

        const data = await handleGitHubResponse(response, searchTerm, document.getElementById('search-name-exact').checked);
        
        // Update last_used time after successful search
        if (document.getElementById('user-info').classList.contains('d-none') === false) {
            try {
                await fetch('update_last_used.php', {
                    method: 'POST',
                    credentials: 'same-origin'
                });
            } catch (error) {
                console.error('Error updating last_used time:', error);
            }
        }
        
        if (page === 1) {
            projectsContainer.innerHTML = '';
            if (document.getElementById('search-name-exact').checked) {
                document.getElementById('total-count').textContent = data.items.length.toLocaleString();
            } else {
                document.getElementById('total-count').textContent = data.total_count.toLocaleString();
            }
        }

        for (const project of data.items) {
            const card = await createProjectCard(project);
            projectsContainer.appendChild(card);
        }

        if (loadMoreButton) {
            loadMoreButton.style.display = data.items.length === perPage ? 'block' : 'none';
            if (loadMoreContainer) {
                loadMoreContainer.style.display = data.items.length === perPage ? 'flex' : 'none';
            }
        }
        
        // Update rate limit info
        await updateRateLimit();
        
    } catch (error) {
        console.error('Error loading projects:', error);
        alert(error.message);
    } finally {
        projectsContainer.style.opacity = '1';
    }
}

function updateSearchTitle(searchTerm) {
    const searchTitleElement = document.getElementById('current-search-text');
    searchTitleElement.textContent = searchTerm;
}

function loadStoredSearchTerms() {
    // Alapértelmezett elemek megőrzése
    const defaultOptions = ['Weekly repository offer'];
    
    // Betöltés az adatbázisból
    fetch('get_fixed_search.php')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP hiba: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.status === 'success' && Array.isArray(data.terms)) {
                // Hozzáadjuk a tárolt elemeket a select mezőhöz
                data.terms.forEach(term => {
                    if (!Array.from(searchTopic.options).some(option => option.value === term)) {
                        const option = new Option(term, term);
                        searchTopic.add(option);
                    }
                });
            }
        })
        .catch(error => {
            console.error('Hiba a keresési kifejezések betöltése során:', error);
            // Hibakor a localStorage-ból próbáljuk betölteni (fallback)
            const storedTerms = JSON.parse(localStorage.getItem('fixSearchTerms') || '[]');
            storedTerms.forEach(term => {
                if (!Array.from(searchTopic.options).some(option => option.value === term)) {
                    const option = new Option(term, term);
                    searchTopic.add(option);
                }
            });
        });
}

// Kiválasztott elem törlése a fix listából
function deleteFromFixList() {
    const selectedIndex = searchTopic.selectedIndex;
    if (selectedIndex < 0) return;
    
    const selectedValue = searchTopic.value;
    
    // Ellenőrizzük, hogy az alapértelmezett elemek közé tartozik-e
    const defaultOptions = ['Weekly repository offer'];
    if (defaultOptions.includes(selectedValue)) {
        alert('Default items cannot be deleted!');
        return;
    }
    
    // Törlés az adatbázisból
    fetch('delete_fixed_search.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ term: selectedValue })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP hiba: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data && data.status === 'success') {
            // Töröljük az elemet a select-ből
            searchTopic.remove(selectedIndex);
            
            // Frissítjük a localStorage-ot is (fallback)
            const storedTerms = JSON.parse(localStorage.getItem('fixSearchTerms') || '[]');
            const updatedTerms = storedTerms.filter(term => term !== selectedValue);
            localStorage.setItem('fixSearchTerms', JSON.stringify(updatedTerms));
            
            // Ha van még elem a listában, akkor az elsőt választjuk ki
            if (searchTopic.options.length > 0) {
                searchTopic.selectedIndex = 0;
            }
        } else {
            alert('An error occurred when deleting the search term: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('An error occurred when deleting the search term:', error);
        alert('An error occurred when deleting the search term. Please try again later.');
    });
}

function addToFixList() {
    const term = customSearchInput.value.trim();
    if (!term) return;

    // Ellenőrizzük, hogy még nincs-e már a listában
    if (Array.from(searchTopic.options).some(option => option.value === term)) {
        alert('This term is already in the list!');
        return;
    }

    // Mentés az adatbázisba
    fetch('add_fixed_search.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ term: term })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP hiba: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data && data.status === 'success') {
            // Hozzáadjuk az új opciót a select-hez
            const option = new Option(term, term);
            searchTopic.add(option);
            
            // Mentjük localStorage-ba is (fallback)
            const storedTerms = JSON.parse(localStorage.getItem('fixSearchTerms') || '[]');
            if (!storedTerms.includes(term)) {
                storedTerms.push(term);
                localStorage.setItem('fixSearchTerms', JSON.stringify(storedTerms));
            }
            
            // Visszaállítjuk a select-et az új elemre
            searchTopic.value = term;
            
            // Kikapcsoljuk a custom módot és frissítjük a megjelenítést
            customSearchToggle.checked = false;
            customSearchContainer.style.display = 'none';
            searchTopicContainer.style.display = 'block';
            addToFixListBtn.style.display = 'none';
            
            // Töröljük a custom search input tartalmát
            customSearchInput.value = '';
        } else {
            alert('An error occurred when saving the search term:  ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('An error occurred when saving the search term:', error);
        alert('An error occurred when saving the search term. Please try again later.');
    });
}

// Keresési opciók változásának figyelése
function handleSearchOptionChange(checkbox) {
    if (checkbox.checked) {
        // Ha egy name-match vagy desc-match opció be van jelölve, a többi ugyanabban a csoportban legyen kikapcsolva
        if (checkbox.classList.contains('name-match')) {
            document.querySelectorAll('.name-match').forEach(cb => {
                if (cb !== checkbox) cb.checked = false;
            });
        } else if (checkbox.classList.contains('desc-match')) {
            document.querySelectorAll('.desc-match').forEach(cb => {
                if (cb !== checkbox) cb.checked = false;
            });
        }
    }

    // Ellenőrizzük, hogy van-e legalább egy bejelölt opció
    const checkedCount = document.querySelectorAll('.search-option:checked').length;
    if (checkedCount === 0) {
        checkbox.checked = true;
        alert('At least one search option must be selected!');
        return;
    }

    resetAndSearch();
}

async function displayProject(project, container, isFavoritesList = false) {
    await loadFavoriteDevelopers();  // Kedvenc fejlesztők betöltése
    
    const defaultImage = 'https://opengraph.githubassets.com/1/' + project.full_name;
    const [owner, repoName] = project.full_name.split('/');
    
    // Alapértelmezett érték
    let formattedUpdateDate = "Loading...";

    // Ellenőrizzük, hogy a fejlesztő kedvenc-e
    const isDevFavorite = isDeveloperFavorite(owner);

    // Kategóriák lekérése
    let categories = [];
    if (isFavoritesList) {
        try {
            const response = await fetch('get_categories.php');
            const data = await response.json();
            if (data.success) {
                categories = data.categories;
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }

    const projectCard = document.createElement('div');
    projectCard.className = 'col-md-4 mb-4';
    projectCard.innerHTML = `
        <div class="card">
            <div class="card-bg"></div>
            <div class="card-bg bg2"></div>
            <div class="card-bg bg3"></div>
            <div class="card-img-container">
                <img src="" data-src="${defaultImage}" class="card-img-top lazy-loading" alt="${project.name}" loading="lazy">
            </div>
            <div class="card-body">
                <div class="card-header-flex mb-3">
                    <div class="card-header-right w-100">
                        <div class="d-flex justify-content-between">
                            <button class="btn-readme" data-owner="${owner}" data-repo="${repoName}">View README</button>
                            <button class="btn btn-sm dev-btn" data-project-id="${project.id}" style="min-width: 70px;${isDevFavorite ? ' background-color: #ffff00 !important;' : ''}">${isDevFavorite ? '-Dev.' : '+Dev.'}</button>
                            <button class="btn btn-sm favorite-btn" data-project-id="${project.id}">${isFavoritesList ? '-My favourite' : '+My favourite'}</button>
                        </div>
                    </div>
                </div>
                <h5 class="card-title">${project.name}</h5>
                ${isFavoritesList ? `
                <div class="category-select-container mb-3">
                    <select class="form-select form-select-sm category-select" data-repo-id="${project.id}">
                        <option value="new" style="font-weight: bold;">Create a new category</option>
                        <option value="modify" style="font-weight: bold;">Modify or Delete category name</option>
                        ${categories.map(cat => `
                            <option value="${cat.id}" ${project.category_id === cat.id ? 'selected' : ''}>
                                ${cat.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="notes-container mb-3">
                    <textarea class="individual-notes form-control" placeholder="Add notes here..." data-repo-id="${project.id}">${project.individual_notes || ''}</textarea>
                </div>
                ` : ''}
                <p class="project-meta mb-2">
                    <span class="update-date">Last update: ${formattedUpdateDate}</span><br>
                    <span class="commit-date">Last commit: Loading...</span>
                </p>
                <p class="card-text">${project.description || 'No description available'}</p>
                <div class="repository-stats mb-2">
                    <span class="me-3">⭐ ${project.stargazers_count}</span>
                    <span class="me-3">🔄 ${project.forks_count}</span>
                    <span>👥 <span class="contributors-count">Loading...</span></span>
                </div>
                <div class="languages-container mb-3">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">Loading languages...</span>
                    </div>
                </div>
                <div class="d-flex justify-content-between gap-2">
                    <a href="${project.html_url}" target="_blank" class="btn btn-outline-primary" style="flex: 0.8.1">
                        <img src="pictures/GitHub-Logo_button.png" alt="GitHub" class="github-button-icon"> View Project
                    </a>
                    <a href="${project.owner.html_url}" target="_blank" class="btn btn-outline-primary" style="flex: 0.8">
                        <img src="pictures/GitHub-Logo_button.png" alt="GitHub" class="github-button-icon"> View Developer
                    </a>
                </div>
            </div>
        </div>
    `;

    // Képbetöltő inicializálása
    const imgElement = projectCard.querySelector('.card-img-top');
    if (imgElement && window.initImageLoader) {
        window.initImageLoader(imgElement, defaultImage, project.name);
    }
    
    // README gomb eseménykezelő
    const readmeBtn = projectCard.querySelector('.btn-readme');
    readmeBtn.addEventListener('click', async () => {
        const content = await getRepositoryReadme(owner, repoName);
        showReadmePopup(content, owner, repoName);
    });

    // Nyelvek betöltése
    const languagesContainer = projectCard.querySelector('.languages-container');
    const languages = await getRepositoryLanguages(owner, repoName);
    if (languages.length > 0) {
        languagesContainer.innerHTML = createLanguageBadges(languages);
    } else {
        languagesContainer.innerHTML = '<span class="no-language">No language data</span>';
    }

    // Utolsó commit dátum betöltése
    const lastCommitDate = await getLastCommitDate(owner, repoName);
    if (lastCommitDate) {
        const formattedCommitDate = formatDate(lastCommitDate);
        projectCard.querySelector('.commit-date').textContent = `Last commit: ${formattedCommitDate}`;
    } else {
        projectCard.querySelector('.commit-date').textContent = 'Last commit: N/A';
    }
    
    // Repozitórium frissítési dátum betöltése
    const updateDate = await getRepoUpdateDate(owner, repoName);
    if (updateDate) {
        const formattedUpdateDate = formatDate(new Date(updateDate));
        projectCard.querySelector('.update-date').textContent = `Last update: ${formattedUpdateDate}`;
    } else {
        projectCard.querySelector('.update-date').textContent = 'Last update: N/A';
    }

    // Kedvencek gomb eseménykezelő
    const favoriteButton = projectCard.querySelector('.favorite-btn');
    favoriteButton.style.setProperty('background-color', isFavoritesList ? 'yellow' : 'gray', 'important');
    favoriteButton.addEventListener('click', async () => {
        favoriteButton.style.backgroundColor = '#888';
        favoriteButton.style.color = '#fff'; 
        await saveFavorite(project, favoriteButton);
    });

    // Dev gomb eseménykezelő
    const devButton = projectCard.querySelector('.dev-btn');
    devButton.addEventListener('click', async () => {
        devButton.disabled = true;
        try {
            await saveDeveloper(owner, devButton);
        } finally {
            devButton.disabled = false;
        }
    });

    // Kategória választó eseménykezelő
    if (isFavoritesList) {
        const categorySelect = projectCard.querySelector('.category-select');
        if (categorySelect) {
            categorySelect.addEventListener('change', async (e) => {
                const selectedValue = e.target.value;
                const repoId = categorySelect.dataset.repoId;
                
                if (selectedValue === 'new') {
                    // Modal HTML létrehozása
                    const modalHtml = `
                        <div class="modal fade" id="newCategoryModal" tabindex="-1" aria-hidden="true">
                            <div class="modal-dialog">
                                <div class="modal-content">
                                    <div class="modal-header">
                                        <h5 class="modal-title">Create New Category</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                    </div>
                                    <div class="modal-body">
                                        <div class="mb-3">
                                            <input type="text" class="form-control" id="newCategoryName" placeholder="Enter category name">
                                        </div>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                        <button type="button" class="btn btn-primary" id="createCategoryBtn">Create</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    // Modal elem hozzáadása a DOM-hoz
                    const modalContainer = document.createElement('div');
                    modalContainer.innerHTML = modalHtml;
                    document.body.appendChild(modalContainer);

                    // Modal inicializálása
                    const modal = new bootstrap.Modal(document.getElementById('newCategoryModal'));
                    const createBtn = document.getElementById('createCategoryBtn');
                    const categoryInput = document.getElementById('newCategoryName');

                    // Kategória ID mentése (add hozzá ezt a sort)
                    const originalCategoryId = project.category_id || '';

                    // Modal bezárás eseménykezelő hozzáadása (add hozzá ezt a blokkot)
                    document.getElementById('newCategoryModal').addEventListener('hidden.bs.modal', function() {
                        // Ha nem a Create gombbal zárták be, visszaállítjuk az eredeti értéket
                        if (!modalContainer.dataset.categoryCreated) {
                            categorySelect.value = originalCategoryId;
                        }
                    });

                    // Modal megjelenítése
                    modal.show();

                    // Create gomb eseménykezelő
                    createBtn.addEventListener('click', async () => {
                        const categoryName = categoryInput.value.trim();
                        
                        if (!categoryName) {
                            alert('Please enter a category name');
                            return;
                        }

                        try {
                            const response = await fetch('create_category.php', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    category_name: categoryName,
                                    repo_id: repoId
                                })
                            });
                            
                            const data = await response.json();
                            if (!data.success) {
                                throw new Error(data.message || 'Failed to create category');
                            }

                            // Új opció hozzáadása a select-hez
                            const newOption = document.createElement('option');
                            newOption.value = data.category_id;
                            newOption.textContent = categoryName;
                            newOption.selected = true;
                            
                            // Az új kategória opció beszúrása a "Create" után
                            const firstOption = categorySelect.querySelector('option');
                            firstOption.insertAdjacentElement('afterend', newOption);
                            
                            // Az új kategória kiválasztása az aktuális legördülőben
                            categorySelect.value = data.category_id;
                            
                            // Az új kategória hozzáadása a fő kategória szűrőhöz is
                            const categoryFilter = document.getElementById('category-filter');
                            if (categoryFilter) {
                                const filterOption = document.createElement('option');
                                filterOption.value = data.category_id;
                                filterOption.textContent = categoryName;
                                categoryFilter.appendChild(filterOption);
                            }
                            
                            // Az új kategória hozzáadása az összes többi repository kategória választójához is
                            const allCategorySelects = document.querySelectorAll('.category-select');
                            allCategorySelects.forEach(select => {
                                // Ne adjuk hozzá újra ahhoz a selecthez, ahol már létrehoztuk
                                if (select !== categorySelect) {
                                    const newCategoryOption = document.createElement('option');
                                    newCategoryOption.value = data.category_id;
                                    newCategoryOption.textContent = categoryName;
                                    
                                    // Az új kategória opció beszúrása a "Create" után
                                    const createNewOption = select.querySelector('option[value="new"]');
                                    if (createNewOption) {
                                        createNewOption.insertAdjacentElement('afterend', newCategoryOption);
                                    } else {
                                        select.appendChild(newCategoryOption);
                                    }
                                }
                            });
                            
                            // Modal bezárása
                            modal.hide();
                            // Sikeres létrehozás jelzése (add hozzá ezt a sort)
                            modalContainer.dataset.categoryCreated = true;
                            modalContainer.remove();

                        } catch (error) {
                            console.error('Error creating category:', error);
                            alert('Failed to create category: ' + error.message);
                        }
                    });
                } else if (selectedValue === 'modify') {
                    // Modal HTML létrehozása
                    const modalHtml = `
                        <div class="modal fade" id="modifyCategoryModal" tabindex="-1" aria-hidden="true">
                            <div class="modal-dialog">
                                <div class="modal-content">
                                    <div class="modal-header">
                                        <h5 class="modal-title">Modify or Delete Category Name</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                    </div>
                                    <div class="modal-body">
                                        <div class="mb-3">
                                            <label for="selectCategoryToModify" class="form-label">Select category to modify</label>
                                            <select class="form-select" id="selectCategoryToModify">
                                                ${categories.map(cat => `
                                                    <option value="${cat.id}">${cat.name}</option>
                                                `).join('')}
                                            </select>
                                        </div>
                                        <div class="mb-3">
                                            <label for="modifyCategoryName" class="form-label">New category name</label>
                                            <input type="text" class="form-control" id="modifyCategoryName" placeholder="Enter new category name">
                                        </div>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-danger" id="deleteCategoryBtn" style="margin-right: auto;">Delete selected name</button>
                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                        <button type="button" class="btn btn-primary" id="modifyCategoryBtn">Modify</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    // Modal elem hozzáadása a DOM-hoz
                    const modalContainer = document.createElement('div');
                    modalContainer.innerHTML = modalHtml;
                    document.body.appendChild(modalContainer);

                    // Modal inicializálása
                    const modal = new bootstrap.Modal(document.getElementById('modifyCategoryModal'));
                    const modifyBtn = document.getElementById('modifyCategoryBtn');
                    const categoryInput = document.getElementById('modifyCategoryName');
                    const categorySelect = document.getElementById('selectCategoryToModify');

                    // Kategória ID mentése (add hozzá ezt a sort)
                    const originalCategoryId = project.category_id || '';

                    // Modal bezárás eseménykezelő hozzáadása (add hozzá ezt a blokkot)
                    document.getElementById('modifyCategoryModal').addEventListener('hidden.bs.modal', function() {
                        // Ha nem a Modify gombbal zárták be, visszaállítjuk az eredeti értéket
                        if (!modalContainer.dataset.categoryModified) {
                            e.target.value = originalCategoryId;
                        }
                    });

                    // Modal megjelenítése
                    modal.show();

                    // Delete gomb eseménykezelő
                    const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');
                    deleteCategoryBtn.addEventListener('click', async () => {
                        const selectedCategoryId = categorySelect.value;
                        const selectedCategoryName = categorySelect.options[categorySelect.selectedIndex].text;
                        
                        // Ellenőrizzük, hogy nem a General kategóriát próbálja törölni
                        if (selectedCategoryName === 'General') {
                            alert('The General category is a default category and cannot be deleted.');
                            return;
                        }
                        
                        // Megerősítő kérdés
                        if (confirm(`Are you sure you want to delete the "${selectedCategoryName}" category? All favorites in this category will be moved to the "General" category.`)) {
                            try {
                                const response = await fetch('delete_category.php', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded',
                                    },
                                    body: `category_id=${selectedCategoryId}`
                                });
                                
                                const data = await response.json();
                                if (!data.success) {
                                    throw new Error(data.message || 'Failed to delete category');
                                }

                                // Kategória törlése a legördülő listából
                                const categoryFilter = document.getElementById('category-filter');
                                if (categoryFilter) {
                                    Array.from(categoryFilter.options).forEach((option, index) => {
                                        if (option.value === selectedCategoryId) {
                                            categoryFilter.remove(index);
                                        }
                                    });
                                }
                                
                                // Minden repository kategória választó frissítése
                                const allCategorySelects = document.querySelectorAll('.category-select');
                                allCategorySelects.forEach(select => {
                                    Array.from(select.options).forEach((option, index) => {
                                        if (option.value === selectedCategoryId && index >= 2) { // Skip "Create" and "Modify" options
                                            select.remove(index);
                                        }
                                    });
                                });
                                
                                // Modal bezárása
                                modal.hide();
                                modalContainer.dataset.categoryModified = true;
                                modalContainer.remove();
                                
                                // Frissítsük a kedvencek listáját
                                loadFavorites(1);
                                
                            } catch (error) {
                                console.error('Error deleting category:', error);
                                alert('Failed to delete category: ' + error.message);
                            }
                        }
                    });

                    // Modify gomb eseménykezelő
                    modifyBtn.addEventListener('click', async () => {
                        const categoryName = categoryInput.value.trim();
                        const selectedCategoryId = categorySelect.value;
                        const selectedCategoryName = categorySelect.options[categorySelect.selectedIndex].text;
                        
                        if (!categoryName) {
                            alert('Please enter a new category name');
                            return;
                        }

                        try {
                            const response = await fetch('modify_category.php', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    category_id: selectedCategoryId,
                                    new_category_name: categoryName
                                })
                            });
                            
                            const data = await response.json();
                            if (!data.success) {
                                throw new Error(data.message || 'Failed to modify category');
                            }

                            // Frissítjük a kategória nevet minden legördülő listában
                            
                            // Fő kategória szűrő frissítése
                            const categoryFilter = document.getElementById('category-filter');
                            if (categoryFilter) {
                                Array.from(categoryFilter.options).forEach(option => {
                                    if (option.value === selectedCategoryId) {
                                        option.textContent = categoryName;
                                    }
                                });
                            }
                            
                            // Minden repository kategória választó frissítése
                            const allCategorySelects = document.querySelectorAll('.category-select');
                            allCategorySelects.forEach(select => {
                                Array.from(select.options).forEach(option => {
                                    if (option.value === selectedCategoryId) {
                                        option.textContent = categoryName;
                                    }
                                });
                                
                                // Ha ez a kategória volt kiválasztva, frissítsük a kiválasztást
                                if (select.value === selectedCategoryId) {
                                    select.dispatchEvent(new Event('change'));
                                }
                            });
                            
                            // Modal bezárása
                            modal.hide();
                            // Sikeres módosítás jelzése (add hozzá ezt a sort)
                            modalContainer.dataset.categoryModified = true;
                            modalContainer.remove();
                            
                            // Visszaállítjuk az eredeti kategória kiválasztást
                            e.target.value = project.category_id || 'new';

                        } catch (error) {
                            console.error('Error modifying category:', error);
                            alert('Failed to modify category: ' + error.message);
                        }
                    });
                } else {
                    // Küldjük a kérés csak ha nem 'new' érték
                    const response = await fetch('update_category.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            repo_id: repoId,
                            category_id: selectedValue
                        })
                    });
                }
            });
        }

        // Megjegyzés mező eseménykezelő
        const notesInput = projectCard.querySelector('.individual-notes');
        if (notesInput) {
            notesInput.addEventListener('blur', async function() {
                const repoId = this.dataset.repoId;
                const notes = this.value;
                
                try {
                    const response = await fetch('update_notes.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            repo_id: parseInt(repoId),
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
                    
                    console.log('Notes saved successfully');
                } catch (error) {
                    console.error('Error saving notes:', error);
                    alert('Failed to save notes: ' + error.message);
                }
            });
        }
    }

    container.appendChild(projectCard);
    return projectCard; // Visszaadjuk a kártyát, hogy a fade-in animáció működhessen
}

// Kedvenc fejlesztők számának frissítése
async function updateDevelopersCount() {
    try {
        const response = await fetch('get_favorite_developers.php');
        if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.developers)) {
                // document.getElementById('developers-count').textContent = data.developers.length.toString();
            }
        }
    } catch (error) {
        console.error('Error updating developers count:', error);
    }
}

// Keresési opciók szövegének frissítése
function updateSearchOptionsText() {
    const optionsText = [];
    
    // Name Match opciók ellenőrzése
    if (document.getElementById('search-name-approx').checked) {
        optionsText.push('Name: Approximate match');
    }
    if (document.getElementById('search-name-exact').checked) {
        optionsText.push('Name: Exact match');
    }

    // Description Match opciók ellenőrzése
    if (document.getElementById('search-desc-approx').checked) {
        optionsText.push('Description: Description match');
    }
    
    // Additional Options ellenőrzése
    if (document.getElementById('search-readme').checked) {
        optionsText.push('Search in README');
    }
    if (document.getElementById('search-new-week').checked) {
        optionsText.push('New This Week');
    }

    // Kiválasztott nyelvek összegyűjtése
    const selectedLanguages = Array.from(document.querySelectorAll('.language-item input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);
    if (selectedLanguages.length > 0) {
        optionsText.push('Languages: ' + selectedLanguages.join(', '));
    }

    // Opciók megjelenítése
    const optionsElement = document.getElementById('current-search-options');
    if (optionsText.length > 0) {
        optionsElement.textContent = optionsText.join(' | ');
        optionsElement.style.display = 'block';
    } else {
        optionsElement.style.display = 'none';
    }
}

// Event listener hozzáadása az összes keresési opcióhoz
document.addEventListener('DOMContentLoaded', () => {
    // Clear stored search terms to start fresh
    localStorage.removeItem('fixSearchTerms');
    
    const allOptions = document.querySelectorAll('.search-option, .language-checkboxes input');
    allOptions.forEach(option => {
        option.addEventListener('change', updateSearchOptionsText);
    });
    
    // Kezdeti állapot beállítása
    updateSearchOptionsText();
});

document.addEventListener('DOMContentLoaded', updateDevelopersCount);

document.addEventListener('DOMContentLoaded', () => {
    updateTokenButtonState();
    loadStoredSearchTerms();

    // Custom search beállítása alapértelmezettként
    customSearchToggle.checked = true;
    customSearchContainer.style.display = 'block';
    searchTopicContainer.style.display = 'none';
    addToFixListBtn.style.display = 'block';
    customSearchInput.value = 'Weekly repository offer';
    updateSearchTitle('Weekly repository offer');

    // Manual search button click handler
    document.getElementById('manual-search-button').addEventListener('click', async () => {
        await updateDevelopersCount();
        resetAndSearch();
    });

    // Kezdeti rate limit lekérése
    updateRateLimit();
    
    if (loadMoreButton) {
        loadMoreButton.textContent = 'Content loading...';
        loadMoreButton.disabled = true;
    }
    
    // Kezdeti ajánlatok betöltése indításkor a heti ajánlatok helyett
    if (typeof loadStartRepos === 'function') {
        loadStartRepos();
    } else {
        // Ha a loadStartRepos függvény nem elérhető, akkor a normál keresést indítjuk
        resetAndSearch();
    }
    
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', () => {
            loadMoreButton.disabled = true;
            loadMoreButton.textContent = 'Loading...';
            
            currentPage++; // Növeljük az oldalszámot
            
            loadProjects(currentPage).then(() => {
                loadMoreButton.disabled = false;
                loadMoreButton.textContent = 'Load More';
            }).catch(error => {
                loadMoreButton.textContent = 'Error loading more content';
                console.error('Error:', error);
                currentPage--; // Hiba esetén visszaállítjuk az oldalszámot
            });
        });
    }

    // Rendezési sorrend változásának kezelése
    sortSelect.addEventListener('change', () => {
        currentPage = 1;
        projectsContainer.innerHTML = '';
        if (loadMoreButton) {
            loadMoreButton.style.display = 'block';
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 'flex';
            }
        }
        
        loadProjects(currentPage).then(() => {
            if (loadMoreButton) {
                loadMoreButton.textContent = 'Load More';
                loadMoreButton.disabled = false;
            }
        }).catch(error => {
            if (loadMoreButton) {
                loadMoreButton.textContent = 'Error loading content';
            }
            console.error('Error:', error);
        });
    });

    // Keresési téma változásának kezelése
    searchTopic.addEventListener('change', () => {
        currentPage = 1;
        projectsContainer.innerHTML = '';
        if (loadMoreButton) {
            loadMoreButton.style.display = 'block';
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 'flex';
            }
        }
        
        updateSearchTitle(searchTopic.value);
        resetAndSearch();
    });

    document.querySelectorAll('.search-option').forEach(checkbox => {
        checkbox.addEventListener('change', () => handleSearchOptionChange(checkbox));
    });

    addToFixListBtn.addEventListener('click', addToFixList);

    // Kizárólagos opciók kezelése
    const newThisWeekCheckbox = document.getElementById('search-new-week');

    if (weeklySpotlightCheckbox) {
        weeklySpotlightCheckbox.addEventListener('change', function() {
            if (this.checked && newThisWeekCheckbox) {
                newThisWeekCheckbox.checked = false;
                loadWeeklySpotlight();
            }
        });
    }

    if (newThisWeekCheckbox) {
        newThisWeekCheckbox.addEventListener('change', function() {
            if (this.checked && weeklySpotlightCheckbox) {
                weeklySpotlightCheckbox.checked = false;
            }
        });
    }
});

async function loadWeeklySpotlight() {
    try {
        const response = await fetch('https://api.github.com/repos/Codeium/weekly-spotlight');
        const data = await response.json();
        const projects = data.data;

        const projectsContainer = document.getElementById('projects-container');
        projectsContainer.innerHTML = '';

        for (const project of projects) {
            const card = await createProjectCard(project);
            projectsContainer.appendChild(card);
        }

        if (loadMoreButton) {
            loadMoreButton.style.display = 'none';
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading weekly spotlight:', error);
    }
}

// GitHub bejelentkezés már a fő gombbal történik
// A regisztrációs form kezelése eltávolítva

// Input validáció már nem szükséges, mert GitHub OAuth bejelentkezést használunk

// GitHub token szinkronizálása a PHP munkamenetből a sessionStorage-be
async function syncGitHubToken() {
    try {
        const response = await fetch('get_session_token.php');
        const data = await response.json();
        
        if (data.success && data.token) {
            console.log('GitHub token szinkronizálva a sessionStorage-be');
            sessionStorage.setItem('oauth_github_token', data.token);
            return true;
        } else {
            console.log('Nincs GitHub token a PHP munkamenetben');
            sessionStorage.removeItem('oauth_github_token');
            return false;
        }
    } catch (error) {
        console.error('Hiba a GitHub token szinkronizálása során:', error);
        return false;
    }
}

// Check login status on page load
async function checkLoginStatus() {
    try {
        // Első lépésként megpróbáljuk szinkronizálni a GitHub tokent,
        // még az API lekérdezések előtt - Ez kulcsfontosságú az oldal betöltéskor!
        await syncGitHubToken();
        
        const response = await fetch('check_session.php');
        const data = await response.json();

        if (data.logged_in) {
            document.getElementById('auth-buttons').classList.add('d-none');
            document.getElementById('user-info').classList.remove('d-none');
            
            // Felhasználónév és avatár megjelenítése
            let usernameElement = document.getElementById('username-display');
            
            // GitHub avatár megjelenítése, ha van
            if (data.github_user && data.github_avatar) {
                // Avatár hozzáadása a felhasználónévhez
                usernameElement.innerHTML = `
                    <div class="d-flex align-items-center">
                        <img src="${data.github_avatar}" class="github-avatar rounded-circle me-2" width="24" height="24">
                        <button class="btn btn-outline-primary">${data.username}</button>
                    </div>
                `;
            } else {
                usernameElement.innerHTML = `<button class="btn btn-outline-primary">${data.username}</button>`;
            }
            
            document.getElementById('category-filter').classList.remove('d-none');
            await loadUserCategories();
            await updateDevelopersCount();
            
            // Frissítsük a token gomb állapotát és az API limitet
            updateTokenButtonState();
            
            // Azonnal frissítsük az API rate limit adatokat a token szinkronizálás után
            // Ez biztosítja, hogy a bejelentkezés után azonnal a helyes értékek jelenjenek meg
            await updateRateLimit();
            console.log("API rate limit frissítve oldal betöltéskor");
        } else {
            // Kiléptetett állapot
            document.getElementById('auth-buttons').classList.remove('d-none');
            document.getElementById('user-info').classList.add('d-none');
            document.getElementById('category-filter').classList.add('d-none');
            
            // Töröljük a sessionStorage-ban tárolt GitHub tokent
            sessionStorage.removeItem('oauth_github_token');
            
            // Frissítsük az API rate limit adatokat a token törlés után is
            await updateRateLimit();
            console.log("API rate limit frissítve kijelentkezési állapotban");
        }
    } catch (error) {
        console.error('Error checking login status:', error);
    }
}

// URL paraméterek kiolvasására szolgáló segédfüggvény
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Call checkLoginStatus when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Ellenőrizzük, hogy friss bejelentkezés történt-e (az URL-ben login_success=true paraméter)
    const loginSuccess = getUrlParameter('login_success');
    
    if (loginSuccess === 'true') {
        console.log('Friss bejelentkezés érzékelve! Azonnali token szinkronizálás és API limit frissítés');
        
        // Azért, hogy a felhasználó lássa, hogy történik valami, máris frissítsük az API státusz szöveget
        const apiStatusIndicator = document.getElementById('api-status-indicator');
        if (apiStatusIndicator) {
            apiStatusIndicator.textContent = 'GitHub OAuth API bekapcsolása...';
            apiStatusIndicator.classList.add('active');
        }
        
        // Azonnali token szinkronizálás és API frissítés
        (async function() {
            try {
                await syncGitHubToken();
                await updateRateLimit();
                console.log('API rate limit sikeresen frissítve bejelentkezés után');
                
                // Távolítsuk el az URL-ből a login_success paramétert, hogy frissítéskor ne aktivizálódjon újra
                const url = new URL(window.location);
                url.searchParams.delete('login_success');
                window.history.replaceState({}, document.title, url);
            } catch (error) {
                console.error('Hiba történt a bejelentkezés utáni API frissítés során:', error);
            }
        })();
    }
    
    // Normál bejelentkezési állapot ellenőrzés
    checkLoginStatus();
});

// Event listener for logout button
document.getElementById('logout-button').addEventListener('click', async function(e) {
    e.preventDefault();
    try {
        const response = await fetch('logout.php', {
            method: 'POST',
            credentials: 'same-origin'
        });
        const data = await response.json();
        
        if (data.success) {
            // UI frissítése kijelentkezett állapotra
            document.getElementById('auth-buttons').classList.remove('d-none');
            document.getElementById('user-info').classList.add('d-none');
            document.getElementById('username-display').innerHTML = '';
            
            // Kategória legördülő elrejtése és alaphelyzetbe állítása
            const categoryFilter = document.getElementById('category-filter');
            categoryFilter.classList.add('d-none');
            categoryFilter.innerHTML = '<option value="all" selected>All</option>';
            
            // Kedvencek lista elrejtése
            const searchResults = document.getElementById('search-results');
            if (searchResults) {
                searchResults.style.display = 'none';
            }
            
            // Kedvencek számának nullázása
            const favoritesCount = document.getElementById('favorites-count');
            if (favoritesCount) {
                favoritesCount.textContent = '0';
            }
            
            // Töröljük a sessionStorage-ban tárolt OAuth tokent
            sessionStorage.removeItem('oauth_github_token');
            
            // Frissítsük a token gomb állapotát
            updateTokenButtonState();
            
            // API használati információk frissítése kis késleltetéssel,
            // hogy a token törlés után megfelelő legyen a lehívás
            setTimeout(async () => {
                await updateRateLimit();
                console.log("API rate limit frissítve kijelentkezés után");
            }, 500);
        }
    } catch (error) {
        console.error('Hiba történt a kijelentkezés során:', error);
    }
});

async function displayUserInfo(username) {
    document.getElementById('auth-buttons').classList.add('d-none');
    document.getElementById('user-info').classList.remove('d-none');
    document.getElementById('username-display').innerHTML = `<button class="btn btn-outline-primary">${username}</button>`;
    document.getElementById('category-filter').classList.remove('d-none');
    
    // Először szinkronizáljuk a GitHub tokent a PHP munkamenetből a sessionStorage-be
    await syncGitHubToken();
    
    // Most már helyes tokennel frissíthetjük az API használati információkat
    setTimeout(async () => {
        await updateRateLimit();
        console.log("API rate limit frissítve bejelentkezés után");
    }, 500);
}

function saveToken(token) {
    // A manuális token megadást már nem támogatjuk, csak az OAuth bejelentkezést
    alert('Manual token input is no longer supported. Please use GitHub OAuth login.');
    updateTokenButtonState();
}

function loadToken() {
    // Csak az OAuth tokent használjuk
    return sessionStorage.getItem('oauth_github_token');
}

function updateTokenButtonState() {
    const token = sessionStorage.getItem('oauth_github_token');
    
    const apiStatusIndicator = document.getElementById('api-status-indicator');
    if (!apiStatusIndicator) return;
    
    apiStatusIndicator.classList.remove('active');
    
    if (token) {
        apiStatusIndicator.classList.add('active');
        apiStatusIndicator.textContent = 'GitHub OAuth API active';
    } else {
        apiStatusIndicator.textContent = 'Login Required';
    }
}

saveTokenButton.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token) {
        saveToken(token);
        tokenInput.value = '';
        tokenModal.hide();
        // Token beállítása után újratöltjük az adatokat
        resetAndSearch();
    }
});

// Custom search toggle kezelése
customSearchToggle.addEventListener('change', function() {
    if (this.checked) {
        customSearchContainer.style.display = 'block';
        searchTopicContainer.style.display = 'none';
        addToFixListBtn.style.display = 'block';
        customSearchContainer.classList.add('active');
    } else {
        customSearchContainer.style.display = 'none';
        searchTopicContainer.style.display = 'block';
        addToFixListBtn.style.display = 'none';
        customSearchContainer.classList.remove('active');
    }
});

// Custom search input kezelése (enter lenyomására keres)
customSearchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        if (!this.value.trim()) {
            alert('Please enter a search term');
            return;
        }
        updateSearchTitle(this.value.trim());
        resetAndSearch();
    }
});

// Keresés újraindítása
async function resetAndSearch() {
    currentPage = 1;
    projectsContainer.style.opacity = '0.5';
    if (loadMoreButton) {
        loadMoreButton.disabled = true;
        loadMoreButton.textContent = 'Loading...';
        if (loadMoreContainer) {
            loadMoreContainer.style.display = 'none';
        }
    }

    const searchTerm = customSearchToggle.checked ? 
        customSearchInput.value.trim() : 
        searchTopic.value;

    loadProjects(currentPage).then(() => {
        if (loadMoreButton) {
            loadMoreButton.textContent = 'Load More';
            loadMoreButton.disabled = false;
        }
    }).catch(error => {
        if (loadMoreButton) {
            loadMoreButton.textContent = 'Error loading content';
        }
        console.error('Error:', error);
    });
}

// Hiba megjelenítése
function showError(message) {
    // Ellenőrizzük, hogy létezik-e a results-list konténer
    let container = document.getElementById('results-list');
    
    // Ha nem létezik, próbáljuk meg létrehozni
    if (!container) {
        container = document.createElement('div');
        container.id = 'results-list';
        container.className = 'row';
        
        // Keressük meg a szülő konténert
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
            searchResults.appendChild(container);
        } else {
            // Ha nincs search-results konténer, hozzuk létre azt is
            const searchResults = document.createElement('div');
            searchResults.id = 'search-results';
            searchResults.className = 'container mt-4';
            searchResults.appendChild(container);
            
            // Adjuk hozzá a dokumentumhoz
            document.body.appendChild(searchResults);
        }
    }

    // Hiba megjelenítése
    container.innerHTML = `
        <div class="col-12 text-center">
            <div class="alert alert-danger" role="alert">
                ${message}
            </div>
        </div>
    `;
}

// Load user categories and populate dropdown
async function loadUserCategories() {
    try {
        const response = await fetch('get_categories.php');
        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error('Failed to load categories:', data.message);
            return;
        }

        const categoryFilter = document.getElementById('category-filter');
        categoryFilter.innerHTML = '<option value="all" selected>All</option>';

        data.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id; // Itt használjuk az ID-t a név helyett
            option.textContent = category.name;
            categoryFilter.appendChild(option);
        });

        // Show category filter if user is logged in
        categoryFilter.classList.remove('d-none');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Kategória törlés gomb és select kezelése
const categoryFilter = document.getElementById('category-filter');
//const deleteCategoryBtn = document.getElementById('delete-category-btn');

// Kategória választó eseménykezelő
categoryFilter.addEventListener('change', () => {
    const selectedOption = categoryFilter.options[categoryFilter.selectedIndex];
    const selectedValue = selectedOption.value;
    const selectedText = selectedOption.textContent;

    loadFavorites(1);
});

// README betöltése
document.addEventListener('DOMContentLoaded', function() {
    // README modal megnyitásakor töltjük be a tartalmat közvetlenül a helyi README.md fájlból
    document.querySelector('[data-bs-target="#readmeModal"]').addEventListener('click', async function() {
        const readmeContent = document.getElementById('readme-content');
        readmeContent.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        
        try {
            // Helyi README.md fájl betöltése
            console.log('Loading local README.md file');
            const localResponse = await fetch('README.md');
            
            if (!localResponse.ok) {
                throw new Error('Failed to load README locally');
            }
            
            const localContent = await localResponse.text();
            
            // Markdown formázás
            if (typeof marked !== 'undefined') {
                // Marked.js beállítások
                marked.setOptions({
                    gfm: true,
                    breaks: true,
                    headerIds: true,
                    mangle: false
                });
                
                // Markdown tartalom formázása
                const formattedContent = marked.parse(localContent);
                
                // Ideiglenes div a HTML tartalom kezeléséhez
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = formattedContent;
                
                // Relatív képhivatkozások kezelése a helyi fájlrendszerben
                tempDiv.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src');
                    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                        // Relatív hivatkozás megtartása, hogy a helyi képek betöltődjenek
                        // A ./ kezdetű útvonalakat külön kezeljük
                        const cleanSrc = src.startsWith('./') ? src.substring(2) : src;
                        img.src = cleanSrc;
                    }
                });
                
                // Videók kezelése
                tempDiv.querySelectorAll('video source').forEach(source => {
                    const src = source.getAttribute('src');
                    if (src && !src.startsWith('http')) {
                        // A ./ kezdetű útvonalakat külön kezeljük
                        const cleanSrc = src.startsWith('./') ? src.substring(2) : src;
                        source.src = cleanSrc;
                    }
                });
                
                // Linkek kezelése
                tempDiv.querySelectorAll('a').forEach(link => {
                    const href = link.getAttribute('href');
                    if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
                        // A ./ kezdetű útvonalakat külön kezeljük
                        const cleanHref = href.startsWith('./') ? href.substring(2) : href;
                        
                        // Csak a repository-n belüli linkek kezelése
                        if (cleanHref.endsWith('.md') || cleanHref.endsWith('.markdown')) {
                            // Markdown fájlokra mutató linkek megtartása
                            link.href = cleanHref;
                        } else {
                            // Egyéb fájlokra mutató linkek megtartása
                            link.href = cleanHref;
                        }
                    }
                });
                
                readmeContent.innerHTML = tempDiv.innerHTML;
            } else {
                readmeContent.innerHTML = localContent;
            }
        } catch (error) {
            console.error('Error loading README from GitHub:', error);
            
            // Ha a GitHub API hívás nem sikerül, próbáljuk meg a helyi fájlt betölteni
            try {
                const localResponse = await fetch('README.md');
                if (!localResponse.ok) {
                    throw new Error('Failed to load README locally');
                }
                const localContent = await localResponse.text();
                
                if (typeof marked !== 'undefined') {
                    // Relatív hivatkozások átalakítása abszolút hivatkozásokká
                    const formattedContent = marked.parse(localContent);
                    
                    // Ideiglenes div a HTML tartalom kezeléséhez
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = formattedContent;
                    
                    // Képek és videók relatív hivatkozásainak javítása
                    const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/`;
                    
                    // Képek kezelése
                    tempDiv.querySelectorAll('img').forEach(img => {
                        const src = img.getAttribute('src');
                        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                            // Relatív hivatkozás átalakítása abszolút hivatkozássá
                            img.src = new URL(src, baseUrl).href;
                        }
                    });
                    
                    // Videók kezelése
                    tempDiv.querySelectorAll('video source').forEach(source => {
                        const src = source.getAttribute('src');
                        if (src && !src.startsWith('http')) {
                            source.src = new URL(src, baseUrl).href;
                        }
                    });
                    
                    // Linkek kezelése
                    tempDiv.querySelectorAll('a').forEach(link => {
                        const href = link.getAttribute('href');
                        if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
                            // Csak a repository-n belüli linkek kezelése
                            if (href.endsWith('.md') || href.endsWith('.markdown')) {
                                // Markdown fájlokra mutató linkek átalakítása GitHub linkekké
                                link.href = `https://github.com/${owner}/${repo}/blob/master/${href}`;
                            } else {
                                // Egyéb fájlokra mutató linkek átalakítása raw linkekké
                                link.href = new URL(href, baseUrl).href;
                            }
                        }
                    });
                    
                    readmeContent.innerHTML = tempDiv.innerHTML;
                } else {
                    throw new Error('Marked.js library not loaded');
                }
            } catch (localError) {
                readmeContent.innerHTML = `<div class="alert alert-danger">
                    Failed to load README content. Error: ${error.message}
                </div>`;
            }
        }
    });
});

// Kategória szűrő eseménykezelő
document.getElementById('category-filter').addEventListener('change', function(e) {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const selectedText = selectedOption.textContent;

    loadFavorites(1);
});

// README megjelenítő függvény
async function displayReadmeContent(owner, repo, modalBody) {
    try {
        const response = await fetch(`get_readme.php?owner=${owner}&repo=${repo}`);
        const data = await response.json();
        
        if (data.success) {
            // Markdown formázás
            const formattedContent = marked.parse(data.content);
            
            // Ideiglenes div a HTML tartalom kezeléséhez
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formattedContent;
            
            // Képek és videók relatív hivatkozásainak javítása
            const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/`;
            
            // Képek kezelése
            tempDiv.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                    // Relatív hivatkozás átalakítása abszolút hivatkozássá
                    // A ./ kezdetű útvonalakat külön kezeljük
                    const cleanSrc = src.startsWith('./') ? src.substring(2) : src;
                    img.src = `${baseUrl}${cleanSrc}`;
                }
            });
            
            // Videók kezelése
            tempDiv.querySelectorAll('video source').forEach(source => {
                const src = source.getAttribute('src');
                if (src && !src.startsWith('http')) {
                    // A ./ kezdetű útvonalakat külön kezeljük
                    const cleanSrc = src.startsWith('./') ? src.substring(2) : src;
                    source.src = `${baseUrl}${cleanSrc}`;
                }
            });
            
            // Linkek kezelése
            tempDiv.querySelectorAll('a').forEach(link => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
                    // A ./ kezdetű útvonalakat külön kezeljük
                    const cleanHref = href.startsWith('./') ? href.substring(2) : href;
                    
                    // Csak a repository-n belüli linkek kezelése
                    if (cleanHref.endsWith('.md') || cleanHref.endsWith('.markdown')) {
                        // Markdown fájlokra mutató linkek átalakítása GitHub linkekké
                        link.href = `https://github.com/${owner}/${repo}/blob/master/${cleanHref}`;
                    } else {
                        // Egyéb fájlokra mutató linkek átalakítása raw linkekké
                        link.href = `${baseUrl}${cleanHref}`;
                    }
                }
            });
            
            modalBody.innerHTML = `
                <div class="readme-content">
                    ${tempDiv.innerHTML}
                </div>
            `;
        } else {
            throw new Error(data.message || 'Failed to load README');
        }
    } catch (error) {
        console.error('Error loading README:', error);
        modalBody.innerHTML = `
        <div class="alert alert-danger">
            Failed to load README content. Error: ${error.message}
        </div>`;
    }
}

// A favoriteDevelopers globális változó már a fájl elején deklarálva van

// Fejlesztő ellenőrzése a kedvencek között
function isDeveloperFavorite(ownerLogin) {
    // Biztonsági ellenőrzés: ha a favoriteDevelopers még nincs inicializálva
    if (!Array.isArray(favoriteDevelopers)) {
        return false;
    }
    return favoriteDevelopers.some(dev => dev.login.toLowerCase() === ownerLogin.toLowerCase());
}

// Kedvenc fejlesztők betöltése
async function loadFavoriteDevelopers() {
    if (document.getElementById('user-info').classList.contains('d-none')) {
        return [];
    }

    try {
        const response = await fetch('get_favorite_developers.php');
        const data = await response.json();
        if (data.success) {
            favoriteDevelopers = data.developers;
            return data.developers;
        }
    } catch (error) {
        console.error('Error loading favorite developers:', error);
    }
    return [];
}

// Event listener hozzáadása a DOM betöltéséhez
document.addEventListener('DOMContentLoaded', async () => {
    // Kedvenc fejlesztők betöltése
    await loadFavoriteDevelopers();
    
    // Meglévő eseménykezelők...
});

// saveDeveloper függvény módosítása
async function saveDeveloper(owner, button) {
    if (document.getElementById('user-info').classList.contains('d-none')) {
        alert('Please log in to use this feature');
        return;
    }

    try {
        // Ellenőrizzük, hogy a gomb szövege '-Dev.' (tehát már kedvenc)
        const isRemoving = button.textContent.trim() === '-Dev.';
        
        // Megfelelő PHP endpoint kiválasztása
        const endpoint = isRemoving ? 'remove_favorite_developer.php' : 'save_favorite_developer.php';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `owner=${encodeURIComponent(owner)}`
        });

        const data = await response.json();
        
        if (data.success) {
            if (isRemoving) {
                // Ha törlés történt, visszaállítjuk az eredeti állapotot
                button.style.setProperty('background-color', '', 'important');
                button.textContent = '+Dev.';
            } else {
                // Ha hozzáadás történt, beállítjuk a kedvenc állapotot
                button.style.setProperty('background-color', '#ffff00', 'important');
                button.textContent = '-Dev.';
            }
            // Frissítjük a kedvenc fejlesztők listáját
            await loadFavoriteDevelopers();
            await updateDevelopersCount();
        } else {
            alert(data.message || 'Failed to update developer favorites');
        }
    } catch (error) {
        console.error('Error updating developer favorites:', error);
        alert('An error occurred while updating developer favorites');
    }
}
