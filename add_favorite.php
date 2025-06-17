<?php
require_once 'security_headers.php'; 
require_once 'config.php';
require_once 'session_config.php';
require_once 'error_log.php';

// Kikapcsoljuk a HTML error megjelenítést
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

session_start();

// Töröljük a korábbi outputokat
ob_clean();
header('Content-Type: application/json');

$response = ['success' => false, 'message' => '', 'debug' => []];

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

// Ellenőrizzük, hogy megkaptuk-e a szükséges adatokat
$raw_input = file_get_contents('php://input');
addDebug("Raw input received: " . $raw_input);

$data = json_decode($raw_input, true);
if (!isset($data['repo_data'])) {
    $response['message'] = 'Repository data is missing.';
    addDebug("Repository data is missing from request. Received data: " . print_r($data, true));
    ob_end_clean();
    echo json_encode($response);
    exit;
}

try {
    $repo_data = $data['repo_data'];
    addDebug("Processing repo data: " . print_r($repo_data, true));

    if (!isset($repo_data['repo_id']) || !isset($repo_data['name'])) {
        addDebug("Invalid repository data format. Missing required fields.");
        throw new Exception('Invalid repository data format.');
    }

    addDebug("Connecting to database...");
    addDebug("Connection string: host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER);
    
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        $error = pg_last_error();
        addDebug("Database connection failed: " . $error);
        throw new Exception('Database connection failed: ' . $error);
    }

    addDebug("Database connection successful");

    // Kezdjük tranzakcióval - paraméteres hívással az SQL injection ellen
    $begin_result = pg_query_params($dbconn, "BEGIN", array());
    if (!$begin_result) {
        addDebug("Failed to start transaction: " . pg_last_error($dbconn));
        throw new Exception("Failed to start transaction");
    }
    addDebug("Transaction started");

    // Ellenőrizzük/létrehozzuk a General kategóriát
    $check_general_sql = "SELECT category_id FROM user_categories WHERE user_id = $1 AND category_name = 'General'";
    addDebug("Executing query: " . $check_general_sql . " with user_id: " . $_SESSION['user_id']);
    
    $check_general = pg_query_params($dbconn, $check_general_sql, array($_SESSION['user_id']));

    if ($check_general === false) {
        addDebug("Error checking general category: " . pg_last_error($dbconn));
        throw new Exception('Error checking general category');
    }

    if (pg_num_rows($check_general) == 0) {
        addDebug("Creating General category...");
        $create_general_sql = "INSERT INTO user_categories (user_id, category_name) VALUES ($1, 'General') RETURNING category_id";
        addDebug("Executing query: " . $create_general_sql . " with user_id: " . $_SESSION['user_id']);
        
        $create_general = pg_query_params($dbconn, $create_general_sql, array($_SESSION['user_id']));
        
        if ($create_general === false) {
            addDebug("Error creating general category: " . pg_last_error($dbconn));
            throw new Exception('Failed to create General category: ' . pg_last_error($dbconn));
        }
        $category_row = pg_fetch_assoc($create_general);
        addDebug("Created General category with ID: " . $category_row['category_id']);
    } else {
        $category_row = pg_fetch_assoc($check_general);
        addDebug("Found existing General category with ID: " . $category_row['category_id']);
    }

    // Ellenőrizzük, hogy már kedvenc-e ez a repo
    $check_favorite_sql = "SELECT favorite_id FROM favorite_repos WHERE user_id = $1 AND repo_id = $2";
    addDebug("Executing query: " . $check_favorite_sql . " with user_id: " . $_SESSION['user_id'] . " and repo_id: " . $repo_data['repo_id']);
    
    $check_favorite = pg_query_params($dbconn, $check_favorite_sql, array($_SESSION['user_id'], $repo_data['repo_id']));

    if ($check_favorite === false) {
        addDebug("Error checking favorite status: " . pg_last_error($dbconn));
        throw new Exception('Error checking favorite status');
    }

    if (pg_num_rows($check_favorite) > 0) {
        addDebug("Repository is already a favorite, removing...");
        $favorite_row = pg_fetch_assoc($check_favorite);
        
        // Először töröljük a statisztikákat
        $delete_stats_sql = "DELETE FROM repo_statistics WHERE favorite_id = $1";
        addDebug("Executing query: " . $delete_stats_sql . " with favorite_id: " . $favorite_row['favorite_id']);
        
        $delete_stats = pg_query_params($dbconn, $delete_stats_sql, array($favorite_row['favorite_id']));
        
        if ($delete_stats === false) {
            addDebug("Error deleting statistics: " . pg_last_error($dbconn));
            throw new Exception('Failed to delete statistics: ' . pg_last_error($dbconn));
        }
        
        // Majd töröljük a kedvencet
        $delete_favorite_sql = "DELETE FROM favorite_repos WHERE favorite_id = $1";
        addDebug("Executing query: " . $delete_favorite_sql . " with favorite_id: " . $favorite_row['favorite_id']);
        
        $delete_favorite = pg_query_params($dbconn, $delete_favorite_sql, array($favorite_row['favorite_id']));
        
        if ($delete_favorite === false) {
            addDebug("Error deleting favorite: " . pg_last_error($dbconn));
            throw new Exception('Failed to delete favorite: ' . pg_last_error($dbconn));
        }
        
        addDebug("Repository removed from favorites successfully");
        $response['message'] = 'Repository removed from favorites.';
    } else {
        addDebug("Adding new favorite...");
        // Ha még nem kedvenc, mentsük el
        $save_favorite_sql = "INSERT INTO favorite_repos 
            (user_id, repo_id, name, full_name, description, html_url, owner, owner_url, category_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING favorite_id";
        
        $params = array(
            $_SESSION['user_id'],
            $repo_data['repo_id'],
            $repo_data['name'],
            $repo_data['full_name'],
            $repo_data['description'],
            $repo_data['html_url'],
            $repo_data['owner'],
            $repo_data['owner_url'],
            $category_row['category_id']
        );
        
        addDebug("Executing query: " . $save_favorite_sql);
        addDebug("Parameters: " . print_r($params, true));
        
        $save_result = pg_query_params($dbconn, $save_favorite_sql, $params);
        
        if ($save_result === false) {
            addDebug("Error saving favorite: " . pg_last_error($dbconn));
            throw new Exception('Failed to save favorite: ' . pg_last_error($dbconn));
        }
        
        $favorite_row = pg_fetch_assoc($save_result);
        $favorite_id = $favorite_row['favorite_id'];
        addDebug("Favorite saved with ID: " . $favorite_id);
        
        // Statisztikák mentése
        $save_stats_sql = "INSERT INTO repo_statistics 
            (favorite_id, stars_count, forks_count, contributors_count, commits_count, languages) 
            VALUES ($1, $2, $3, $4, $5, $6)";
        
        $stats_params = array(
            $favorite_id,
            $repo_data['stars_count'],
            $repo_data['forks_count'],
            $repo_data['contributors_count'],
            $repo_data['commits_count'],
            json_encode($repo_data['languages'])
        );
        
        addDebug("Executing stats query: " . $save_stats_sql);
        addDebug("Stats parameters: " . print_r($stats_params, true));
        
        $save_stats_result = pg_query_params($dbconn, $save_stats_sql, $stats_params);
        
        if ($save_stats_result === false) {
            addDebug("Error saving statistics: " . pg_last_error($dbconn));
            throw new Exception('Failed to save statistics: ' . pg_last_error($dbconn));
        }
        
        addDebug("Repository added to favorites successfully");
        $response['message'] = 'Repository added to favorites successfully!';
    }

    // Commit a tranzakciót - paraméteres hívással az SQL injection ellen
    $commit_result = pg_query_params($dbconn, "COMMIT", array());
    if (!$commit_result) {
        addDebug("Failed to commit transaction: " . pg_last_error($dbconn));
        throw new Exception("Failed to commit transaction");
    }
    addDebug("Transaction committed successfully");
    $response['success'] = true;
    $response['debug']['session'] = $_SESSION;
    $response['debug']['post_data'] = file_get_contents('php://input');

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = 'Internal server error';
    addDebug("Error in add_favorite.php: " . $e->getMessage());
    error_log('Error in add_favorite.php: ' . $e->getMessage());
    if (isset($dbconn)) {
        $rollback_result = pg_query_params($dbconn, "ROLLBACK", array());
        if (!$rollback_result) {
            addDebug("Failed to rollback transaction: " . pg_last_error($dbconn));
        } else {
            addDebug("Transaction rolled back");
        }
    }
} finally {
    if (isset($dbconn)) {
        pg_close($dbconn);
        addDebug("Database connection closed");
    }
    ob_end_clean();
    echo json_encode($response);
}
?>
