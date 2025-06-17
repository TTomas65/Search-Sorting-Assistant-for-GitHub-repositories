<?php
require_once 'security_headers.php'; // Biztonsági fejlécek beállítása
require_once 'config.php';
require_once 'error_log.php';
require_once 'encryption_keys.php'; // Token visszafejtéshez
require_once 'github_token_manager.php'; // Token validáláshoz és kezeléshez
session_start();

// Kikapcsoljuk a HTML error megjelenítést
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

session_start();

// Töröljük a korábbi outputokat
ob_clean();
header('Content-Type: application/json');

$response = ['success' => false, 'message' => '', 'debug' => [], 'imported' => 0, 'skipped' => 0, 'total' => 0];

function addDebug($message) {
    global $response;
    $response['debug'][] = $message;
    error_log($message);
}

// Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
    $response['message'] = 'This feature is only available for registered users.';
    addDebug("User not logged in. Session: " . print_r($_SESSION, true));
    ob_end_clean();
    echo json_encode($response);
    exit;
}

addDebug("User is logged in: " . $_SESSION['user_id']);

// Ellenőrizzük, hogy van-e GitHub token
$user_id = $_SESSION['user_id'];

try {
    // Adatbázis kapcsolat létrehozása
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        $error = pg_last_error();
        addDebug("Database connection failed: " . $error);
        throw new Exception('Database connection failed: ' . $error);
    }

    addDebug("Database connection successful");

    // Felhasználó GitHub token lekérdezése
    $user_query = "SELECT github_token, github_username FROM users WHERE user_id = $1";
    $user_result = pg_query_params($dbconn, $user_query, array($user_id));
    
    if (!$user_result) {
        addDebug("Error fetching user data: " . pg_last_error($dbconn));
        throw new Exception('Error fetching user data');
    }
    
    if (pg_num_rows($user_result) == 0) {
        addDebug("User not found in database");
        throw new Exception('User not found in database');
    }
    
    $user_data = pg_fetch_assoc($user_result);
    // Visszafejtjük a titkosított GitHub tokent az adatbázisból
    $encrypted_token = $user_data['github_token'];
    $github_token = decryptToken($encrypted_token);
    $github_username = $user_data['github_username'];
    
    if (empty($github_token)) {
        addDebug("GitHub token not found for user");
        throw new Exception('GitHub token not found for user');
    }
    
    addDebug("GitHub token found for user: " . $github_username);

    // Ellenőrizzük/létrehozzuk a General kategóriát
    $check_general_sql = "SELECT category_id FROM user_categories WHERE user_id = $1 AND category_name = 'General'";
    $check_general = pg_query_params($dbconn, $check_general_sql, array($user_id));

    if ($check_general === false) {
        addDebug("Error checking general category: " . pg_last_error($dbconn));
        throw new Exception('Error checking general category');
    }

    $category_id = null;
    if (pg_num_rows($check_general) == 0) {
        addDebug("Creating General category...");
        $create_general_sql = "INSERT INTO user_categories (user_id, category_name) VALUES ($1, 'General') RETURNING category_id";
        $create_general = pg_query_params($dbconn, $create_general_sql, array($user_id));
        
        if ($create_general === false) {
            addDebug("Error creating general category: " . pg_last_error($dbconn));
            throw new Exception('Failed to create General category: ' . pg_last_error($dbconn));
        }
        $category_row = pg_fetch_assoc($create_general);
        $category_id = $category_row['category_id'];
        addDebug("Created General category with ID: " . $category_id);
    } else {
        $category_row = pg_fetch_assoc($check_general);
        $category_id = $category_row['category_id'];
        addDebug("Found existing General category with ID: " . $category_id);
    }

    // Létrehozunk egy "GitHub Watching" kategóriát minden importált repozitóriumhoz
    $watching_category_name = "GitHub Watching";
    $watching_category_id = null;
    
    // Ellenőrizzük, hogy létezik-e már ez a kategória
    $check_watching_sql = "SELECT category_id FROM user_categories WHERE user_id = $1 AND category_name = $2";
    $check_watching = pg_query_params($dbconn, $check_watching_sql, array($user_id, $watching_category_name));
    
    if ($check_watching === false) {
        addDebug("Error checking GitHub Watching category: " . pg_last_error($dbconn));
        throw new Exception('Error checking GitHub Watching category');
    } else if (pg_num_rows($check_watching) > 0) {
        // Ha már létezik a kategória, használjuk azt
        $watching_row = pg_fetch_assoc($check_watching);
        $watching_category_id = $watching_row['category_id'];
        addDebug("Using existing GitHub Watching category with ID: $watching_category_id");
    } else {
        // Létrehozzuk az új kategóriát
        $create_watching_sql = "INSERT INTO user_categories (user_id, category_name) VALUES ($1, $2) RETURNING category_id";
        $create_watching = pg_query_params($dbconn, $create_watching_sql, array($user_id, $watching_category_name));
        
        if ($create_watching === false) {
            addDebug("Error creating GitHub Watching category: " . pg_last_error($dbconn));
            throw new Exception('Error creating GitHub Watching category');
        } else {
            $watching_row = pg_fetch_assoc($create_watching);
            $watching_category_id = $watching_row['category_id'];
            addDebug("Created new GitHub Watching category with ID: $watching_category_id");
        }
    }
    
    // GitHub API hívás a figyelt repozitóriumok lekérdezéséhez
    $page = 1;
    $per_page = 100;
    $all_repos = array();
    $has_more = true;
    
    while ($has_more) {
        $watching_url = "https://api.github.com/user/subscriptions?page=$page&per_page=$per_page";
        addDebug("Fetching watching repositories from: $watching_url");
        
        try {
            // Token validáció használata a token manager által
            $valid_token = getValidGitHubToken($_SESSION['user_id'], $dbconn);
            
            $ch = curl_init($watching_url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array(
                'Authorization: token ' . $valid_token, // Validált token használata
                'User-Agent: GitHub-App-Search',
                'Accept: application/vnd.github.v3+json'
            ));
            
            $watching_response = curl_exec($ch);
            $watching_http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curl_error = curl_error($ch);
            curl_close($ch);
            
            if ($watching_http_code != 200) {
                addDebug("GitHub API error: HTTP code $watching_http_code");
                addDebug("Response: " . $watching_response);
                if (!empty($curl_error)) {
                    addDebug("cURL error: " . $curl_error);
                }
                throw new Exception("Failed to fetch watching repositories from GitHub.");
            }
        } catch (Exception $e) {
            // Ha token lejárt vagy érvénytelen, a getValidGitHubToken már átirányít
            addDebug("Token validation or API call error: " . $e->getMessage());
            throw $e;
        }
        
        $repos_data = json_decode($watching_response, true);
        
        if (!is_array($repos_data)) {
            addDebug("Invalid response from GitHub API: " . substr($watching_response, 0, 200));
            throw new Exception("Invalid response from GitHub API.");
        }
        
        $count = count($repos_data);
        addDebug("Fetched $count watching repositories from page $page");
        
        // Debug: első repozitórium adatai
        if ($count > 0 && isset($repos_data[0])) {
            $first_repo = $repos_data[0];
            addDebug("First repository data: " . json_encode(array(
                'id' => isset($first_repo['id']) ? $first_repo['id'] : 'missing',
                'name' => isset($first_repo['name']) ? $first_repo['name'] : 'missing',
                'full_name' => isset($first_repo['full_name']) ? $first_repo['full_name'] : 'missing'
            )));
        }
        
        if ($count > 0) {
            $all_repos = array_merge($all_repos, $repos_data);
            $page++;
            
            // Ha kevesebb repozitóriumot kaptunk vissza, mint a per_page, akkor nincs több oldal
            if ($count < $per_page) {
                $has_more = false;
            }
        } else {
            $has_more = false;
        }
    }
    
    $total_repos = count($all_repos);
    $response['total'] = $total_repos;
    addDebug("Total watching repos found: $total_repos");
    
    // Kezdjük tranzakcióval - paraméteres hívással az SQL injection ellen
    $begin_result = pg_query_params($dbconn, "BEGIN", array());
    if (!$begin_result) {
        addDebug("Failed to start transaction: " . pg_last_error($dbconn));
        throw new Exception("Failed to start transaction");
    }
    addDebug("Transaction started");
    
    $imported = 0;
    $skipped = 0;
    
    foreach ($all_repos as $repo) {
        // Ellenőrizzük, hogy már kedvenc-e ez a repo
        $check_favorite_sql = "SELECT favorite_id FROM favorite_repos WHERE user_id = $1 AND repo_id = $2";
        $check_favorite = pg_query_params($dbconn, $check_favorite_sql, array($user_id, $repo['id']));
        
        if ($check_favorite === false) {
            addDebug("Error checking if repository exists: " . pg_last_error($dbconn));
            continue; // Ugrás a következő repóra hiba esetén
        }
        
        if (pg_num_rows($check_favorite) > 0) {
            // A repozitórium már szerepel a kedvencek között
            addDebug("Repository " . $repo['full_name'] . " already exists in favorites.");
            $skipped++;
            continue;
        }
        
        // Ellenőrizzük, hogy a repozitórium tartalmazza-e a szükséges mezőket
        if (!isset($repo['id']) || !isset($repo['name']) || !isset($repo['full_name']) || 
            !isset($repo['html_url']) || !isset($repo['owner']['login']) || !isset($repo['owner']['html_url'])) {
            addDebug("Missing required fields for repo: " . $repo['full_name']);
            continue; // Ugrás a következő repóra
        }
        
        addDebug("Processing repository: " . $repo['full_name']);
        
        // Alapértelmezett értékek beállítása
        $languages = array();
        $contributors_count = 1;
        $commits_count = 1;
        
        // Repozitórium mentése a kedvencek közé
        $save_favorite_sql = "INSERT INTO favorite_repos 
            (user_id, repo_id, name, full_name, description, html_url, owner, owner_url, category_id, individual_notes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING favorite_id";
        
        // Paraméterek előkészítése
        $params = array(
            $user_id,
            $repo['id'],
            $repo['name'],
            $repo['full_name'],
            isset($repo['description']) ? $repo['description'] : '',
            $repo['html_url'],
            $repo['owner']['login'],
            $repo['owner']['html_url'],
            $watching_category_id !== null ? $watching_category_id : $category_id,
            '' // Üres jegyzetek
        );
        
        addDebug("Prepared parameters for saving repository: " . $repo['full_name']);
        
        // Repozitórium mentése
        $save_result = pg_query_params($dbconn, $save_favorite_sql, $params);
        
        if ($save_result === false) {
            addDebug("Error saving favorite: " . pg_last_error($dbconn));
            continue; // Ugrás a következő repóra hiba esetén
        }
        
        addDebug("Repository saved successfully: " . $repo['full_name']);
        
        $favorite_row = pg_fetch_assoc($save_result);
        $favorite_id = $favorite_row['favorite_id'];
        addDebug("Favorite saved with ID: " . $favorite_id . " for repo: " . $repo['full_name']);
        
        // Statisztikák mentése - egyszerűsített változat
        $save_stats_sql = "INSERT INTO repo_statistics 
            (favorite_id, stars_count, forks_count, contributors_count, commits_count, languages) 
            VALUES ($1, $2, $3, $4, $5, $6)";
        
        $stars = isset($repo['stargazers_count']) ? intval($repo['stargazers_count']) : 0;
        $forks = isset($repo['forks_count']) ? intval($repo['forks_count']) : 0;
        
        $stats_params = array(
            $favorite_id,
            $stars,
            $forks,
            $contributors_count,
            $commits_count,
            '{}' // Üres JSON objektum a nyelveknek
        );
        
        addDebug("Executing stats query with parameters: favorite_id=$favorite_id, stars=$stars, forks=$forks");
        
        $save_stats_result = pg_query_params($dbconn, $save_stats_sql, $stats_params);
        
        if ($save_stats_result === false) {
            addDebug("Error saving statistics: " . pg_last_error($dbconn));
            // Nem dobálunk kivételt, csak naplózzuk a hibát és folytatjuk
            addDebug("Continuing despite statistics error");
        } else {
            addDebug("Statistics saved successfully");
        }
        
        $imported++;
        addDebug("Repository " . $repo['full_name'] . " added to favorites successfully");
    }
    
    // Commit a tranzakciót - paraméteres hívással az SQL injection ellen
    $commit_result = pg_query_params($dbconn, "COMMIT", array());
    if (!$commit_result) {
        addDebug("Failed to commit transaction: " . pg_last_error($dbconn));
        throw new Exception("Failed to commit transaction");
    }
    addDebug("Transaction committed successfully");
    
    $response['success'] = true;
    $response['message'] = "Import completed successfully. Imported: $imported, Skipped: $skipped, Total: $total_repos";
    $response['imported'] = $imported;
    $response['skipped'] = $skipped;

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = 'Internal server error: ' . $e->getMessage();
    $response['success'] = false;
    addDebug("Error in import_watching_repos.php: " . $e->getMessage());
    
    if (isset($dbconn)) {
        $rollback_result = pg_query_params($dbconn, "ROLLBACK", array());
        if (!$rollback_result) {
            addDebug("Failed to rollback transaction: " . pg_last_error($dbconn));
        } else {
            addDebug("Transaction rolled back");
        }
    }
}

// Adatbázis kapcsolat lezárása, ha létezik
if (isset($dbconn)) {
    pg_close($dbconn);
    addDebug("Database connection closed");
}

// Válasz küldése
ob_end_clean();
echo json_encode($response);
?>