<?php
/**
 * GitHub Token Manager
 * 
 * Ez a fájl kezeli a GitHub tokenek validációját, frissítését és helyes használatát.
 * Az API hívások előtt mindig ellenőrizni kell, hogy a token érvényes-e, és szükség esetén
 * átirányítani a felhasználót újrahitelesítésre.
 */
require_once 'security_headers.php'; 
require_once 'config.php';
require_once 'session_config.php';
require_once 'error_log.php';
require_once 'encryption_keys.php'; // Token dekódoláshoz
require_once 'github_oauth_config.php';

/**
 * Érvényes GitHub token lekérése egy felhasználó részére
 * 
 * Ez a függvény:
 * 1. Ellenőrzi, hogy a token létezik-e az adatbázisban
 * 2. Ellenőrzi, hogy a token nem járt-e le
 * 3. Ha a token hamarosan lejár vagy lejárt, átirányít az újrahitelesítésre
 * 4. Visszaadja a dekódolt, érvényes tokent
 * 
 * @param int $user_id A felhasználó azonosítója
 * @param resource $dbconn Adatbázis kapcsolat
 * @return string A dekódolt, érvényes GitHub token
 * @throws Exception Ha nincs token vagy adatbázis hiba történt
 */
function getValidGitHubToken($user_id, $dbconn) {
    // Token és lejárati idő lekérdezése az adatbázisból
    $result = pg_query_params($dbconn, 
        'SELECT github_token, github_token_expiry FROM users WHERE user_id = $1',
        array($user_id)
    );
    
    if (!$result) {
        logError('Token validation error', 'Database query failed: ' . pg_last_error($dbconn));
        throw new Exception('Failed to retrieve token information from the database');
    }
    
    if (pg_num_rows($result) === 0) {
        logError('Token not found', 'No GitHub token found for user: ' . $user_id);
        throw new Exception('No GitHub token available for this user');
    }
    
    $user = pg_fetch_assoc($result);
    
    // Ha nincs lejárati idő vagy üres, akkor probléma van
    if (empty($user['github_token_expiry'])) {
        logError('Missing expiry date', 'GitHub token has no expiry date for user: ' . $user_id);
        throw new Exception('Token expiry information is missing');
    }
    
    // Token lejárati idő ellenőrzése
    $expiry = strtotime($user['github_token_expiry']);
    $now = time();
    
    // 1 órás biztonsági tartalékkal ellenőrizzük a lejáratot
    // (tehát ha 1 órán belül lejárna, már most frissítjük)
    if ($now > $expiry - 3600) {
        logError('Token expired', 'GitHub token has expired or will expire soon for user: ' . $user_id);
        
        // Az aktuális URL mentése a session-be, hogy visszatérhessen a felhasználó
        // az újrahitelesítés után
        $_SESSION['oauth_redirect'] = $_SERVER['REQUEST_URI'] ?? '/index.html';
        
        // Szükség esetén további munkamenet adatok mentése
        $_SESSION['token_expired'] = true;
        
        // Átirányítás az újrahitelesítési oldalra
        header('Location: /login.php?token_expired=1');
        exit;
    }
    
    // A token dekódolása és visszaadása
    if (empty($user['github_token'])) {
        logError('Empty token', 'GitHub token is empty for user: ' . $user_id);
        throw new Exception('GitHub token is empty');
    }
    
    try {
        return decryptToken($user['github_token']);
    } catch (Exception $e) {
        logError('Token decryption error', 'Failed to decrypt GitHub token: ' . $e->getMessage());
        throw new Exception('Failed to decrypt GitHub token');
    }
}

/**
 * GitHub API hívás végrehajtása érvényes tokennel
 * 
 * @param int $user_id A felhasználó azonosítója
 * @param resource $dbconn Adatbázis kapcsolat
 * @param string $endpoint API végpont (/user, /repos, stb.)
 * @param string $method HTTP metódus (GET, POST, stb.)
 * @param array $data Opcionális adatok POST/PUT/PATCH kérésekhez
 * @return array API válasz adatok
 * @throws Exception Ha az API hívás sikertelen
 */
