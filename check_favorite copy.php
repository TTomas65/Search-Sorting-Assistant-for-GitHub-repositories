<?php
require_once 'security_headers.php'; 
require_once 'config.php';
require_once 'session_config.php';
require_once 'error_log.php';

session_start();
header('Content-Type: application/json');

// Debug log
error_log("Starting check_favorite.php");

$response = ['success' => false, 'isFavorite' => false, 'message' => ''];

// Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
    $response['message'] = 'User not logged in';
    echo json_encode($response);
    exit;
}

// Debug log
error_log("User is logged in: " . $_SESSION['user_id']);

// Ellenőrizzük, hogy megkaptuk-e a repo_id-t
$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['repo_id'])) {
    $response['message'] = 'Repository ID is missing';
    error_log("Repository ID is missing from request");
    echo json_encode($response);
    exit;
}

try {
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        throw new Exception('Database connection failed: ' . pg_last_error());
    }

    // Debug log
    error_log("Database connection successful");

    // Ellenőrizzük, hogy a repo már kedvenc-e
    $check_favorite = pg_query_params($dbconn,
        "SELECT favorite_id FROM favorite_repos 
         WHERE user_id = $1 AND repo_id = $2",
        array($_SESSION['user_id'], $data['repo_id'])
    );

    if ($check_favorite === false) {
        throw new Exception('Failed to check favorite status: ' . pg_last_error($dbconn));
    }

    $response['success'] = true;
    $response['isFavorite'] = pg_num_rows($check_favorite) > 0;
    
    error_log("Check favorite result: " . ($response['isFavorite'] ? 'true' : 'false'));

} catch (Exception $e) {
    error_log("Error in check_favorite.php: " . $e->getMessage());
    $response['message'] = $e->getMessage();
    logError('Check favorite error', $e->getMessage());
} finally {
    if (isset($dbconn)) {
        pg_close($dbconn);
    }
}

echo json_encode($response);
?>
