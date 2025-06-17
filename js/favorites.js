/**
 * GitHub Repository Search - Favorites Module
 * 
 * Ez a modul a kedvencekkel kapcsolatos funkciókat tartalmazza
 */

// Kedvencek számának frissítése
async function updateFavoritesCount() {
    try {
        const response = await fetch('get_favorites.php');
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // A teljes kedvencek számának megjelenítése a total_count alapján
                document.getElementById('favorites-count').textContent = data.total_count.toString();
            }
        }
    } catch (error) {
        console.error('Error updating favorites count:', error);
    }
}

// Kedvenc hozzáadása vagy eltávolítása
async function saveFavorite(project, button) {
    // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
    if (!document.getElementById('user-info').classList.contains('d-none')) {
        try {
            console.log('Checking favorite status for project:', project);
            
            // Repository statisztikák lekérése
            const [owner, repo] = project.full_name.split('/');
            let languages = {};
            try {
                languages = await getRepositoryLanguages(owner, repo);
            } catch (error) {
                console.warn('Error fetching repository languages:', error);
                // Hiba esetén üres objektum marad a languages
            }
            
            // Közreműködők számának lekérése
            let contributorsCount = 0;
            try {
                const contributorsUrl = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1&anon=true`;
                const contributorsResponse = await fetch(contributorsUrl, {
                    headers: getHeaders()
                });
                
                // Ha a válasz nem OK (pl. 404), akkor üres repositorynak tekintjük
                if (!contributorsResponse.ok) {
                    console.log(`Repository ${owner}/${repo} has no contributors or is empty`);
                } else {
                    // A Link header ellenőrzése az összes közreműködő számához
                    const contributorsLinkHeader = contributorsResponse.headers.get('Link');
                    
                    if (contributorsLinkHeader) {
                        // Ha van Link header, akkor több oldal van
                        const matches = contributorsLinkHeader.match(/page=(\d+)>; rel="last"/);
                        if (matches) {
                            contributorsCount = parseInt(matches[1]);
                        }
                    } else {
                        // Ha nincs Link header, akkor csak egy oldal van
                        const contributors = await contributorsResponse.json();
                        contributorsCount = Array.isArray(contributors) ? contributors.length : 0;
                    }
                }
            } catch (error) {
                console.warn('Error fetching contributors:', error);
                // Hiba esetén 0 marad a contributorsCount
            }
            
            // Commitok számának lekérése
            let commitsCount = 0;
            try {
                const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits`;
                const commitsResponse = await fetch(commitsUrl, {
                    headers: getHeaders()
                });
                
                // Ha a válasz nem OK (pl. 404), akkor üres repositorynak tekintjük
                if (!commitsResponse.ok) {
                    console.log(`Repository ${owner}/${repo} has no commits or is empty`);
                } else {
                    // A Link header ellenőrzése az összes oldal számához
                    const linkHeader = commitsResponse.headers.get('Link');
                    
                    if (linkHeader) {
                        // Ha van Link header, akkor több oldal van
                        const matches = linkHeader.match(/page=(\d+)>; rel="last"/);
                        if (matches) {
                            const lastPage = parseInt(matches[1]);
                            // Az utolsó oldal száma szorozva az oldalankénti elemszámmal (30 az alapértelmezett)
                            commitsCount = (lastPage - 1) * 30;
                        }
                        // Hozzáadjuk az utolsó oldal commitjait
                        const commits = await commitsResponse.json();
                        commitsCount += Array.isArray(commits) ? commits.length : 0;
                    } else {
                        // Ha nincs Link header, akkor csak egy oldal van
                        const commits = await commitsResponse.json();
                        commitsCount = Array.isArray(commits) ? commits.length : 0;
                    }
                }
            } catch (error) {
                console.warn('Error fetching commits:', error);
                // Hiba esetén 0 marad a commitsCount
            }
            
            // Ellenőrizzük, hogy a projekt már kedvenc-e
            const checkResponse = await fetch('check_favorite.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    repo_id: project.id
                })
            });

            console.log('Check favorite response:', checkResponse);
            if (!checkResponse.ok) {
                throw new Error('Failed to check favorite status');
            }

            const checkData = await checkResponse.json();
            console.log('Check favorite data:', checkData);
            const { isFavorite } = checkData;

            // Projekt adatok előkészítése
            const projectData = {
                repo_id: project.id,
                name: project.name,
                full_name: project.full_name,
                description: project.description || '',
                html_url: project.html_url,
                owner: project.owner.login,
                owner_url: project.owner.html_url,
                stars_count: project.stargazers_count,
                forks_count: project.forks_count,
                updated_at: project.updated_at,
                contributors_count: contributorsCount,
                commits_count: commitsCount,
                languages: languages
            };

            console.log('Sending project data:', projectData);

            // Kedvenc hozzáadása vagy eltávolítása
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

            console.log('Add favorite response:', response);
            if (!response.ok) {
                throw new Error('Failed to update favorite');
            }

            const result = await response.json().catch(async error => {
                console.error('JSON Error:', error);
                const rawResponse = await response.text();
                console.error('Raw Response:', rawResponse);
                throw new Error(`Invalid response: ${rawResponse.slice(0, 100)}`);
            });

            if (result.success) {
                // Gomb megjelenésének frissítése
                button.style.setProperty('background-color', !isFavorite ? 'yellow' : 'gray', 'important');
                button.textContent = !isFavorite ? '-My favourite' : '+My favourite';

                // Kedvencek számának frissítése
                await updateFavoritesCount();

                // Ha a kedvencek listában vagyunk és töröltük a kedvencet, távolítsuk el a kártyát
                if (isFavorite && window.location.pathname.includes('favorites.php')) {
                    const card = button.closest('.col-md-4');
                    if (card) {
                        card.remove();
                    }
                }
            } else {
                throw new Error(result.message || 'Failed to update favorite');
            }

        } catch (error) {
            console.error('Error handling favorite:', error);
            console.error('Error details:', error.stack || '<no stack>');
            
            // Az üres repository kezelése barátságosabb módon
            if (error.message && error.message.includes('JSON')) {
                alert('It seems this repository is empty. We added it to your favorites, but some statistics may be missing.');
                
                // Próbáljuk meg minimális adatokkal hozzáadni a kedvencekhez
                try {
                    const minimalProjectData = {
                        repo_id: project.id,
                        name: project.name,
                        full_name: project.full_name,
                        description: project.description || '',
                        html_url: project.html_url,
                        owner: project.owner.login,
                        owner_url: project.owner.html_url,
                        stars_count: project.stargazers_count || 0,
                        forks_count: project.forks_count || 0,
                        updated_at: project.updated_at || new Date().toISOString(),
                        contributors_count: 0,
                        commits_count: 0,
                        languages: {}
                    };
                    
                    const emergencyResponse = await fetch('add_favorite.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'add',
                            repo_data: minimalProjectData
                        })
                    });
                    
                    if (emergencyResponse.ok) {
                        button.style.setProperty('background-color', 'yellow', 'important');
                        button.textContent = '-My favourite';
                        await updateFavoritesCount();
                    }
                } catch (innerError) {
                    console.error('Failed to add empty repository to favorites:', innerError);
                    alert('Error: Unable to add empty repository to favorites');
                }
            } else {
                alert('Error: ' + error.message);
            }
        }
    } else {
        console.log('User not logged in');
        alert('Please log in to use the favorites feature');
    }
}

