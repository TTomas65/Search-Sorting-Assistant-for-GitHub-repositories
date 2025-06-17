<?php
/**
 * Import Following Developers
 * 
 * This script imports the user's followed developers from GitHub and saves them to the database
 */

// Include necessary files
require_once 'security_headers.php'; // Biztonsági fejlécek beállítása
require_once 'config.php';
require_once 'session_config.php';
require_once 'error_log.php';
require_once 'encryption_keys.php'; // Token visszafejtéshez
require_once 'github_token_manager.php'; // Token validáláshoz és kezeléshez

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
    
    addDebug("GitHub token found for user: " . $github_username);    // Ellenőrizzük/létrehozzuk a General kategóriát
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
    
    // Create temporary storage for followed developers
    $followedDevelopers = [];
    $page = 1;
    $perPage = 100;
    $hasMorePages = true;
    
    addDebug("Fetching followed developers from GitHub API");
    
    // Fetch all followed developers from GitHub API (with pagination)
    while ($hasMorePages) {
        $followingUrl = "https://api.github.com/user/following?page={$page}&per_page={$perPage}";
        
        addDebug("Fetching page " . $page . " from: " . $followingUrl);
        
        try {
            // Token validáció használata a token manager által
            $valid_token = getValidGitHubToken($_SESSION['user_id'], $dbconn);
            
            $ch = curl_init($followingUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: token ' . $valid_token, // Validált token használata
                'User-Agent: GitHub-App-Search',
                'Accept: application/vnd.github.v3+json'
            ]);
            
            $response_data = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            
            // Check for cURL errors
            if ($response_data === false) {
                $curlError = curl_error($ch);
                curl_close($ch);
                addDebug("cURL error: " . $curlError);
                throw new Exception('cURL error: ' . $curlError);
            }
            
            curl_close($ch);
            
            addDebug("GitHub API response code: " . $httpCode);
            
            if ($httpCode !== 200) {
                addDebug("Failed to fetch followed developers: HTTP " . $httpCode . " Response: " . substr($response_data, 0, 200));
                throw new Exception('Failed to fetch followed developers: HTTP ' . $httpCode);
            }
        } catch (Exception $e) {
            // Ha token lejárt vagy érvénytelen, a getValidGitHubToken már átirányít
            addDebug("Token validation or API call error: " . $e->getMessage());
            throw $e;
        }        
        $developers = json_decode($response_data, true);
        
        if (empty($developers) || !is_array($developers)) {
            addDebug("No more developers found or invalid response");
            $hasMorePages = false;
            break;
        }
        
        addDebug("Found " . count($developers) . " developers on page " . $page);
        
        // Add developers to temporary storage
        foreach ($developers as $developer) {
            $followedDevelopers[] = $developer['login'];
        }
        
        // Check if we have more pages
        if (count($developers) < $perPage) {
            $hasMorePages = false;
        } else {
            $page++;
        }
    }
    
    addDebug("Total followed developers found: " . count($followedDevelopers));
    
    // Get existing favorite developers for this user
    $result = pg_query_params($dbconn, 
        'SELECT github_id, login FROM favorite_developers WHERE user_id = $1',
        array($user_id)
    );
    
    if (!$result) {
        addDebug("Failed to fetch existing favorite developers: " . pg_last_error($dbconn));
        throw new Exception('Failed to fetch existing favorite developers: ' . pg_last_error($dbconn));
    }
    
    $existingFavorites = [];
    while ($row = pg_fetch_assoc($result)) {
        $existingFavorites[$row['login']] = $row['github_id'];
    }
    
    addDebug("Found " . count($existingFavorites) . " existing favorite developers");
    
    // Import followed developers that are not already in favorites
    $imported = 0;
    $skipped = 0;
    $current_time = date('Y-m-d H:i:s');
    
    foreach ($followedDevelopers as $login) {
        // Check if developer is already in favorites
        if (isset($existingFavorites[$login])) {
            $skipped++;
            addDebug("Skipping developer: " . $login . " (already in favorites)");
            continue;
        }
        
        // Fetch detailed developer information from GitHub API
        addDebug("Fetching details for developer: " . $login);
        $developerUrl = "https://api.github.com/users/" . $login;
        
        $ch = curl_init($developerUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: token ' . $github_token,
            'User-Agent: GitHub-App-Search',
            'Accept: application/vnd.github.v3+json'
        ]);
        
        $dev_response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            addDebug("Failed to fetch details for developer " . $login . ": HTTP " . $httpCode);
            continue;
        }        
        $developer_data = json_decode($dev_response, true);
        
        if (!is_array($developer_data)) {
            addDebug("Invalid response for developer " . $login);
            continue;
        }
        
        // Prepare developer data for insertion
        $dev_id = $developer_data['id'] ?? 0;
        $dev_login = $developer_data['login'] ?? '';
        $dev_name = $developer_data['name'] ?? '';
        $dev_avatar_url = $developer_data['avatar_url'] ?? '';
        $dev_html_url = $developer_data['html_url'] ?? '';
        $dev_bio = $developer_data['bio'] ?? '';
        $dev_company = $developer_data['company'] ?? '';
        $dev_location = $developer_data['location'] ?? '';
        $dev_email = $developer_data['email'] ?? '';
        $dev_public_repos = $developer_data['public_repos'] ?? 0;
        $dev_followers = $developer_data['followers'] ?? 0;
        $dev_following = $developer_data['following'] ?? 0;
        $dev_last_updated = $current_time;
        
        // Insert new favorite developer
        $insertResult = pg_query_params($dbconn,
            'INSERT INTO favorite_developers (
                user_id, github_id, login, name, avatar_url, html_url, bio, 
                company, location, email, public_repos, followers, following, 
                last_updated, category_id, notes
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )',
            array(
                $user_id,
                $dev_id,
                $dev_login,
                $dev_name,
                $dev_avatar_url,
                $dev_html_url,
                $dev_bio,
                $dev_company,
                $dev_location,
                $dev_email,
                $dev_public_repos,
                $dev_followers,
                $dev_following,
                $dev_last_updated,
                $category_id,
                '' // notes
            )
        );
        
        if ($insertResult) {
            $imported++;
            addDebug("Successfully imported developer: " . $dev_login);
        } else {
            addDebug("Failed to insert developer " . $dev_login . ": " . pg_last_error($dbconn));
        }
        
        // Add a small delay to avoid hitting GitHub API rate limits
        usleep(100000); // 100ms delay
    }    
    addDebug("Import completed. Imported: " . $imported . ", Skipped: " . $skipped . ", Total: " . count($followedDevelopers));
    
    // Return success response
    $response['success'] = true;
    $response['message'] = 'Successfully imported followed developers';
    $response['imported'] = $imported;
    $response['skipped'] = $skipped;
    $response['total'] = count($followedDevelopers);
    
    ob_end_clean();
    echo json_encode($response);
    
} catch (Exception $e) {
    // Return error response
    addDebug("Error: " . $e->getMessage());
    
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    
    ob_end_clean();
    echo json_encode($response);
}
?>