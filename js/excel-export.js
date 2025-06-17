/**
 * Excel Export Functionality
 * Manages the Excel export options and creates Excel files based on user selections
 */

document.addEventListener('DOMContentLoaded', () => {
    // Excel export menü inicializálása
    initExcelExportSection();
    
    // GitHub token betöltése funkció - OAuth támogatással
    function loadToken() {
        // Csak az OAuth tokent használjuk
        return sessionStorage.getItem('oauth_github_token');
    }
    
    // GitHub API headers készítése csak OAuth támogatással
    function getHeaders() {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'GitHub Search App'
        };

        // Csak az OAuth tokent használjuk
        const token = sessionStorage.getItem('oauth_github_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    // ExcelJS és FileSaver könyvtárak dinamikus betöltése
    function loadExcelJSLibrary() {
        return new Promise((resolve, reject) => {
            // ExcelJS betöltése
            const loadExcelJS = new Promise((resolveExcel, rejectExcel) => {
                if (window.ExcelJS) {
                    resolveExcel();
                    return;
                }

                const excelScript = document.createElement('script');
                excelScript.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
                excelScript.onload = () => resolveExcel();
                excelScript.onerror = () => rejectExcel(new Error('ExcelJS failed to load!'));
                document.head.appendChild(excelScript);
            });
            
            // FileSaver.js betöltése
            const loadFileSaver = new Promise((resolveFileSaver, rejectFileSaver) => {
                if (window.saveAs) {
                    resolveFileSaver();
                    return;
                }

                const fileSaverScript = document.createElement('script');
                fileSaverScript.src = 'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js';
                fileSaverScript.onload = () => resolveFileSaver();
                fileSaverScript.onerror = () => rejectFileSaver(new Error('FileSaver.js failed to load!'));
                document.head.appendChild(fileSaverScript);
            });
            
            // Várjuk meg, hogy mindkét könyvtár betöltődjön
            Promise.all([loadExcelJS, loadFileSaver])
                .then(() => resolve())
                .catch((error) => reject(error));
        });
    }

    /**
     * Excel export szekció inicializálása
     */
    function initExcelExportSection() {
        // Excel export UI létrehozása, ha még nem létezik
        const excelExportSection = document.querySelector('.section[data-section="excel-export"]');
        
        if (!excelExportSection) {
            const mainContent = document.querySelector('.main-content .container');
            if (!mainContent) return;

            const section = document.createElement('div');
            section.className = 'section';
            section.setAttribute('data-section', 'excel-export');
            section.style.display = 'none';

            section.innerHTML = `
                <h2 class="mb-4">Excel Export</h2>
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title">Exportálási beállítások</h5>
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="export-favorite-repos" checked>
                                <label class="form-check-label" for="export-favorite-repos">
                                    Favourite repositories
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="export-favorite-devs">
                                <label class="form-check-label" for="export-favorite-devs">
                                    Favourite developers
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="export-own-repos">
                                <label class="form-check-label" for="export-own-repos">
                                    Own repositories
                                </label>
                            </div>
                        </div>
                        <button id="create-excel-btn" class="btn btn-primary">Create Excel list</button>
                    </div>
                </div>
            `;

            mainContent.appendChild(section);

            // Friss refererencia az új elemekre és eseménykezelő hozzáadása
            const newExcelBtn = document.getElementById('create-excel-btn');
            
            // Jelölőnégyzetek állapotának explicit beállítása
            const exportFavoriteRepos = document.getElementById('export-favorite-repos');
            const exportFavoriteDevelopers = document.getElementById('export-favorite-devs');
            const exportOwnRepos = document.getElementById('export-own-repos');
            
            if (exportFavoriteRepos) exportFavoriteRepos.checked = true; // Csak ez legyen bejelölve
            if (exportFavoriteDevelopers) exportFavoriteDevelopers.checked = false;
            if (exportOwnRepos) exportOwnRepos.checked = false;
            
            if (newExcelBtn) {
                // Minden korábbi eseménykezelő eltávolítása
                const newBtn = newExcelBtn.cloneNode(true);
                newExcelBtn.parentNode.replaceChild(newBtn, newExcelBtn);
                
                // Új eseménykezelő hozzáadása
                newBtn.addEventListener('click', generateExcelFile);
                console.log('Excel export gomb eseménykezelő hozzáadva');
            }
        }
    }

    /**
     * Felhasználó saját repository-jainak lekérése a GitHub API-n keresztül
     */
    async function fetchOwnRepositories() {
        try {
            // Ellenőrizzük, hogy van-e token
            const token = loadToken();
            if (!token) {
                throw new Error('No GitHub token, please login!');
            }
            
            // 1. Lépés: Bejelentkezett felhasználó adatainak lekérése
            const userResponse = await fetch('https://api.github.com/user', { 
                headers: getHeaders() 
            });
            
            if (!userResponse.ok) {
                throw new Error(`The user data could not be retrieved: ${userResponse.status}`);
            }
            
            const userData = await userResponse.json();
            const username = userData.login;
            
            if (!username) {
                throw new Error('Could not determine the username');
            }
            
            console.log('Logged in user:', username);
            
            // 2. Lépés: Felhasználó saját repository-jainak lekérése
            const apiUrl = `https://api.github.com/users/${username}/repos?sort=updated&per_page=100&type=owner`;
            const response = await fetch(apiUrl, { headers: getHeaders() });
            
            if (!response.ok) {
                throw new Error(`GitHub API hiba a repository-k lekérése közben: ${response.status}`);
            }
            
            const repositories = await response.json();
            console.log(`${repositories.length} saját repository található`);
            
            // Repository-k feldolgozása a megfelelő formátumba
            return repositories.map(repo => ({
                repository_id: repo.id,
                developer: repo.owner.login,
                repository_name: repo.name,
                full_name: repo.full_name,
                url: repo.html_url,
                avatar_url: repo.owner.avatar_url,
                language: repo.language,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                last_update: repo.updated_at,
                // Ezek az adatok a GitHub API-ból nem érhetőek el, így null értékeket adunk
                user_comment: null,
                description: repo.description || 'No description available',
                last_commit: null,
                contributors_count: null
            }));
        } catch (error) {
            console.error('Hiba a saját repository-k lekérése közben:', error);
            throw error;
        }
    }
    
    /**
     * GitHub repository részletek lekérése (avatar, csillagok, forkok, fejlesztők száma)
     */
    async function fetchRepositoryDetails(fullName) {
        try {
            // 1. Repository alapadatok lekérése
            const repoResponse = await fetch(`https://api.github.com/repos/${fullName}`, {
                headers: getHeaders()
            });
            
            if (!repoResponse.ok) {
                console.error(`Hiba a repository adatok lekérése közben: ${fullName}`, await repoResponse.text());
                return {
                    avatar_url: '', 
                    stars: 0, 
                    forks: 0, 
                    contributors_count: 0,
                    last_update: null,
                    last_commit: null
                };
            }
            
            const repoData = await repoResponse.json();
            
            // 2. Közreműködők számának lekérése
            const contributorsUrl = `https://api.github.com/repos/${fullName}/contributors?per_page=1&anon=true`;
            const contributorsResponse = await fetch(contributorsUrl, {
                headers: getHeaders()
            });
            
            let contributorsCount = 0;
            if (contributorsResponse.ok) {
                // A Link header ellenőrzése az összes oldal számához
                const linkHeader = contributorsResponse.headers.get('Link');
                
                if (linkHeader && linkHeader.includes('rel="last"')) {
                    // Ha van Link header, akkor több oldal van
                    const matches = linkHeader.match(/page=(\d+)>; rel="last"/);
                    if (matches) {
                        contributorsCount = parseInt(matches[1]);
                    }
                } else {
                    // Ha nincs Link header, akkor csak egy oldal van
                    const contributors = await contributorsResponse.json();
                    contributorsCount = Array.isArray(contributors) ? contributors.length : 0;
                }
            }
            
            // 3. Utolsó commit lekérése
            const commitsUrl = `https://api.github.com/repos/${fullName}/commits?per_page=1`;
            const commitsResponse = await fetch(commitsUrl, {
                headers: getHeaders()
            });
            
            let lastCommit = null;
            if (commitsResponse.ok) {
                const commits = await commitsResponse.json();
                if (Array.isArray(commits) && commits.length > 0) {
                    lastCommit = commits[0].commit.author.date;
                }
            }
            
            return {
                avatar_url: repoData.owner.avatar_url,
                stars: repoData.stargazers_count,
                forks: repoData.forks_count,
                contributors_count: contributorsCount,
                last_update: repoData.updated_at,
                last_commit: lastCommit
            };
        } catch (error) {
            console.error(`Hiba a repository adatok lekérése közben: ${fullName}`, error);
            return {
                avatar_url: '', 
                stars: 0, 
                forks: 0, 
                contributors_count: 0,
                last_update: null,
                last_commit: null
            };
        }
    }

    /**
 * GitHub fejlesztő részletes adatainak lekérése
 */
async function fetchDeveloperDetails(username) {
    try {
        // Fejlesztő alapadatok lekérése
        const userResponse = await fetch(`https://api.github.com/users/${username}`, {
            headers: getHeaders()
        });
        
        if (!userResponse.ok) {
            console.error(`Hiba a fejlesztő adatok lekérése közben: ${username}`, await userResponse.text());
            return {
                avatar_url: '', 
                bio: '',
                company: '',
                location: '',
                email: '',
                public_repos: 0,
                followers: 0,
                following: 0,
                total_stars: 0
            };
        }
        
        const userData = await userResponse.json();
        
        // Fejlesztő összes repository-jának lekérése a csillagok számának megállapításához
        let totalStars = 0;
        
        try {
            // Csak akkor kérjük le a repository-kat, ha van legalább egy
            if (userData.public_repos > 0) {
                // Meghatározzuk, hány oldalt kell lekérnünk (max 100 repo per oldal)
                const pages = Math.ceil(userData.public_repos / 100);
                const maxPages = 5; // Korlátozzuk a lekért oldalak számát a teljesítmény érdekében
                
                // Lekérjük az első néhány oldalt (max 5 oldal, hogy ne terheljuk túl a GitHub API-t)
                for (let page = 1; page <= Math.min(pages, maxPages); page++) {
                    const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&page=${page}`, {
                        headers: getHeaders()
                    });
                    
                    if (reposResponse.ok) {
                        const repos = await reposResponse.json();
                        // Összegezzük a csillagok számát
                        repos.forEach(repo => {
                            totalStars += repo.stargazers_count || 0;
                        });
                    } else {
                        console.error(`Hiba a fejlesztő repository-jainak lekérése közben: ${username}`, await reposResponse.text());
                        break;
                    }
                }
            }
        } catch (repoError) {
            console.error(`Hiba a fejlesztő repository-jainak lekérése közben: ${username}`, repoError);
        }
        
        return {
            avatar_url: userData.avatar_url || '',
            bio: userData.bio || '',
            company: userData.company || '',
            location: userData.location || '',
            email: userData.email || '',
            public_repos: userData.public_repos || 0,
            followers: userData.followers || 0,
            following: userData.following || 0,
            total_stars: totalStars
        };
    } catch (error) {
        console.error(`Hiba a fejlesztő adatok lekérése közben: ${username}`, error);
        return {
            avatar_url: '', 
            bio: '',
            company: '',
            location: '',
            email: '',
            public_repos: 0,
            followers: 0,
            following: 0,
            total_stars: 0
        };
    }
}
    
    /**
     * Excel fájl generálása a kiválasztott beállítások alapján
     */
    async function generateExcelFile() {
        try {
            // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó
            if (document.getElementById('user-info').classList.contains('d-none')) {
                // A közös showLoginRequiredMessage függvény használata, ha létezik
                if (typeof showLoginRequiredMessage === 'function') {
                    showLoginRequiredMessage();
                } else {
                    // Tartalék megoldás, ha a függvény nem elérhető
                    alert('The Excel export feature is only available after you have logged in!');
                }
                return;
            }

            // Ellenőrzés, hogy ki van-e jelölve valamelyik export opció
            const exportFavoriteRepos = document.getElementById('export-favorite-repos');
            const exportFavoriteDevelopers = document.getElementById('export-favorite-devs');
            const exportOwnRepos = document.getElementById('export-own-repos');
            
            if ((!exportFavoriteRepos || !exportFavoriteRepos.checked) && 
                (!exportFavoriteDevelopers || !exportFavoriteDevelopers.checked) && 
                (!exportOwnRepos || !exportOwnRepos.checked)) {
                alert('Kérlek jelöld be legalább az egyik opciót (Favourite repositories, Favourite developers vagy Own repositories) az Excel exportáláshoz!');
                return;
            }
            
            // Logoljuk a kiválasztott opciókat
            console.log(`Export opciók: Kedvenc repók: ${exportFavoriteRepos.checked ? 'Be' : 'Ki'}, Kedvenc fejlesztők: ${exportFavoriteDevelopers.checked ? 'Be' : 'Ki'}, Saját: ${exportOwnRepos.checked ? 'Be' : 'Ki'}`);

            // Jelezzük a felhasználónak, hogy elkezdődött az exportálás
            const exportButton = document.getElementById('create-excel-btn');
            const originalButtonText = exportButton.textContent;
            exportButton.disabled = true;
            exportButton.textContent = 'Exportálás folyamatban...';

            // Betöltjük az ExcelJS könyvtárat, ha még nincs betöltve
            await loadExcelJSLibrary();

            // Kedvenc és saját repository-k, valamint kedvenc fejlesztők adatainak lekérése
            let favoriteReposData = {};
            let favoriteDevelopersData = [];
            let ownReposData = [];
            let exportDate = '';
            
            // Kedvenc repository-k lekérése, ha ki van választva
            if (exportFavoriteRepos.checked) {
                exportButton.textContent = 'Kedvenc repository-k lekérése...';
                const response = await fetch('excel_export.php');
                if (!response.ok) {
                    throw new Error('A szerver nem válaszol vagy hiba történt.');
                }

                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.message || 'Hiba az adatok lekérése közben!');
                }
                
                favoriteReposData = result.data;
                exportDate = result.export_date;
                console.log(`${Object.values(favoriteReposData).flat().length} kedvenc repository találva`);
            }
            
            // Saját repository-k lekérése, ha ki van választva
            if (exportOwnRepos.checked) {
                try {
                    exportButton.textContent = 'Saját repository-k lekérése...';
                    ownReposData = await fetchOwnRepositories();
                    console.log(`${ownReposData.length} saját repository találva`);
                    
                    if (ownReposData.length === 0) {
                        console.warn('Nem található saját repository');
                    }
                } catch (error) {
                    console.error('Hiba a saját repository-k lekérése közben:', error);
                    alert(`Hiba a saját repository-k lekérése közben: ${error.message}`);
                    // Folytatjuk az exportálást, de saját repository-k nélkül
                    ownReposData = [];
                }
            }
            
            // Kedvenc fejlesztők lekérése, ha ki van választva
            if (exportFavoriteDevelopers.checked) {
                try {
                    exportButton.textContent = 'Kedvenc fejlesztők lekérése...';
                    const response = await fetch('excel_export_developers.php');
                    if (!response.ok) {
                        throw new Error('A szerver nem válaszol vagy hiba történt a fejlesztők lekérése közben.');
                    }

                    const result = await response.json();
                    if (!result.success) {
                        throw new Error(result.message || 'Hiba a fejlesztők adatainak lekérése közben!');
                    }
                    
                    favoriteDevelopersData = result.data;
                    if (!exportDate) {
                        exportDate = result.export_date;
                    }
                    console.log(`${favoriteDevelopersData.length} kedvenc fejlesztő találva`);
                } catch (error) {
                    console.error('Hiba a kedvenc fejlesztők lekérése közben:', error);
                    alert(`Hiba a kedvenc fejlesztők lekérése közben: ${error.message}`);
                    // Folytatjuk az exportálást, de kedvenc fejlesztők nélkül
                    favoriteDevelopersData = [];
                }
            }
            
            // Ha nincs export dátum (pl. csak saját repository-k exportálása esetén), akkor generálunk egyet
            if (!exportDate) {
                const today = new Date();
                exportDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
            }
            
            // További adatok lekérése a GitHub API-ról minden repository-hoz és fejlesztőhöz
            const enhancedData = {};
            const enhancedOwnData = [];
            const enhancedDevelopersData = [];
            
            // Státusz kijelzése
            exportButton.textContent = 'Repository adatok lekérése...';
            
            // Kategóriánként feldolgozzuk a kedvenc repository-kat
            if (exportFavoriteRepos.checked) {
                for (const category in favoriteReposData) {
                    enhancedData[category] = [];
                    const repos = favoriteReposData[category];
                
                    // Minden repository-hoz lekérjük a részletes adatokat
                    for (const repo of repos) {
                        // Ha van full_name, akkor használjuk azt, különben összefűzzük a developer és repository_name mezőket
                        const fullName = repo.full_name || `${repo.developer}/${repo.repository_name}`;
                        
                        // Státusz frissítése
                        exportButton.textContent = `Under processing favorite: ${fullName}`;
                        
                        try {
                            // Részletes adatok lekérése
                            const details = await fetchRepositoryDetails(fullName);
                            
                            // Repository adatok kiegészítése
                            enhancedData[category].push({
                                ...repo,
                                ...details
                            });
                        } catch (error) {
                            console.error(`Hiba a részletes adatok lekérése közben (${fullName}):`, error);
                            // Hiba esetén is hozzáadjuk az alapadatokkal
                            enhancedData[category].push(repo);
                        }
                    }
                }
            }
            
            // Kedvenc fejlesztők feldolgozása, ha ki van választva
            if (exportFavoriteDevelopers.checked && favoriteDevelopersData.length > 0) {
                // Minden kedvenc fejlesztőhöz lekérjük a részletes adatokat
                for (const developer of favoriteDevelopersData) {
                    const username = developer.login;
                    
                    // Státusz frissítése
                    exportButton.textContent = `Under processing developer: ${username}`;
                    
                    try {
                        // Részletes adatok lekérése
                        const details = await fetchDeveloperDetails(username);
                        
                        // Fejlesztő adatok kiegészítése
                        enhancedDevelopersData.push({
                            ...developer,
                            ...details
                        });
                    } catch (error) {
                        console.error(`Hiba a fejlesztő részletes adatainak lekérése közben (${username}):`, error);
                        // Hiba esetén is hozzáadjuk az alapadatokkal
                        enhancedDevelopersData.push(developer);
                    }
                }
            }
            
            // Saját repository-k feldolgozása, ha ki van választva
            if (exportOwnRepos.checked && ownReposData.length > 0) {
                // Minden saját repository-hoz lekérjük a részletes adatokat
                for (const repo of ownReposData) {
                    const fullName = repo.full_name;
                    
                    // Státusz frissítése
                    exportButton.textContent = `Under processing own: ${fullName}`;
                    
                    try {
                        // Részletes adatok lekérése
                        const details = await fetchRepositoryDetails(fullName);
                        
                        // Repository adatok kiegészítése
                        enhancedOwnData.push({
                            ...repo,
                            ...details
                        });
                    } catch (error) {
                        console.error(`Error while retrieving detailed data (${fullName}):`, error);
                        // Hiba esetén is hozzáadjuk az alapadatokkal
                        enhancedOwnData.push(repo);
                    }
                }
            }
            
            // Ellenőrizzük, hogy van-e exportálandó adat
            const hasFavoriteRepos = exportFavoriteRepos.checked && Object.keys(enhancedData).length > 0 && 
                                    Object.values(enhancedData).some(arr => arr.length > 0);
            const hasFavoriteDevelopers = exportFavoriteDevelopers.checked && enhancedDevelopersData.length > 0;
            const hasOwnRepos = exportOwnRepos.checked && enhancedOwnData.length > 0;
            
            console.log(`Data to export: favourite repos: ${hasFavoriteRepos ? 'Have' : 'None'}, Favourite developers: ${hasFavoriteDevelopers ? 'Have' : 'None'}, Own repos: ${hasOwnRepos ? 'Have' : 'None'}`);
            
            if (!hasFavoriteRepos && !hasFavoriteDevelopers && !hasOwnRepos) {
                throw new Error('No data can be exported. Please check if you have a favorite repository, favorite developer or your own repository.');
            }

            // Státusz frissítése
            exportButton.textContent = 'Create Excel spreadsheet...';

            // Excel fájl létrehozása a kibovített adatokkal - egy fájlba kerül minden adat
            const fileName = await createFormattedExcelFile(enhancedData, enhancedOwnData, enhancedDevelopersData, exportDate);
            
            // Sikeres exportálás jelzése
            alert(`The Excel file has been successfully exported: ${fileName}`);
            console.log(`The Excel file has been successfully exported: ${fileName}`);

            // Állapot visszaállítása
            exportButton.disabled = false;
            exportButton.textContent = originalButtonText;

        } catch (error) {
            console.error('Excel export error:', error);
            alert(`An error occurred during export: ${error.message}`);

            // Hiba esetén is visszaállítjuk a gomb állapotát
            const btnExport = document.getElementById('create-excel-btn');
            if (btnExport) {
                btnExport.disabled = false;
                btnExport.textContent = originalButtonText || 'Create Excel list';
            }
        }
    }

    /**
 * Formázott Excel fájl létrehozása a repository és fejlesztő adatokból
 * 
 * @param {Object} categorizedRepos Kategóriák szerint csoportosított kedvenc repository-k
 * @param {Array} ownRepos Saját repository-k listája
 * @param {Array} favoriteDevelopers Kedvenc fejlesztők listája
 * @param {String} exportDate Az exportálás dátuma
 */
async function createFormattedExcelFile(categorizedRepos, ownRepos, favoriteDevelopers, exportDate) {
    // Workbook létrehozása
    const workbook = new ExcelJS.Workbook();
    
    // Munkafüzet tulajdonságainak beállítása
    workbook.creator = 'GitHub Search & Sorting Assistant';
    workbook.created = new Date();
    workbook.lastModifiedBy = 'GitHub Search & Sorting Assistant';
    workbook.modified = new Date();
    
    // Először mindig a kedvenc repository-k munkalapot hozzuk létre, ha van kedvenc repository
    const hasFavoriteRepos = Object.keys(categorizedRepos).length > 0 && 
                           Object.values(categorizedRepos).some(arr => arr.length > 0);
    
    if (hasFavoriteRepos) {
        console.log('Kedvenc repository-k munkalap létrehozása...');
        await createFavoriteRepositoriesSheet(workbook, categorizedRepos, exportDate);
    }
    
    // Kedvenc fejlesztők munkalapot hozzuk létre, ha van kedvenc fejlesztő
    if (favoriteDevelopers && favoriteDevelopers.length > 0) {
        console.log('Kedvenc fejlesztők munkalap létrehozása...');
        await createFavoriteDevelopersSheet(workbook, favoriteDevelopers, exportDate);
    }
    
    // Utána a saját repository-k munkalapot hozzuk létre, ha van saját repository
    if (ownRepos.length > 0) {
        console.log('Saját repository-k munkalap létrehozása...');
        await createOwnRepositoriesSheet(workbook, ownRepos, exportDate);
    }
    
    // Excel fájl mentése és letöltése
    console.log('Excel fájl mentése...');
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Fájlnév generálása a mai dátummal és időponttal
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}`;
    const fileName = `github_repositories_${dateStr}_${timeStr}.xlsx`;
    
    // Letöltési link létrehozása és kattintás szimulálása
    // Ellenőrizzük, hogy a saveAs függvény létezik-e
    if (typeof saveAs !== 'function') {
        // Ha nincs saveAs függvény, akkor manuálisan hozunk létre letöltési linket
        console.log('Manuális letöltés...');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    } else {
        // Ha van saveAs függvény, akkor azt használjuk
        console.log('Letöltés saveAs függvénnyel...');
        saveAs(blob, fileName);
    }
    
    return fileName;
}
 
/**
 * Kedvenc fejlesztők munkalap létrehozása
 * 
 * @param {ExcelJS.Workbook} workbook Excel munkafüzet
 * @param {Array} favoriteDevelopers Kedvenc fejlesztők listája
 * @param {String} exportDate Az exportálás dátuma
 */
async function createFavoriteDevelopersSheet(workbook, favoriteDevelopers, exportDate) {
    // Munkalap létrehozása
    const worksheet = workbook.addWorksheet('Favourite Developers', {
        properties: {
            tabColor: { argb: 'E27611' } // Narancssárga tab szín a kedvenc fejlesztőknek
        }
    });
    
    // Oszlopok szélességének beállítása
    worksheet.columns = [
        { width: 33.33 }, // Kép oszlop (a korábbi 50 szélesség 2/3-a)
        { width: 30 }, // Paraméterek oszlop
        { width: 250 }  // Értékek oszlop
    ];

    // Első sor: SASA logo a sor elején, #205723 háttérszínnel
    let rowIndex = 1;
    const logoRow = worksheet.getRow(rowIndex++);
    logoRow.height = 60; // Magasabb sor a logónak
    
    // Háttérszín beállítása az első sorra
    for (let col = 1; col <= 3; col++) {
        const cell = logoRow.getCell(col);
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF205723' } // #205723 szín
        };
    }
    
    try {
        // SASA logo betöltése közvetlen URL-ről
        const logoUrl = 'https://githubsearch.tomorgraphic.com/pictures/SASA_logo_03.png';
        const logoResponse = await fetch(logoUrl);
        
        if (logoResponse.ok) {
            const logoArrayBuffer = await logoResponse.arrayBuffer();
            const logoImageId = workbook.addImage({
                buffer: logoArrayBuffer,
                extension: 'png',
            });
            
            // Logo beszúrása a sor elejére (A oszlop)
            worksheet.addImage(logoImageId, {
                tl: { col: 0, row: 0 }, // A oszlop (index: 0), első sor (index: 0)
                ext: { width: 200, height: 60 },
                editAs: 'oneCell'
            });
        } else {
            console.error('Nem sikerült betölteni a SASA logót:', logoResponse.status);
        }
    } catch (logoError) {
        console.error('Hiba a SASA logo betöltése során:', logoError);
    }
    
    // Második sor: FAVOURITE DEVELOPERS - EXPORT + dátum, balra igazítva
    const titleRow = worksheet.getRow(rowIndex++);
    const titleCell = titleRow.getCell(1);
    titleCell.value = `FAVOURITE DEVELOPERS - EXPORT ${exportDate}`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E27611' } // Narancssárga
    };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }; // Balra igazítás
    worksheet.mergeCells(titleRow.number, 1, titleRow.number, 3);

    // Üres sor
    rowIndex++;

    // LIST OF FAVOURITE DEVELOPERS felirat
    const developersListRow = worksheet.getRow(rowIndex++);
    const developersListCell = developersListRow.getCell(1);
    developersListCell.value = 'LIST OF FAVOURITE DEVELOPERS';
    developersListCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; // Fehér szöveg
    developersListCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E27611' } // Narancssárga háttér
    };
    developersListCell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(developersListRow.number, 1, developersListRow.number, 3);

    // Fejlesztők feldolgozása
    for (const developer of favoriteDevelopers) {
        // Fejlesztő avatar képének letöltése és beillesztése
        try {
            if (developer.avatar_url) {
                // Avatar kép URL-je
                const avatarUrl = developer.avatar_url;
                
                // Proxy használata a CORS problémák elkerülésére
                let imageResponse;
                let useDirectFetch = false;
                
                try {
                    // Lokális proxy API használata (ha van ilyen endpoint)
                    const proxyUrl = `proxy_image.php?url=${encodeURIComponent(avatarUrl)}`;
                    imageResponse = await fetch(proxyUrl);
                    
                    if (!imageResponse.ok) {
                        // Ha a proxy nem működik, próbáljuk közvetlenül
                        useDirectFetch = true;
                    }
                } catch (error) {
                    useDirectFetch = true;
                }
                
                // Ha a proxy nem működött, próbáljuk közvetlenül
                if (useDirectFetch) {
                    try {
                        imageResponse = await fetch(avatarUrl);
                    } catch (error) {
                        console.error(`Nem sikerült letölteni a fejlesztő avatar képét: ${developer.login}`, error);
                        continue;
                    }
                }
                
                if (imageResponse && imageResponse.ok) {
                    const imageArrayBuffer = await imageResponse.arrayBuffer();
                    const imageId = workbook.addImage({
                        buffer: imageArrayBuffer,
                        extension: 'png', // Feltételezzük, hogy PNG formátumú
                    });
                    
                    // Kép beszúrása nagyobb méretben (400x400 pixel)
                    worksheet.addImage(imageId, {
                        tl: { col: 0, row: rowIndex - 0.5 },
                        ext: { width: 210, height: 210 },
                        editAs: 'oneCell'
                    });
                }
            }
        } catch (imageError) {
            console.error(`Hiba a fejlesztő avatar képének betöltése során: ${developer.login}`, imageError);
        }
        
        // Fejlesztő adatok hozzáadása
        const params = [
            { label: 'Developer name:', value: developer.name || developer.login || '' },
            { label: 'Developer URL:', value: developer.html_url || '' },
            { label: 'Developer introduction:', value: developer.bio || '' },
            { label: 'Own comments:', value: developer.notes || '' },
            { label: 'Company:', value: developer.company || '' },
            { label: 'Location:', value: developer.location || '' },
            { label: 'E-mail:', value: developer.email || '' },
            { label: 'Total STARS earned:', value: developer.total_stars || 0 },
            { label: 'Public_repos:', value: developer.public_repos || 0 },
            { label: 'Followers:', value: developer.followers || 0 },
            { label: 'Following:', value: developer.following || 0 }
        ];
        
        // Paraméterek hozzáadása a táblázathoz
        for (let i = 0; i < params.length; i++) {
            const currentRow = worksheet.getRow(rowIndex + i);
            
            // Paraméter címke
            const labelCell = currentRow.getCell(2);
            labelCell.value = params[i].label;
            labelCell.font = { size: 11, bold: true };
            if (i % 2 === 0) {
                labelCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' } // Világosszürke
                };
            }
            
            // Paraméter érték
            const valueCell = currentRow.getCell(3);
            valueCell.value = params[i].value;
            valueCell.font = { size: 11 };
            if (i % 2 === 0) {
                valueCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' } // Világosszürke
                };
            }
            
            // Ha URL, akkor beállítjuk hyperlinkként
            if (params[i].label === 'Developer URL:') {
                valueCell.value = { text: params[i].value, hyperlink: params[i].value };
                valueCell.font = { size: 11, color: { argb: 'FFE27611' }, underline: true };
            }
            
            // Developer name kövérítése és színezése
            if (params[i].label === 'Developer name:') {
                valueCell.font = { size: 16, bold: true, color: { argb: 'FFE27611' } };
            }
            
            // Developer introduction színezése és kövérítése
            if (params[i].label === 'Developer introduction:') {
                valueCell.font = { size: 12, bold: true, color: { argb: 'FFE27611' } };
            }
            
            // Own comments színezése és kövérítése (zöld színnel, mint a legelső sor háttere)
            if (params[i].label === 'Own comments:') {
                valueCell.font = { size: 12, bold: true, color: { argb: 'FF205723' } };
            }
            
            // Számértékek balra igazítása
            if (params[i].label === 'Total STARS earned:' ||
                params[i].label === 'Public_repos:' || 
                params[i].label === 'Followers:' || 
                params[i].label === 'Following:') {
                valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
        }
        
        // Üres sor beszúrása az utolsó paraméter után
        const emptyRow = worksheet.getRow(rowIndex + params.length);
        emptyRow.height = 15; // Üres sor magassága
        
        // Üres sor színezése szürkére (#a9a9a9)
        for (let col = 1; col <= 3; col++) {
            const cell = emptyRow.getCell(col);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFB7B7B7' } //rgb(183, 183, 183) szín
            };
        }
        
        // Következő fejlesztőre ugrás (paraméterek száma + üres sor)
        rowIndex += params.length + 1;
    }
}



    /**
     * Saját repository-k munkalap létrehozása
     * 
     * @param {ExcelJS.Workbook} workbook Excel munkafüzet
     * @param {Array} ownRepos Saját repository-k listája
     * @param {String} exportDate Az exportálás dátuma
     */
    async function createOwnRepositoriesSheet(workbook, ownRepos, exportDate) {
        // Munkalap létrehozása
        const worksheet = workbook.addWorksheet('Own Repositories', {
            properties: {
                tabColor: { argb: '0D47A1' } // Kék tab szín a saját repository-knak
            }
        });
        
        // Oszlopok szélességének beállítása
        worksheet.columns = [
            { width: 50 }, // Kép oszlop
            { width: 30 }, // Paraméterek oszlop
            { width: 250 }  // Értékek oszlop
        ];

        // Első sor: SASA logo a sor elején, #205723 háttérszínnel
        let rowIndex = 1;
        const logoRow = worksheet.getRow(rowIndex++);
        logoRow.height = 60; // Magasabb sor a logónak
        
        // Háttérszín beállítása az első sorra
        for (let col = 1; col <= 3; col++) {
            const cell = logoRow.getCell(col);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF205723' } // #205723 szín
            };
        }
        
        try {
            // SASA logo betöltése közvetlen URL-ről
            const logoUrl = 'https://githubsearch.tomorgraphic.com/pictures/SASA_logo_03.png';
            const logoResponse = await fetch(logoUrl);
            
            if (logoResponse.ok) {
                const logoArrayBuffer = await logoResponse.arrayBuffer();
                const logoImageId = workbook.addImage({
                    buffer: logoArrayBuffer,
                    extension: 'png',
                });
                
                // Logo beszúrása a sor elejére (A oszlop)
                worksheet.addImage(logoImageId, {
                    tl: { col: 0, row: 0 }, // A oszlop (index: 0), első sor (index: 0)
                    ext: { width: 200, height: 60 },
                    editAs: 'oneCell'
                });
            } else {
                console.error('Nem sikerült betölteni a SASA logót:', logoResponse.status);
            }
        } catch (logoError) {
            console.error('Hiba a SASA logo betöltése során:', logoError);
        }
        
        // Második sor: OWN REPOSITORIES - EXPORT + dátum, balra igazítva
        const titleRow = worksheet.getRow(rowIndex++);
        const titleCell = titleRow.getCell(1);
        titleCell.value = `OWN REPOSITORIES - EXPORT ${exportDate}`;
        titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2E7D32' } // Sötétzöld
        };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle' }; // Balra igazítás
        worksheet.mergeCells(titleRow.number, 1, titleRow.number, 3);

        // Üres sor
        rowIndex++;

        // LIST YOUR OWN DEVELOPMENTS felirat - most ugyanolyan formázással, mint a cím
        const ownDevelopmentsRow = worksheet.getRow(rowIndex++);
        const ownDevelopmentsCell = ownDevelopmentsRow.getCell(1);
        ownDevelopmentsCell.value = 'LIST YOUR OWN DEVELOPMENTS';
        ownDevelopmentsCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; // Fehér szöveg
        ownDevelopmentsCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2E7D32' } // Sötétzöld háttér, mint a 2. sornál
        };
        ownDevelopmentsCell.alignment = { horizontal: 'left', vertical: 'middle' };
        worksheet.mergeCells(ownDevelopmentsRow.number, 1, ownDevelopmentsRow.number, 3);

        // Repository-k feldolgozása
        for (const repo of ownRepos) {
            // Repository social preview kép letöltése és beillestése
            try {
                // A repository teljes neve (owner/repo)
                const fullName = repo.full_name;
                const [owner, repoName] = fullName.split('/');
                
                // Social preview kép URL-je
                // Formátum: https://opengraph.githubassets.com/1/{owner}/{repo}
                const socialImageUrl = `https://opengraph.githubassets.com/1/${owner}/${repoName}`;
                
                // Proxy használata a CORS problémák elkerülésére
                // Két módszert próbálunk: 
                // 1. Lokális proxy API (ha van)
                // 2. Közvetlen letöltés (fallback)
                
                let imageResponse;
                let retryCount = 0;
                const maxRetries = 3; // Összesen 3 próbálkozás
                let useDirectFetch = false;
                
                // Exponenciális várakozási idő (ms)
                const waitTimes = [500, 1000, 2000];
                
                while (retryCount < maxRetries) {
                    try {
                        // Próbáljuk először a lokális proxy API-t, ha már többször próbálkoztunk, akkor közvetlenül
                        if (!useDirectFetch) {
                            try {
                                // Lokális proxy API használata (ha van ilyen endpoint)
                                // A proxy_image.php fájl letölti a képet a szerveren és visszaadja
                                const proxyUrl = `proxy_image.php?url=${encodeURIComponent(socialImageUrl)}`;
                                imageResponse = await fetch(proxyUrl);
                                
                                if (imageResponse.ok) {
                                    console.log(`Siker a proxy-n keresztül: ${fullName}`);
                                    break;
                                } else {
                                    // Ha a proxy nem működik, próbáljuk közvetlenül
                                    useDirectFetch = true;
                                    console.log(`Proxy nem működik, közvetlen próbálkozás: ${fullName}`);
                                }
                            } catch (proxyError) {
                                // Ha a proxy nem működik, próbáljuk közvetlenül
                                useDirectFetch = true;
                                console.log(`Proxy hiba, közvetlen próbálkozás: ${fullName}`, proxyError);
                            }
                        }
                        
                        // Ha a proxy nem működött vagy nincs, próbáljuk közvetlenül
                        if (useDirectFetch) {
                            // Közvetlen letöltés (CORS korlátozások miatt nem mindig működik)
                            // Próbáljunk egy alternatív kép URL-t használni a GitHub API-ból
                            try {
                                // Először próbáljuk meg a repository adatait lekérni a GitHub API-n keresztül
                                const repoApiUrl = `https://api.github.com/repos/${owner}/${repoName}`;
                                const repoResponse = await fetch(repoApiUrl, { headers: getHeaders() });
                                
                                if (repoResponse.ok) {
                                    const repoData = await repoResponse.json();
                                    // Ha van avatar_url, akkor azt használjuk
                                    if (repoData.owner && repoData.owner.avatar_url) {
                                        imageResponse = await fetch(repoData.owner.avatar_url);
                                        if (imageResponse.ok) {
                                            console.log(`Siker avatar kép letöltéssel: ${fullName}`);
                                            break;
                                        }
                                    }
                                }
                            } catch (apiError) {
                                console.error(`Hiba a repository API adatok lekérése közben: ${fullName}`, apiError);
                            }
                            
                            // Ha az API-n keresztül nem sikerült, akkor próbáljuk meg közvetlenül
                            try {
                                imageResponse = await fetch(socialImageUrl, {
                                    mode: 'cors',  // CORS mód explicit beállítása
                                    credentials: 'omit',  // Ne küldjön cookie-kat
                                    cache: 'no-store'  // Ne használjon cache-t
                                });
                            } catch (directError) {
                                console.error(`Közvetlen kép letöltési hiba: ${fullName}`, directError);
                            }
                            
                            if (imageResponse.ok) {
                                console.log(`Siker közvetlen letöltéssel: ${fullName}`);
                                break;
                            }
                        }
                        
                        // Ha nem sikeres, növeljük a próbálkozások számát
                        retryCount++;
                        
                        // Várakozás növekvő idővel
                        const waitTime = waitTimes[Math.min(retryCount - 1, waitTimes.length - 1)];
                        console.log(`Várakozás ${waitTime}ms a repository kép újrapróbálása előtt: ${fullName}`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        
                        console.log(`Újrapróbálás (${retryCount}/${maxRetries}): ${fullName}`);
                    } catch (retryError) {
                        console.error(`Hiba a repository kép letöltése során (próbálkozás ${retryCount + 1}/${maxRetries}):`, retryError);
                        retryCount++;
                        
                        // Várakozás növekvő idővel
                        const waitTime = waitTimes[Math.min(retryCount - 1, waitTimes.length - 1)];
                        console.log(`Várakozás ${waitTime}ms a repository kép újrapróbálása előtt: ${fullName}`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                }
                
                // Ha sikerült a kép letöltése
                if (imageResponse && imageResponse.ok) {
                    const imageArrayBuffer = await imageResponse.arrayBuffer();
                    const imageId = workbook.addImage({
                        buffer: imageArrayBuffer,
                        extension: 'png',
                    });
                    
                    // Kép beszúrása 16:9 arányban
                    worksheet.addImage(imageId, {
                        tl: { col: 0, row: rowIndex },
                        ext: { width: 350, height: 170 },  // 16:9 arány
                        editAs: 'oneCell'
                    });
                } else {
                    throw new Error(`Nem sikerült a repository kép letöltése ${maxRetries} próbálkozás után.`);
                }
            } catch (error) {
                console.error('Hiba a repository kép letöltése során:', error);
                
                // Ha nem sikerült a repository kép, megpróbáljuk az avatar képet tartalékként
                try {
                    const avatarResponse = await fetch(repo.avatar_url);
                    const avatarArrayBuffer = await avatarResponse.arrayBuffer();
                    const avatarImageId = workbook.addImage({
                        buffer: avatarArrayBuffer,
                        extension: 'png',
                    });
                    
                    // Avatar kép beszúrása 16:9 arányban
                    worksheet.addImage(avatarImageId, {
                        tl: { col: 0, row: rowIndex },
                        ext: { width: 178, height: 100 },  // 16:9 arány
                        editAs: 'oneCell'
                    });
                } catch (avatarError) {
                    console.error('Hiba az avatar kép letöltése során:', avatarError);
                }
            }
            
            // Paraméterek összeállítása (most már Short description-nel, de Individual comment nélkül)
            const params = [
                { label: 'Developer name:', value: repo.developer },
                { label: 'Repository name:', value: repo.repository_name },
                { label: 'URL:', value: repo.url },
                { label: 'Short description:', value: repo.description || 'No description available' },
                { label: 'Language:', value: repo.language || 'N/A' },
                { label: 'Last update:', value: new Date(repo.last_update).toLocaleDateString() },
                { label: 'Last commit:', value: repo.last_commit ? new Date(repo.last_commit).toLocaleDateString() : 'N/A' },
                { label: 'Number of stars:', value: repo.stars },
                { label: 'Number of forks:', value: repo.forks },
                { label: 'Number of developer:', value: repo.contributors_count }
            ];
            
            // Paraméterek hozzáadása a táblázathoz
            for (let i = 0; i < params.length; i++) {
                const currentRow = worksheet.getRow(rowIndex + i);
                
                // Paraméter címke
                const labelCell = currentRow.getCell(2);
                labelCell.value = params[i].label;
                labelCell.font = { size: 11, bold: true };
                if (i % 2 === 0) {
                    labelCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2F2F2' } // Világosszürke
                    };
                }
                
                // Paraméter érték
                const valueCell = currentRow.getCell(3);
                valueCell.value = params[i].value;
                valueCell.font = { size: 11 };
                if (i % 2 === 0) {
                    valueCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2F2F2' } // Világosszürke
                    };
                }
                
                // Ha URL, akkor beállítjuk hyperlinkként
                if (params[i].label === 'URL:') {
                    valueCell.value = { text: params[i].value, hyperlink: params[i].value };
                    valueCell.font = { size: 11, color: { argb: 'FF2E7D32' }, underline: true };
                }
                
                // Repository name kövérítése és színezése
                if (params[i].label === 'Repository name:') {
                    valueCell.font = { size: 16, bold: true, color: { argb: 'FF2E7D32' } };
                }

                if (params[i].label === 'Short description:') {
                    valueCell.font = { size: 12, bold: true, color: { argb: 'FF2E7D32' } };
                }
                
                // Számértékek balra igazítása
                if (params[i].label === 'Number of stars:' || 
                    params[i].label === 'Number of forks:' || 
                    params[i].label === 'Number of developer:') {
                    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            }
            
            // Üres sor beszúrása az utolsó paraméter után
            const emptyRow = worksheet.getRow(rowIndex + params.length);
            emptyRow.height = 15; // Üres sor magassága
            
            // Üres sor színezése szürkére (#a9a9a9)
            for (let col = 1; col <= 3; col++) {
                const cell = emptyRow.getCell(col);
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFB7B7B7' } //rgb(183, 183, 183) szín
                };
            }
            
            // Következő repository-ra ugrás (paraméterek száma + üres sor)
            rowIndex += params.length + 1;
        }
    }
    
    /**
     * Kedvenc repository-k munkalap létrehozása
     * 
     * @param {ExcelJS.Workbook} workbook Excel munkafüzet
     * @param {Object} categorizedRepos Kategóriák szerint csoportosított kedvenc repository-k
     * @param {String} exportDate Az exportálás dátuma
     */
    async function createFavoriteRepositoriesSheet(workbook, categorizedRepos, exportDate) {
        // Munkalap létrehozása
        const worksheet = workbook.addWorksheet('Favourite Repositories', {
            properties: {
                tabColor: { argb: '2E7D32' } // Zöld tab szín a kedvenc repository-knak
            }
        });
        
        // Oszlopok szélességének beállítása
        worksheet.columns = [
            { width: 50 }, // Kép oszlop
            { width: 30 }, // Paraméterek oszlop
            { width: 250 }  // Értékek oszlop
        ];

        // Első sor: SASA logo a sor elején, #205723 háttérszínnel
        let rowIndex = 1;
        const logoRow = worksheet.getRow(rowIndex++);
        logoRow.height = 60; // Magasabb sor a logónak
        
        // Háttérszín beállítása az első sorra
        for (let col = 1; col <= 3; col++) {
            const cell = logoRow.getCell(col);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF205723' } // #205723 szín
            };
        }
        
        try {
            // SASA logo betöltése közvetlen URL-ről
            const logoUrl = 'https://githubsearch.tomorgraphic.com/pictures/SASA_logo_03.png';
            const logoResponse = await fetch(logoUrl);
            
            if (logoResponse.ok) {
                const logoArrayBuffer = await logoResponse.arrayBuffer();
                const logoImageId = workbook.addImage({
                    buffer: logoArrayBuffer,
                    extension: 'png',
                });
                
                // Logo beszúrása a sor elejére (A oszlop)
                worksheet.addImage(logoImageId, {
                    tl: { col: 0, row: 0 }, // A oszlop (index: 0), első sor (index: 0)
                    ext: { width: 200, height: 60 },
                    editAs: 'oneCell'
                });
            } else {
                console.error('Nem sikerült betölteni a SASA logót:', logoResponse.status);
            }
        } catch (logoError) {
            console.error('Hiba a SASA logo betöltése során:', logoError);
        }
        
        // Második sor: FAVOURITE REPOSITORIES - EXPORT + dátum, balra igazítva
        const titleRow = worksheet.getRow(rowIndex++);
        const titleCell = titleRow.getCell(1);
        titleCell.value = `FAVOURITE REPOSITORIES - EXPORT ${exportDate}`;
        titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2E7D32' } // Sötétzöld
        };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle' }; // Balra igazítás
        worksheet.mergeCells(titleRow.number, 1, titleRow.number, 3);

        // Üres sor
        rowIndex++;

        // FAVOURITE CATEGORIES felirat
        const favouriteCategoryRow = worksheet.getRow(rowIndex++);
        const favouriteCategoryCell = favouriteCategoryRow.getCell(1);
        favouriteCategoryCell.value = 'FAVOURITE CATEGORIES';
        favouriteCategoryCell.font = { size: 14, bold: true, color: { argb: 'FF2E7D32' } }; // Sötétzöld szöveg
        favouriteCategoryCell.alignment = { horizontal: 'left', vertical: 'middle' };
        worksheet.mergeCells(favouriteCategoryRow.number, 1, favouriteCategoryRow.number, 3);

        // Kategóriák feldolgozása
        for (const categoryName in categorizedRepos) {
            const repositories = categorizedRepos[categoryName];
            
            // Kategória fejléc
            const categoryRow = worksheet.getRow(rowIndex++);
            categoryRow.height = 25; // Magasabb sor a kategória fejlécnek
            
            // Kategória név cella
            const categoryCell = categoryRow.getCell(1);
            categoryCell.value = categoryName;
            categoryCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            categoryCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '2E7D32' } // Sötétebb zöld
            };
            
            // Main parameters cella
            const paramsCell = categoryRow.getCell(2);
            paramsCell.value = 'Main parameters';
            paramsCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            paramsCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '2E7D32' } // Sötétebb zöld
            };
            
            // Details cella
            const detailsCell = categoryRow.getCell(3);
            detailsCell.value = 'details';
            detailsCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            detailsCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '2E7D32' } // Sötétebb zöld
            };

            // Kategóriában lévő repository-k feldolgozása
            for (const repo of repositories) {
                // Repository social preview kép letöltése és beillestése
                try {
                    // A repository teljes neve (owner/repo)
                    const fullName = repo.full_name || `${repo.developer}/${repo.repository_name}`;
                    const [owner, repoName] = fullName.split('/');
                    
                    // Social preview kép URL-je
                    // Formátum: https://opengraph.githubassets.com/1/{owner}/{repo}
                    const socialImageUrl = `https://opengraph.githubassets.com/1/${owner}/${repoName}`;
                    
                    // Proxy használata a CORS problémák elkerülésére
                    // Két módszert próbálunk: 
                    // 1. Lokális proxy API (ha van)
                    // 2. Közvetlen letöltés (fallback)
                    
                    let imageResponse;
                    let retryCount = 0;
                    const maxRetries = 3; // Összesen 3 próbálkozás
                    let useDirectFetch = false;
                    
                    // Exponenciális várakozási idő (ms)
                    const waitTimes = [500, 1000, 2000];
                    
                    while (retryCount < maxRetries) {
                        try {
                            // Próbáljuk először a lokális proxy API-t, ha már többször próbálkoztunk, akkor közvetlenül
                            if (!useDirectFetch) {
                                try {
                                    // Lokális proxy API használata (ha van ilyen endpoint)
                                    // A proxy_image.php fájl letölti a képet a szerveren és visszaadja
                                    const proxyUrl = `proxy_image.php?url=${encodeURIComponent(socialImageUrl)}`;
                                    imageResponse = await fetch(proxyUrl);
                                    
                                    if (imageResponse.ok) {
                                        console.log(`Siker a proxy-n keresztül: ${fullName}`);
                                        break;
                                    } else {
                                        // Ha a proxy nem működik, próbáljuk közvetlenül
                                        useDirectFetch = true;
                                        console.log(`Proxy nem működik, közvetlen próbálkozás: ${fullName}`);
                                    }
                                } catch (proxyError) {
                                    // Ha a proxy nem működik, próbáljuk közvetlenül
                                    useDirectFetch = true;
                                    console.log(`Proxy hiba, közvetlen próbálkozás: ${fullName}`, proxyError);
                                }
                            }
                            
                            // Ha a proxy nem működött vagy nincs, próbáljuk közvetlenül
                            if (useDirectFetch) {
                                // Közvetlen letöltés (CORS korlátozások miatt nem mindig működik)
                                imageResponse = await fetch(socialImageUrl, {
                                    mode: 'cors',  // CORS mód explicit beállítása
                                    credentials: 'omit',  // Ne küldjön cookie-kat
                                    cache: 'no-store'  // Ne használjon cache-t
                                });
                                
                                if (imageResponse.ok) {
                                    console.log(`Siker közvetlen letöltéssel: ${fullName}`);
                                    break;
                                }
                            }
                            
                            // Ha nem sikeres, növeljük a próbálkozások számát
                            retryCount++;
                            
                            // Várakozás növekvő idővel
                            const waitTime = waitTimes[Math.min(retryCount - 1, waitTimes.length - 1)];
                            console.log(`Várakozás ${waitTime}ms a repository kép újrapróbálása előtt: ${fullName}`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                            
                            console.log(`Újrapróbálás (${retryCount}/${maxRetries}): ${fullName}`);
                        } catch (retryError) {
                            console.error(`Hiba a repository kép letöltése során (próbálkozás ${retryCount + 1}/${maxRetries}):`, retryError);
                            retryCount++;
                            
                            // Várakozás növekvő idővel
                            const waitTime = waitTimes[Math.min(retryCount - 1, waitTimes.length - 1)];
                            console.log(`Várakozás ${waitTime}ms a repository kép újrapróbálása előtt: ${fullName}`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }
                    }
                    
                    // Ha sikerült a kép letöltése
                    if (imageResponse && imageResponse.ok) {
                        const imageArrayBuffer = await imageResponse.arrayBuffer();
                        const imageId = workbook.addImage({
                            buffer: imageArrayBuffer,
                            extension: 'png',
                        });
                        
                        // Kép beszúrása 16:9 arányban
                        worksheet.addImage(imageId, {
                            tl: { col: 0, row: rowIndex },
                            ext: { width: 350, height: 170 },  // 16:9 arány
                            editAs: 'oneCell'
                        });
                    } else {
                        throw new Error(`Nem sikerült a repository kép letöltése ${maxRetries} próbálkozás után.`);
                    }
                } catch (error) {
                    console.error('Hiba a repository kép letöltése során:', error);
                    
                    // Ha nem sikerült a repository kép, megpróbáljuk az avatar képet tartalékként
                    try {
                        const avatarResponse = await fetch(repo.avatar_url);
                        const avatarArrayBuffer = await avatarResponse.arrayBuffer();
                        const avatarImageId = workbook.addImage({
                            buffer: avatarArrayBuffer,
                            extension: 'png',
                        });
                        
                        // Avatar kép beszúrása 16:9 arányban
                        worksheet.addImage(avatarImageId, {
                            tl: { col: 0, row: rowIndex },
                            ext: { width: 178, height: 100 },  // 16:9 arány
                            editAs: 'oneCell'
                        });
                    } catch (avatarError) {
                        console.error('Hiba az avatar kép letöltése során:', avatarError);
                    }
                }
                
                // Paraméterek összeállítása
                const params = [
                    { label: 'Developer name:', value: repo.developer },
                    { label: 'Repository name:', value: repo.repository_name },
                    { label: 'URL:', value: repo.url },
                    { label: 'Short description:', value: repo.description || 'N/A' },
                    { label: 'Individual comment:', value: repo.user_comment },
                    { label: 'Last update:', value: new Date(repo.last_update).toLocaleDateString() },
                    { label: 'Last commit:', value: repo.last_commit ? new Date(repo.last_commit).toLocaleDateString() : 'N/A' },
                    { label: 'Number of stars:', value: repo.stars },
                    { label: 'Number of forks:', value: repo.forks },
                    { label: 'Number of developer:', value: repo.contributors_count }
                    
                ];
                
                
                // Paraméterek hozzáadása a táblázathoz
                for (let i = 0; i < params.length; i++) {
                    const currentRow = worksheet.getRow(rowIndex + i);
                    
                    // Paraméter címke
                    const labelCell = currentRow.getCell(2);
                    labelCell.value = params[i].label;
                    labelCell.font = { size: 11, bold: true };
                    if (i % 2 === 0) {
                        labelCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF2F2F2' } // Világosszürke
                        };
                    }
                    
                    // Paraméter érték
                    const valueCell = currentRow.getCell(3);
                    valueCell.value = params[i].value;
                    valueCell.font = { size: 11 };
                    if (i % 2 === 0) {
                        valueCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF2F2F2' } // Világosszürke
                        };
                    }
                    
                    // Ha URL, akkor beállítjuk hyperlinkként
                    if (params[i].label === 'URL:') {
                        valueCell.value = { text: params[i].value, hyperlink: params[i].value };
                        valueCell.font = { size: 11, color: { argb: 'FF2E7D32' }, underline: true };
                    }
                    
                    // Repository name kövérítése és színezése
                    if (params[i].label === 'Repository name:') {
                        valueCell.font = { size: 16, bold: true, color: { argb: 'FF2E7D32' } };
                    }
                    
                    // Short description színezése és kövérítése
                    if (params[i].label === 'Short description:') {
                        valueCell.font = { size: 12, bold: true, color: { argb: 'FF2E7D32' } }; // 12-es méretű, kövérített, sötétzöld betűk
                    }
                    
                    // Individual comment színezése és kövérítése
                    if (params[i].label === 'Individual comment:') {
                        valueCell.font = { size: 12, bold: true, color: { argb: 'FFE27611' } };
                    }
                    
                    // Számértékek balra igazítása
                    if (params[i].label === 'Number of stars:' || 
                        params[i].label === 'Number of forks:' || 
                        params[i].label === 'Number of developer:') {
                        valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
                    }
                }
                
                // Üres sor beszúrása az utolsó paraméter után
                const emptyRow = worksheet.getRow(rowIndex + params.length);
                emptyRow.height = 15; // Üres sor magassága
                
                // Üres sor színezése szürkére (#a9a9a9)
                for (let col = 1; col <= 3; col++) {
                    const cell = emptyRow.getCell(col);
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFB7B7B7' } //rgb(183, 183, 183) szín
                    };
                }
                
                // Következő repository-ra ugrás (paraméterek száma + üres sor)
                rowIndex += params.length + 1;
            }
            
            // Üres sor a kategóriák között
            rowIndex++;
        }
        
        // Nincs itt fájl letöltés, mert azt a createFormattedExcelFile függvény végzi
    }
});