// Kedvencek betöltése
async function loadFavorites(page = 1, reset = true) {
    try {
        // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
        if (document.getElementById('user-info').classList.contains('d-none')) {
            // Közös showLoginRequiredMessage függvény használata
            if (typeof showLoginRequiredMessage === 'function') {
                showLoginRequiredMessage();
            } else {
                // Tartalék megoldás, ha a függvény nem elérhető
                alert('The Favorites feature is only available after you have logged in!');
            }
            return;
        }

        // Lapozási változók inicializálása
        if (reset) {
            loadFavorites.currentPage = 1;
            loadFavorites.hasMoreItems = false;
            loadFavorites.totalItems = 0;
        } else {
            loadFavorites.currentPage = page;
        }

        // Keresési elemek elrejtése és törlése
        const searchControls = document.querySelector('.card.mb-4');
        if (searchControls) {
            searchControls.style.display = 'none';
        }
        
        document.getElementById('current-search-text').style.display = 'none';
        document.getElementById('current-search-options').style.display = 'none';
        document.getElementById('custom-search').value = '';

        // Kedvencek számának frissítése
        await updateFavoritesCount();
        
        // Kategória szűrő újratöltése az adatbázisból
        // Mentsük el a jelenleg kiválasztott kategória értékét
        const categoryFilter = document.getElementById('category-filter');
        let currentSelectedValue = categoryFilter.value;
        
        // Frissítsük a kategória listát az adatbázisból
        await loadUserCategories();
        
        // Próbáljuk meg visszaállítani a korábban kiválasztott értéket
        if (currentSelectedValue && categoryFilter.querySelector(`option[value="${currentSelectedValue}"]`)) {
            categoryFilter.value = currentSelectedValue;
        } else {
            // Ha a korábban kiválasztott érték már nem létezik, állítsuk "all"-ra
            categoryFilter.value = "all";
        }
        
        // Get selected category
        const selectedCategory = categoryFilter.value;
        const selectedCategoryName = selectedCategory === 'all' ? 'all' : categoryFilter.options[categoryFilter.selectedIndex].textContent;

        // Load More gomb elrejtése az új adatok betöltése előtt - mindig elrejtjük először
        const loadMoreBtn = document.getElementById('load-more-favorites');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = 'none';
        }
        
        // A keresés "Load More" gombjának elrejtése - NEM távolítjuk el, csak elrejtjük
        const searchLoadMoreBtn = document.getElementById('load-more');
        if (searchLoadMoreBtn) {
            // A gombot is elrejtjük
            searchLoadMoreBtn.style.display = 'none';
            
            // A szülő konténert is elrejtjük, de nem távolítjuk el
            const parentContainer = searchLoadMoreBtn.closest('.d-flex.justify-content-center');
            if (parentContainer) {
                parentContainer.style.display = 'none';
            }
        }

        // Ha az első oldalt töltjük be, mutassunk töltés jelzőt
        if (reset) {
            const loadingIndicator = document.getElementById('loading-indicator') || document.createElement('div');
            if (!document.getElementById('loading-indicator')) {
                loadingIndicator.id = 'loading-indicator';
                loadingIndicator.className = 'text-center my-4';
                loadingIndicator.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
                document.body.appendChild(loadingIndicator);
            }
            loadingIndicator.style.display = 'block';
        }

        // Adatok lekérése a szervertől lapozási paraméterekkel
        const response = await fetch(`get_favorites.php?category=${selectedCategoryName}&page=${page}&limit=50`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error('Server response:', data);
            throw new Error(data.message || 'Failed to fetch favorites');
        }

        // Mentjük a teljes elemszámot
        loadFavorites.totalItems = data.total_count || 0;
        
        // Ellenőrizzük, hogy van-e még több betölthető elem a legpontosabb módon
        const currentlyLoadedCount = (page - 1) * 50 + (data.favorites ? data.favorites.length : 0);
        loadFavorites.hasMoreItems = currentlyLoadedCount < loadFavorites.totalItems;
        
        console.log(`Pagination info: Total items: ${loadFavorites.totalItems}, Currently loaded: ${currentlyLoadedCount}, Has more: ${loadFavorites.hasMoreItems}`);

        // Projektek konténer elrejtése
        const projectsContainer = document.getElementById('projects-container');
        if (projectsContainer) {
            projectsContainer.style.display = 'none';
        }

        // Töltés jelző elrejtése
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        // Kedvencek konténer létrehozása vagy megjelenítése
        let searchResults = document.getElementById('search-results');
        if (!searchResults) {
            searchResults = document.createElement('div');
            searchResults.id = 'search-results';
            searchResults.className = 'container mt-4';
            document.body.appendChild(searchResults);
        }
        searchResults.style.display = 'block';

        // Konténer kezelése - ha első oldalt töltünk be, új konténert hozunk létre, egyébként használjuk a meglévőt
        let container;
        if (reset) {
            // Régi konténer eltávolítása, ha létezik
            const oldContainer = document.getElementById('results-list');
            if (oldContainer) {
                oldContainer.remove();
            }

            // Új konténer létrehozása - ugyanúgy mint a keresési eredményeknél
            container = document.createElement('div');
            container.id = 'results-list';
            container.className = 'row row-cols-1 row-cols-md-3 g-4';
            
            // Használjuk ugyanazt a szülő konténert, mint a keresési eredményeknél
            // Ez biztosítja, hogy az oldalsó menü megnyitásakor a kedvencek is elmozduljanak
            if (projectsContainer && projectsContainer.parentElement) {
                // Ha van projects-container, akkor annak a helyére tegyük a kedvenceket
                projectsContainer.parentElement.appendChild(container);
            } else {
                // Ha nincs, akkor a search-results konténerbe tegyük
                searchResults.appendChild(container);
            }
        } else {
            // Meglévő konténer használata, ha nem az első oldalt töltjük be
            container = document.getElementById('results-list');
        }

        // Ha nincsenek kedvencek
        if (!Array.isArray(data.favorites) || data.favorites.length === 0) {
            if (reset) {
                // A teljes szélességű értesítés
                container.style.width = "100%"; // Teljes szélességet biztosít
                container.innerHTML = `
                    <div class="col-12 w-100">
                        <div class="alert alert-info" role="alert" style="width: 100%; text-align: left;">
                            <h4 class="alert-heading">No Favorite Repositories</h4>
                            <p>You don't have any favorite repositories yet. Search for repositories and click the heart icon to add them to your favorites!</p>
                        </div>
                    </div>
                `;
                const totalCount = document.getElementById('total-count');
                if (totalCount) {
                    totalCount.textContent = '0';
                }
            }
            return;
        }

        // Kedvencek megjelenítése - az átlátszó betöltési hatás miatt apróbb késleltetéssel
        const processedIds = new Set(); // Követjük a már feldolgozott elemeket
        
        // Az összes kártya aszinkron betöltése időzítéssel (mint a keresési eredményeknél)
        const promises = data.favorites.map((project, index) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    if (!processedIds.has(project.id)) {
                        const card = displayProject(project, container, true);
                        if (card && card.classList) {
                            // Hozzáadjuk az opacity-animation osztályt a fade-in hatásért
                            card.classList.add('opacity-animation');
                            // Rövid késleltetés után eltávolítjuk, hogy láthatóvá váljon
                            setTimeout(() => {
                                if (card && card.classList) {
                                    card.classList.remove('opacity-animation');
                                }
                            }, 50);
                        }
                        processedIds.add(project.id);
                    }
                    resolve();
                }, index * 30); // Minden kártya betöltése között kis késleltetés
            });
        });
        
        // Várjuk meg, míg az összes kártya betöltődik
        await Promise.all(promises);

        // Összesítő számláló frissítése
        const totalCount = document.getElementById('total-count');
        if (totalCount) {
            totalCount.textContent = data.total_count || processedIds.size;
        }

        // Kedvencek számának frissítése
        await updateFavoritesCount();

        // "Load More" gomb kezelése
        // Először mindig eltávolítjuk a meglévő gombot a biztonság kedvéért
        const existingLoadMoreBtn = document.getElementById('load-more-favorites');
        if (existingLoadMoreBtn) {
            existingLoadMoreBtn.remove();
        }
        
        // Csak akkor hozzuk létre és jelenítjük meg a Load More gombot, ha MINDKÉT feltétel teljesül:
        // 1. A feltételes vizsgálat szerint van még több betölthető elem
        // 2. A jelenlegi oldal teljesen megtelt (pontosan 50 elem van benne)
        if (loadFavorites.hasMoreItems && data.favorites && data.favorites.length === 50) {
            console.log("Creating Load More button - conditions met");
            
            // Új gomb létrehozása
            const newLoadMoreBtn = document.createElement('button');
            newLoadMoreBtn.id = 'load-more-favorites';
            newLoadMoreBtn.className = 'btn load-more-btn mx-auto d-block mt-4 mb-5';
            newLoadMoreBtn.textContent = 'Load More';
            
            // Beállítjuk az alap háttérszínt és szövegszínt
            newLoadMoreBtn.style.backgroundColor = '#ff9538';
            newLoadMoreBtn.style.color = 'white';
            
            // Hover eseménykezelők hozzáadása
            newLoadMoreBtn.addEventListener('mouseover', function() {
                this.style.backgroundColor = '#505050';
            });
            newLoadMoreBtn.addEventListener('mouseout', function() {
                this.style.backgroundColor = '#ff9538';
            });
            
            // Hozzáadjuk a gombot a searchResults konténerhez
            searchResults.appendChild(newLoadMoreBtn);
            
            // Eseménykezelő hozzáadása
            newLoadMoreBtn.addEventListener('click', loadMoreFavorites);
        } else {
            console.log("Load More button not created - conditions not met");
        }

    } catch (error) {
        console.error('Error loading favorites:', error);
        showError('Failed to load favorites: ' + error.message);
    }
}

