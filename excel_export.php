<?php
require_once 'security_headers.php'; 
/**
 * GitHub Repository Excel Export - Backend
 * 
 * Ez a szkript lekéri a felhasználó kedvenc repository-jait alapvető adatokkal.
 * A JavaScript oldal fogja letölteni a további adatokat a GitHub API-n keresztül.
 */

// Hibaüzenetek naplózása képernyőre írás helyett
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Győződjünk meg róla, hogy semmilyen kimenet nem történt eddig
if (ob_get_level() === 0) {
    ob_start();
}

try {
    require_once 'config.php';
    require_once 'session_config.php';

    $response = ['success' => false, 'data' => [], 'message' => '', 'debug' => [], 'export_date' => date('Y.m.d')];

    function addDebug($message) {
        global $response;
        $response['debug'][] = $message;
        error_log($message);
    }

    session_start();
    addDebug("Session started. Session data: " . print_r($_SESSION, true));
    
    // Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
    if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
        throw new Exception('User not logged in');
    }

    addDebug("User logged in with ID: " . $_SESSION['user_id']);
    
    // Kapcsolódás az adatbázishoz
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    addDebug("Attempting database connection...");
    
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        $error = pg_last_error();
        throw new Exception('Database connection failed: ' . $error);
    }

    addDebug("Database connection successful");
    
    // Kedvencek lekérése kategória szerint csoportosítva, bővebb adatokkal
    $favoritesQuery = "
        SELECT 
            fr.repo_id as repository_id, 
            uc.category_name, 
            fr.individual_notes as user_comment,
            fr.name,
            fr.full_name,
            fr.owner,
            fr.html_url,
            fr.description,
            fr.owner_url
        FROM favorite_repos fr
        LEFT JOIN user_categories uc ON fr.category_id = uc.category_id
        WHERE fr.user_id = $1
        ORDER BY uc.category_name ASC";
    
    $favoritesResult = pg_query_params($dbconn, $favoritesQuery, array($_SESSION['user_id']));
    
    if ($favoritesResult === false) {
        $error = pg_last_error($dbconn);
        throw new Exception('Failed to fetch favorites: ' . $error);
    }
    
    // Adatok gyűjtése a kategóriák szerinti csoportosításhoz
    $categorized_repos = [];
    
    while ($row = pg_fetch_assoc($favoritesResult)) {
        $category = $row['category_name'] ? $row['category_name'] : 'Egyéb';
        
        // Repositori alapadatok összeállítása
        $repo_data = [
            'repository_id' => $row['repository_id'],
            'developer' => $row['owner'],
            'repository_name' => $row['name'],
            'full_name' => $row['full_name'],
            'url' => $row['html_url'],
            'user_comment' => $row['user_comment'],
            'description' => $row['description'],
            'owner_url' => $row['owner_url']
        ];
        
        // Kategória szerint csoportosítás
        if (!isset($categorized_repos[$category])) {
            $categorized_repos[$category] = [];
        }
        
        $categorized_repos[$category][] = $repo_data;
    }

    // A további adatokat a JavaScript oldal fogja letölteni
    // a GitHub API-n keresztül, a token a böngészőből lesz elérhető
    
    // Információ naplózása
    addDebug("Successfully fetched " . count($categorized_repos) . " categories");
    $total_repos = 0;
    foreach ($categorized_repos as $category => $repos) {
        $total_repos += count($repos);
        addDebug("Category '$category' has " . count($repos) . " repositories");
    }
    addDebug("Total repositories found: $total_repos");


    $response['success'] = true;
    $response['data'] = $categorized_repos;
    $response['message'] = 'Repositories retrieved successfully';

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    $response['debug'][] = "Error: " . $e->getMessage();
    if (isset($e->getTrace()[0])) {
        $response['debug'][] = "Error location: " . print_r($e->getTrace()[0], true);
    }
} finally {
    if (isset($dbconn)) {
        pg_close($dbconn);
        addDebug("Database connection closed");
    }
}

// Kimeneti puffer tartalmának teljes törlése
while (ob_get_level() > 0) {
    ob_end_clean();
}

// Content-Type header beállítása közvetlenül a válasz küldése előtt
header('Content-Type: application/json');
echo json_encode($response);
exit;
