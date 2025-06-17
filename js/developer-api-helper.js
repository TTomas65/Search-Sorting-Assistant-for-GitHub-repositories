/**
 * Developer API Helper
 * 
 * Ez a segéd script a GitHub API hívásokat kezeli a fejlesztői adatok lekérdezéséhez,
 * így biztosítva, hogy mind az OAuth, mind a hagyományos token alapú hitelesítés megfelelően működjön.
 */

/**
 * GitHub Repository lekérdezése egy fejlesztőhöz
 * @param {string} username A fejlesztő GitHub felhasználóneve
 * @param {number} page Az oldalszám (lapozáshoz)
 * @param {number} perPage Egy oldalon megjelenő elemek száma
 * @returns {Promise<Object>} A repository-k és lapozási információk
 */
async function fetchDeveloperRepositories(username, page = 1, perPage = 100) {
    try {
        // A központi getHeaders() függvényt használjuk a github-auth.js fájlból
        const response = await fetch(
            `https://api.github.com/users/${username}/repos?sort=updated&per_page=${perPage}&page=${page}`, 
            { headers: getHeaders() }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch repositories: ${response.status}`);
        }
        
        const repos = await response.json();
        
        // Ellenőrizzük, hogy van-e további oldal
        const hasNextPage = response.headers.get('Link') && 
                           response.headers.get('Link').includes('rel="next"');
        
        return {
            repos,
            hasNextPage,
            currentPage: page
        };
    } catch (error) {
        console.error(`Error fetching repositories for ${username}:`, error);
        throw error;
    }
}

/**
 * GitHub felhasználói profil lekérdezése
 * @param {string} username A fejlesztő GitHub felhasználóneve
 * @returns {Promise<Object>} A felhasználói profil adatok
 */
async function fetchDeveloperProfile(username) {
    try {
        // A központi getHeaders() függvényt használjuk a github-auth.js fájlból
        const response = await fetch(
            `https://api.github.com/users/${username}`, 
            { headers: getHeaders() }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch developer profile: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error fetching profile for ${username}:`, error);
        throw error;
    }
}

/**
 * GitHub felhasználó csillagozott repository-jainak lekérdezése
 * @param {string} username A fejlesztő GitHub felhasználóneve
 * @param {number} page Az oldalszám (lapozáshoz)
 * @param {number} perPage Egy oldalon megjelenő elemek száma
 * @returns {Promise<Object>} A csillagozott repository-k és lapozási információk
 */
async function fetchDeveloperStarredRepos(username, page = 1, perPage = 100) {
    try {
        // A központi getHeaders() függvényt használjuk a github-auth.js fájlból
        const response = await fetch(
            `https://api.github.com/users/${username}/starred?per_page=${perPage}&page=${page}`, 
            { headers: getHeaders() }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch starred repositories: ${response.status}`);
        }
        
        const starredRepos = await response.json();
        console.log(`Starred repositories for ${username} (page ${page}):`, starredRepos);
        
        // Ellenőrizzük, hogy van-e további oldal
        const hasNextPage = response.headers.get('Link') && 
                           response.headers.get('Link').includes('rel="next"');
        
        // Feldolgozzuk a repository-kat és hozzáadjuk az image_url tulajdonságot
        const processedRepos = starredRepos.map(repo => {
            // Alapértelmezett kép a GitHub OpenGraph kép
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
                image_url: repoImage, // Hozzáadjuk az image_url tulajdonságot
                owner: {
                    login: repo.owner.login,
                    avatar_url: repo.owner.avatar_url,
                    html_url: repo.owner.html_url
                }
            };
        });
        
        return {
            repos: processedRepos, // Visszaadjuk a feldolgozott repository-kat
            hasNextPage,
            currentPage: page
        };
    } catch (error) {
        console.error(`Error fetching starred repos for ${username}:`, error);
        throw error;
    }
}

/**
 * GitHub repository README fájl lekérdezése
 * @param {string} owner A repository tulajdonosa
 * @param {string} repo A repository neve
 * @returns {Promise<string>} A README fájl tartalma
 */
async function fetchRepositoryReadme(owner, repo) {
    try {
        // A központi getHeaders() függvényt használjuk a github-auth.js fájlból
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/readme`, 
            { headers: getHeaders() }
        );
        
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
        console.error(`Error fetching README for ${owner}/${repo}:`, error);
        throw error;
    }
}

/**
 * Csillagozott repository-k számának lekérdezése
 * @param {string} username A fejlesztő GitHub felhasználóneve
 * @returns {Promise<number>} A csillagozott repository-k száma
 */
async function fetchDeveloperStarredCount(username) {
    try {
        // A központi getHeaders() függvényt használjuk a github-auth.js fájlból
        const response = await fetch(
            `https://api.github.com/users/${username}/starred?per_page=1`, 
            { headers: getHeaders() }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch starred count: ${response.status}`);
        }
        
        // Ellenőrizzük a Link header-t a teljes elemszám meghatározásához
        const linkHeader = response.headers.get('Link');
        if (linkHeader && linkHeader.includes('rel="last"')) {
            const matches = linkHeader.match(/page=(\d+)>; rel="last"/);
            if (matches && matches[1]) {
                return parseInt(matches[1]);
            }
        }
        
        // Ha nincs Link header vagy nem tartalmaz page információt, akkor csak egy oldal van
        // Lekérjük a pontos számot
        const starred = await response.json();
        return starred.length;
    } catch (error) {
        console.error(`Error fetching starred count for ${username}:`, error);
        return 0;
    }
}