// További kedvencek betöltése függvény
async function loadMoreFavorites() {
    // Letiltjuk a gombot a betöltés idejére
    const loadMoreBtn = document.getElementById('load-more-favorites');
    if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
    }
    
    try {
        // Következő oldal betöltése
        const nextPage = loadFavorites.currentPage + 1;
        await loadFavorites(nextPage, false);
    } catch (error) {
        console.error('Error loading more favorites:', error);
        showError('Failed to load more favorites: ' + error.message);
    } finally {
        // Visszaállítjuk a gombot
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Load More';
            // Visszaállítjuk az eredeti színeket
            loadMoreBtn.style.backgroundColor = '#ff9538';
            loadMoreBtn.style.color = 'white';
            
            // Újra hozzáadjuk a hover eseménykezelőket
            loadMoreBtn.onmouseover = function() {
                this.style.backgroundColor = '#505050';
            };
            loadMoreBtn.onmouseout = function() {
                this.style.backgroundColor = '#ff9538';
            };
        }
    }
}

/**
* Frissíti a kedvencek számát a fejlécben a látható kártyák alapján.
*/
function updateFavoriteResultsCount() {
    const resultsList = document.getElementById('results-list');
    const totalCountSpan = document.getElementById('total-count');
    if (resultsList && totalCountSpan) {
        // Az összes látható kártya számolása a results-list konténerben
        const visibleCardsCount = resultsList.querySelectorAll('.col:not([style*="display: none"])').length;
        totalCountSpan.textContent = visibleCardsCount.toString();
        console.log("Updated favorites count to:", visibleCardsCount);
    } else {
        console.error("Could not find results-list or total-count element to update favorites count.");
    }
}

