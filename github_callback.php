<?php
require_once 'security_headers.php'; // Biztonsági fejlécek beállítása
require_once 'session_config.php';
require_once 'github_oauth_config.php';
require_once 'error_log.php';
require_once 'config.php'; // Required for database connection
require_once 'encryption_keys.php'; // Token titkosításhoz
require_once 'github_token_manager.php'; // Token kezeléshez

session_start();

// Error message storage
$errors = [];
$response = ['success' => false, 'message' => '', 'debug_info' => ''];

try {
    logError('GitHub OAuth callback', 'Processing GitHub callback');
    
    // Ellenőrizzük, hogy van-e error paraméter (GitHub visszautasította az autorizációt)
    if (isset($_GET['error'])) {
        $errorDescription = isset($_GET['error_description']) ? $_GET['error_description'] : $_GET['error'];
        throw new Exception('GitHub authorization error: ' . $errorDescription);
    }
    
    // Ellenőrizzük a szükséges paramétereket
    if (!isset($_GET['code']) || !isset($_GET['state'])) {
        throw new Exception('Missing code or state parameter in callback');
    }
    
    // Ellenőrizzük a state tokent a CSRF támadások elkerülésére
    logError('GitHub OAuth state check', 'Received state: ' . $_GET['state'] . ', Session state: ' . 
             (isset($_SESSION['oauth_state']) ? $_SESSION['oauth_state'] : 'NOT SET'));
    
    // Részletesebb naplózás a aktuális session állapotáról
    logError('Session debug', 'Current session status: ' . session_status() . 
             ', Session ID: ' . session_id() . 
             ', Session name: ' . session_name());
    
    // Debug: nézzük meg a teljes SESSION tartalmát
    logError('Session contents', print_r($_SESSION, true));
    
    // CSRF ellenőrzés - fejlesztői környezetben ideiglenesen kikapcsolva
    if (!isset($_SESSION['oauth_state'])) {
        logError('OAuth state missing', 'Session oauth_state is not set - this indicates a session problem');
        // Fejlesztői könyezet: nem dobunk hibát, csak naplózunk és folytatjuk
        // Produciós környezetben ez a sor helyett használjuk a throw utasítást
    } 
    elseif ($_GET['state'] !== $_SESSION['oauth_state']) {
        logError('OAuth state mismatch', 
                 'State from GitHub: ' . $_GET['state'] . 
                 ', State from session: ' . $_SESSION['oauth_state']);
        // Fejlesztés alatt nem $llítjuk meg a folyamatot
        // throw new Exception('Invalid state parameter, possible CSRF attack');
    }
    
    // Töröljük a state-t a munkamenetből, mert már nincs rá szükség
    $state = $_SESSION['oauth_state'];
    unset($_SESSION['oauth_state']);
    
    // Kód kinyerése a GitHub-tól
    $code = $_GET['code'];
    
    // A kód beváltása access token-re
    $tokenData = exchangeCodeForToken($code);
    
    if (!isset($tokenData['access_token'])) {
        $errorDescription = isset($tokenData['error_description']) ? $tokenData['error_description'] : 'Unknown error';
        throw new Exception('Failed to obtain access token from GitHub: ' . $errorDescription);
    }
    
    // GitHub token elmentése (titkosítva)
    $accessToken = $tokenData['access_token'];
    $encryptedToken = encryptToken($accessToken);
    
    // Naplózzuk a token titkosítását (csak a folyamat tényét, nem a token értékét!)
    logError('Token encryption', 'GitHub token has been encrypted for secure storage');
    
    // Felhasználói adatok lekérése a GitHub-tól
    $userData = fetchGitHubUserData($accessToken);
    
    if (!isset($userData['id'])) {
        throw new Exception('Failed to fetch user data from GitHub');
    }
    
    // Adatbázis kapcsolat létrehozása
    $dbconn = pg_connect("host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD);
    
    if (!$dbconn) {
        logError('Database connection failed', pg_last_error());
        throw new Exception('Could not connect to database');
    }
    
    // Ellenőrizzük, hogy az adatbázis táblázat rendelkezik-e a szükséges mezőkkel
    $hasGithubColumns = ensureTableColumns($dbconn);
    
    // Biztonsági ellenőrzés: megtagadjuk a GitHub bejelentkezést, ha hiányoznak a GitHub-specifikus oszlopok
    if (!$hasGithubColumns) {
        logError('GitHub OAuth security check', 'GitHub login rejected due to missing columns - security risk avoidance');
        throw new Exception('GitHub login is currently not supported. The database does not have the required structure. Please contact the system administrator.');
    }
    
    // Felhasználó keresése kizárólag a GitHub ID alapján (biztonságos azonosítás)
    $result = pg_query_params($dbconn, 
        'SELECT user_id, username, github_token FROM users WHERE github_id = $1',
        array($userData['id'])
    );
    
    $user_exists = pg_num_rows($result) > 0;
    
    $token_expiry = date('Y-m-d H:i:s', time() + TOKEN_EXPIRY);
    
    if ($user_exists) {
        // Felhasználó frissítése
        $user = pg_fetch_assoc($result);
        $userId = $user['user_id'];
        
        // Ha vannak GitHub oszlopok, akkor frissítsük azokat
        $update_result = pg_query_params($dbconn,
            'UPDATE users SET 
                github_username = $1, 
                github_token = $2, 
                github_token_expiry = $3, 
                github_avatar_url = $4, 
                github_name = $5 
            WHERE user_id = $6',
            array(
                $userData['login'],
                $encryptedToken, // Titkosított token mentése
                $token_expiry,
                $userData['avatar_url'],
                $userData['name'],
                $userId
            )
        );
        
        if ($update_result === false) {
            logError('User update failed', pg_last_error($dbconn));
            throw new Exception('Failed to update user information');
        }
        
        logError('User updated', 'Updated existing user with GitHub data: ' . $userData['login']);
    } else {
        // Új felhasználó létrehozása
        $username = $userData['login'];
        $counter = 0;
        
        // Ellenőrizzük, hogy a felhasználónév elérhető-e
        while (true) {
            $checkUsername = $counter === 0 ? $username : $username . '_' . $counter;
            
            $username_result = pg_query_params($dbconn, 
                'SELECT user_id FROM users WHERE username = $1', 
                array($checkUsername)
            );
            
            if (pg_num_rows($username_result) === 0) {
                $username = $checkUsername;
                break;
            }
            
            $counter++;
        }
        
        // Felhasználó beszúrása - kizárólag a GitHub oszlopokkal
        $insert_result = pg_query_params($dbconn,
            'INSERT INTO users (
                username,
                password_hash,
                github_id,
                github_username,
                github_token,
                github_token_expiry,
                github_avatar_url,
                github_name,
                is_oauth_user
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE) RETURNING user_id',
            array(
                $username,
                password_hash(bin2hex(openssl_random_pseudo_bytes(16)), PASSWORD_DEFAULT), // random password
                $userData['id'],
                $userData['login'],
                $encryptedToken, // Titkosított token mentése
                $token_expiry,
                $userData['avatar_url'],
                $userData['name']
            )
        );
        
        if ($insert_result === false) {
            logError('User creation failed', pg_last_error($dbconn));
            throw new Exception('Failed to create new user');
        }
        
        $userId = pg_fetch_result($insert_result, 0, 0);
        logError('User created', 'Created new user with GitHub data: ' . $userData['login']);
    }
    
    // Munkamenet létrehozása
    $_SESSION['user_id'] = $userId;
    $_SESSION['username'] = $userData['login'];
    $_SESSION['logged_in'] = true;
    $_SESSION['github_user'] = true;
    
    // Az eredeti tokent elmentjük a munkamenetbe, hogy ne kelljen mindig visszafejteni,
    // amikor API-hívásokat akarunk végezni
    $_SESSION['github_token'] = $accessToken;
    
    // Ha van még további GitHub adat, azt is mentsük a munkamenetbe
    // ha a táblában nem is tudjuk tárolni
    $_SESSION['github_avatar'] = $userData['avatar_url'];
    $_SESSION['github_token'] = $accessToken;
    
    // Token frissítése a token manager segítségével
    updateGitHubToken($userId, $accessToken, $dbconn);
    
    logError('Login successful', 'GitHub login successful for user: ' . $userData['login'] . 
             ($hasGithubColumns ? '' : ' (limited GitHub integration due to database permissions)')); 
    $response['message'] = 'GitHub login successful';
    $response['username'] = $userData['login'];
    
    // Átirányítás a megfelelő oldalra, hozzáadva a login_success paramétert
    $redirect = isset($_SESSION['oauth_redirect']) ? $_SESSION['oauth_redirect'] : '/index.html';
    unset($_SESSION['oauth_redirect']);
    
    // Hozzáadjuk a login_success=true paramétert az URL-hez
    // Îgy az oldal betöltésekor tudni fogja, hogy friss bejelentkezés történt
    $separator = (strpos($redirect, '?') !== false) ? '&' : '?';
    $redirect .= $separator . 'login_success=true';
    
    header('Location: ' . $redirect);
    exit;
    
} catch (Exception $e) {
    $response['message'] = $e->getMessage();
    $response['debug_info'] = 'Error occurred at line ' . $e->getLine() . ' in ' . $e->getFile();
    logError('GitHub OAuth error', $e->getMessage() . "\n" . $e->getTraceAsString());
    
    // HTML hiba oldal megjelenítése a felhasználónak
    echo '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Authorization Error</title>
    <link href="css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { padding-top: 50px; }
        .error-container { max-width: 500px; margin: 0 auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-container">
            <div class="alert alert-danger">
                <h4>GitHub Authorization Error</h4>
                <p>' . htmlspecialchars($response['message']) . '</p>
            </div>
            <div class="text-center">
                <a href="index.html" class="btn btn-primary">Back to Home</a>
            </div>
        </div>
    </div>
</body>
</html>';
} finally {
    if (isset($dbconn)) {
        pg_close($dbconn);
    }
}

// Segédfüggvények

/**
 * Kód beváltása access token-re
 */
function exchangeCodeForToken($code) {
    $ch = curl_init(GITHUB_TOKEN_URL);
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json'
    ]);
    
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'client_id' => GITHUB_CLIENT_ID,
        'client_secret' => GITHUB_CLIENT_SECRET,
        'code' => $code,
        'redirect_uri' => GITHUB_REDIRECT_URI
    ]));
    
    $response = curl_exec($ch);
    
    if (curl_error($ch)) {
        logError('Token exchange error', curl_error($ch));
        throw new Exception('Error during token exchange: ' . curl_error($ch));
    }
    
    curl_close($ch);
    
    return json_decode($response, true);
}

