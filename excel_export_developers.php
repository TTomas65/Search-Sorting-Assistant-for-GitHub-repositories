<?php
require_once 'security_headers.php'; 
/**
 * GitHub Favorite Developers Excel Export - Backend
 * 
 * Ez a szkript lekéri a felhasználó kedvenc fejlesztőit alapvető adatokkal.
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
    
    // Kedvenc fejlesztők lekérése
    $developersQuery = "
        SELECT 
            fd.developer_id,
            fd.user_id,
            fd.github_id,
            fd.login,
            fd.name,
            fd.html_url,
            fd.notes
        FROM favorite_developers fd
        WHERE fd.user_id = $1
        ORDER BY fd.login ASC";
    
    $developersResult = pg_query_params($dbconn, $developersQuery, array($_SESSION['user_id']));
    
    if ($developersResult === false) {
        $error = pg_last_error($dbconn);
        throw new Exception('Failed to fetch favorite developers: ' . $error);
    }
    
    // Adatok gyűjtése
    $favorite_developers = [];
    
    while ($row = pg_fetch_assoc($developersResult)) {
        // Fejlesztő alapadatok összeállítása
        $developer_data = [
            'developer_id' => $row['developer_id'],
            'user_id' => $row['user_id'],
            'github_id' => $row['github_id'],
            'login' => $row['login'],
            'name' => $row['name'],
            'html_url' => $row['html_url'],
            'notes' => $row['notes']
        ];
        
        $favorite_developers[] = $developer_data;
    }

    // Információ naplózása
    addDebug("Successfully fetched " . count($favorite_developers) . " favorite developers");

    $response['success'] = true;
    $response['data'] = $favorite_developers;
    $response['message'] = 'Favorite developers retrieved successfully';

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