// Eseménykezelők inicializálása
function initFavoritesEvents() {
    // Kedvencek listázása gomb eseménykezelő
    document.getElementById('list-favorites-button').addEventListener('click', async () => {
        // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
        if (document.getElementById('user-info').classList.contains('d-none')) {
            // A közös showLoginRequiredMessage függvény meghívása
            if (typeof showLoginRequiredMessage === 'function') {
                showLoginRequiredMessage();
            } else {
                // Tartalék megoldás, ha a függvény nem elérhető
                alert('The Favorites feature is only available after you have logged in!');
            }
            
            // Számláló beállítása 0-ra
            const totalCountSpan = document.getElementById('total-count');
            if (totalCountSpan) {
                totalCountSpan.textContent = '0';
            }
            
            return;
        }

        // Load more gomb elrejtése azonnal
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = 'none';
        }

        // Load more gomb elrejtése a projects-container-ben is
        const projectsLoadMoreBtn = document.getElementById('load-more');
        if (projectsLoadMoreBtn) {
            projectsLoadMoreBtn.style.display = 'none';
        }

        // Kedvencek betöltése
        loadFavorites(1);
    });

    // Kategória szűrő eseménykezelő
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            loadFavorites(1);
        });
    }

    // Kedvencek menüpont kattintás eseménykezelő
    const favoritesMenuItem = document.getElementById('favorites-menu-item');
    if (favoritesMenuItem) {
        favoritesMenuItem.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Menü elemek állapotának beállítása
            document.getElementById('home-menu-item').classList.remove('active');
            document.getElementById('search-menu-item').classList.remove('active');
            document.getElementById('developer-list-menu-item').classList.remove('active');
            this.classList.add('active');
            
            // Tartalmi elemek megjelenítésének szabályozása
            document.getElementById('landing-page').style.display = 'none';
            document.getElementById('projects-section').style.display = 'none';
            document.getElementById('developer-list-container').style.display = 'none';
            document.getElementById('favorites-container').style.display = 'block';
            
            // Load more gombok kezelése
            const loadMoreBtn = document.getElementById('load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.style.display = 'none';
            }
            
            // A keresés "Load More" gombjának elrejtése - ne távolítsuk el, csak rejtsük el
            const searchLoadMoreBtn = document.getElementById('load-more');
            if (searchLoadMoreBtn) {
                // A gombot elrejtjük
                searchLoadMoreBtn.style.display = 'none';
                
                // A szülő konténert is elrejtjük, de nem távolítjuk el
                const parentContainer = searchLoadMoreBtn.closest('.d-flex.justify-content-center');
                if (parentContainer) {
                    parentContainer.style.display = 'none';
                }
            }
            
            // Kategória szűrő újratöltése az adatbázisból
            try {
                // Kategóriák betöltése az adatbázisból
                await loadUserCategories();
                console.log('Categories reloaded successfully');
            } catch (error) {
                console.error('Error reloading categories:', error);
            }
            
            // Kedvencek betöltése
            loadFavorites(1);
        });
    }
}

// Kategóriák betöltése az adatbázisból
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

// DOMContentLoaded eseménykezelő
document.addEventListener('DOMContentLoaded', () => {
    initFavoritesEvents();
    updateFavoritesCount();
});
