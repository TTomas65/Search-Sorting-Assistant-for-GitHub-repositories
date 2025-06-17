/**
 * GitHub API Token kezelés és segédfüggvények
 * 
 * Ez a globális utility fájl biztosítja, hogy a GitHub API hívások megfelelően
 * működjenek mind a hagyományos token-alapú, mind az OAuth 2.0 belépéssel.
 */

// Token betöltése: csak OAuth token a sessionStorage-ból
function loadToken() {
    // Csak az OAuth tokent használjuk a sessionStorage-ból
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

// Token mentése - már nem használjuk, csak az OAuth bejelentkezést támogatjuk
function saveToken(token) {
    // A manuális token megadást már nem támogatjuk, csak az OAuth bejelentkezést
    console.warn('Manual token input is no longer supported. Please use GitHub OAuth login.');
}

// Autentikáció ellenőrzése
function isAuthenticated() {
    return !!loadToken();
}

// GitHub felhasználóadatok lekérése
async function fetchGitHubUserData(username) {
    try {
        const response = await fetch(`https://api.github.com/users/${username}`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Error fetching GitHub user data:', error);
        return null;
    }
}