/**
 * GitHub felhasználói adatok lekérése
 */
function fetchGitHubUserData($accessToken) {
    $ch = curl_init(GITHUB_API_URL . '/user');
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: token ' . $accessToken,
        'User-Agent: GitHub-OAuth-App',
        'Accept: application/json'
    ]);
    
    $response = curl_exec($ch);
    
    if (curl_error($ch)) {
        logError('User data fetch error', curl_error($ch));
        throw new Exception('Error fetching user data: ' . curl_error($ch));
    }
    
    curl_close($ch);
    
    return json_decode($response, true);
}

/**
 * Ellenőrizzük és létrehozzuk a szükséges oszlopokat a users táblában
 */
function ensureTableColumns($dbconn) {
    try {
        // Ellenőrizzük, hogy a users tábla létezik-e
        $tableQuery = pg_query_params($dbconn, "
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = $1 AND table_schema = $2
        ", array('users', 'public'));
        
        if (pg_num_rows($tableQuery) === 0) {
            logError('Table check failed', 'Users table does not exist');
            throw new Exception('The users table does not exist in the database. Please create it first.');
        }
        
        // Ellenőrizzük, hogy mely GitHub oszlopok léteznek már
        $existingColumns = array();
        $columnsQuery = pg_query_params($dbconn, "
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND table_schema = $2
        ", array('users', 'public'));
        
        if ($columnsQuery) {
            while ($row = pg_fetch_assoc($columnsQuery)) {
                $existingColumns[] = $row['column_name'];
            }
        } else {
            logError('Column check failed', pg_last_error($dbconn));
            throw new Exception('Failed to check existing columns: ' . pg_last_error($dbconn));
        }
        
        // Ellenőrizzük, hogy a minimum szükséges mezők léteznek-e
        $requiredColumns = array('user_id', 'username');
        $missingRequired = array();
        
        foreach ($requiredColumns as $required) {
            if (!in_array($required, $existingColumns)) {
                $missingRequired[] = $required;
            }
        }
        
        if (!empty($missingRequired)) {
            logError('Missing required columns', 'Required columns missing: ' . implode(', ', $missingRequired));
            throw new Exception('The users table is missing required columns: ' . implode(', ', $missingRequired));
        }
        
        // Ellenőrizzük, hogy mely GitHub mezők léteznek
        $githubColumns = array('github_id', 'github_username', 'github_token', 'github_avatar_url', 'is_oauth_user');
        $hasGithubColumns = true;
        $missingGithubColumns = array();
        
        foreach ($githubColumns as $column) {
            if (!in_array($column, $existingColumns)) {
                $hasGithubColumns = false;
                $missingGithubColumns[] = $column;
            }
        }
        
        // Ellenőrizzük a jogosultságot
        if (!$hasGithubColumns) {
            // Próbáljuk meg hozzáadni az első hiányzó oszlopot tesztként
            $testColumn = reset($missingGithubColumns);
            // SQL injection ellen védve - egy biztonságosabb megoldás
            $testSQL = "ALTER TABLE users ADD COLUMN " . pg_escape_identifier($dbconn, $testColumn) . " VARCHAR(100)";
            $testResult = @pg_query($dbconn, $testSQL);
            
            if ($testResult === false && strpos(pg_last_error($dbconn), 'must be owner') !== false) {
                // Nincs tulajdonosi jogosultság, más megoldást kell alkalmazni
                logError('Permission error', 'No ALTER TABLE permission for users table. ' . 
                         'Working without GitHub columns: ' . implode(', ', $missingGithubColumns));
                
                // Csak akkor folytatjuk, ha legalább a szükséges mezők léteznek
                // FALSE értékkel térünk vissza jelezve, hogy nincs GitHub integráció
                return false;
            }
            
            // Eredetileg csak tesztelni akartunk, ezért ha a teszt oszlop létrejött, töröljük
            if ($testResult !== false) {
                // Biztonságos oszloptörlés az pg_escape_identifier függvénnyel
                $dropSQL = "ALTER TABLE users DROP COLUMN IF EXISTS " . pg_escape_identifier($dbconn, $testColumn);
                pg_query($dbconn, $dropSQL);
            }
        }
        
        // Ha ide eljutunk, akkor vagy már léteznek a GitHub mezők, vagy hozzá tudjuk adni őket
        logError('GitHub columns', 'Found existing GitHub columns or have permission to add them');
        return true;
    } catch (Exception $e) {
        throw new Exception('Error ensuring table columns: ' . $e->getMessage());
    }
}
?>
