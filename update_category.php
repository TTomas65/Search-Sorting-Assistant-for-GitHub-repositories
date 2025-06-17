<?php
// Hibaüzenetek megjelenítése
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Győződjünk meg róla, hogy semmilyen kimenet nem történt eddig
ob_start();

try {
    require_once 'config.php';
    require_once 'session_config.php';

    session_start();
    header('Content-Type: application/json');

    $response = ['success' => false];

    // Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
    if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
        throw new Exception('User not logged in');
    }

    // JSON adatok beolvasása
    $jsonData = file_get_contents('php://input');
    $data = json_decode($jsonData, true);

    if (!isset($data['repo_id']) || !isset($data['category_id'])) {
        throw new Exception('Missing parameters');
    }

    // Kapcsolódás az adatbázishoz
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        throw new Exception('Database connection failed: ' . pg_last_error());
    }

    // Kategória frissítése
    $updateQuery = "
        UPDATE favorite_repos 
        SET category_id = $1
        WHERE user_id = $2 AND repo_id = $3
    ";
    
    $result = pg_query_params($dbconn, $updateQuery, [
        $data['category_id'],
        $_SESSION['user_id'],
        $data['repo_id']
    ]);

    if (!$result) {
        throw new Exception(pg_last_error($dbconn));
    }

    $response['success'] = true;

} catch (Exception $e) {
    $response['error'] = $e->getMessage();
} finally {
    if (isset($dbconn)) {
        pg_close($dbconn);
    }
    
    // Kimeneti puffer törlése és válasz küldése
    ob_end_clean();
    echo json_encode($response);
}