function callGitHubApi($user_id, $dbconn, $endpoint, $method = 'GET', $data = null) {
    // Érvényes token lekérése (ez kezeli az újrahitelesítést is, ha szükséges)
    $token = getValidGitHubToken($user_id, $dbconn);
    
    $url = GITHUB_API_URL . $endpoint;
    $ch = curl_init($url);
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . $token,
        'User-Agent: GitHub-OAuth-App',
        'Accept: application/json'
    ]);
    
    // HTTP metódus és adatok beállítása
    if ($method !== 'GET') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: token ' . $token,
                'User-Agent: GitHub-OAuth-App',
                'Accept: application/json',
                'Content-Type: application/json',
                'Content-Length: ' . strlen(json_encode($data))
            ]);
        }
    }
    
    $response = curl_exec($ch);
    
    // API hiba ellenőrzése
    if (curl_error($ch)) {
        $error = curl_error($ch);
        curl_close($ch);
        logError('GitHub API error', 'API call failed: ' . $error);
        throw new Exception('GitHub API call failed: ' . $error);
    }
    
    // HTTP státusz kód ellenőrzése
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($status === 401) {
        // 401 Unauthorized - valószínűleg érvénytelen vagy lejárt token
        logError('GitHub token invalid', 'API returned 401 Unauthorized - token likely expired');
        
        // Token megjelölése lejártként és újrahitelesítés kezdeményezése
        $_SESSION['oauth_redirect'] = $_SERVER['REQUEST_URI'] ?? '/index.html';
        $_SESSION['token_expired'] = true;
        header('Location: /login.php?token_invalid=1');
        exit;
    }
    
    if ($status >= 400) {
        logError('GitHub API error', 'API returned error code: ' . $status);
        throw new Exception('GitHub API returned error status: ' . $status);
    }
    
    return json_decode($response, true);
}

/**
 * Token frissítése a GitHub callback alapján
 * 
 * Ezt a függvényt a github_callback.php fájl hívja meg, amikor új token érkezik
 * 
 * @param int $user_id A felhasználó azonosítója
 * @param string $token Az új GitHub token
 * @param resource $dbconn Adatbázis kapcsolat
 * @return bool Sikeres frissítés esetén true
 * @throws Exception Ha a frissítés sikertelen
 */
function updateGitHubToken($user_id, $token, $dbconn) {
    // Az új token titkosítása
    $encryptedToken = encryptToken($token);
    
    // Új lejárati idő számítása
    $token_expiry = date('Y-m-d H:i:s', time() + TOKEN_EXPIRY);
    
    // Token frissítése az adatbázisban
    $update_result = pg_query_params($dbconn,
        'UPDATE users SET github_token = $1, github_token_expiry = $2 WHERE user_id = $3',
        array($encryptedToken, $token_expiry, $user_id)
    );
    
    if ($update_result === false) {
        logError('Token update failed', pg_last_error($dbconn));
        throw new Exception('Failed to update GitHub token');
    }
    
    return true;
}

/**
 * Token lejárati idejének ellenőrzése a felhasználónak szóló figyelmeztetéshez
 * 
 * @param int $user_id A felhasználó azonosítója
 * @param resource $dbconn Adatbázis kapcsolat
 * @return array A token információi (days_left, expired)
 */
function checkTokenExpiration($user_id, $dbconn) {
    // Token és lejárati idő lekérdezése
    $result = pg_query_params($dbconn, 
        'SELECT github_token_expiry FROM users WHERE user_id = $1',
        array($user_id)
    );
    
    if (!$result || pg_num_rows($result) === 0) {
        return ['days_left' => 0, 'expired' => true];
    }
    
    $user = pg_fetch_assoc($result);
    
    if (empty($user['github_token_expiry'])) {
        return ['days_left' => 0, 'expired' => true];
    }
    
    $expiry = strtotime($user['github_token_expiry']);
    $now = time();
    $days_left = floor(($expiry - $now) / (60 * 60 * 24));
    
    return [
        'days_left' => max(0, $days_left),
        'expired' => $now >= $expiry
    ];
}
?>
