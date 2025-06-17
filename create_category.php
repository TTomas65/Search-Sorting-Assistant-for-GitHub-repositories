<?php
require_once 'security_headers.php'; 
// Hibaüzenetek megjelenítése
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Győződjünk meg róla, hogy semmilyen kimenet nem történt eddig
ob_start();

try {
    require_once 'config.php';
    require_once 'session_config.php';

    header('Content-Type: application/json');

    $response = ['success' => false, 'message' => '', 'category_id' => null];

    session_start();
    
    // Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
    if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
        throw new Exception('User not logged in');
    }

    // JSON adatok beolvasása
    $jsonData = file_get_contents('php://input');
    $data = json_decode($jsonData, true);

    if (!isset($data['category_name']) || empty(trim($data['category_name']))) {
        throw new Exception('Category name is required');
    }

    $categoryName = trim($data['category_name']);
    $repoId = isset($data['repo_id']) ? $data['repo_id'] : null;

    // Kapcsolódás az adatbázishoz
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        throw new Exception('Database connection failed: ' . pg_last_error());
    }

    // Tranzakció kezdése - paraméteres hívással az SQL injection ellen
    pg_query_params($dbconn, "BEGIN", array());

    try {
        // Ellenőrizzük, hogy létezik-e már ilyen kategória
        $checkQuery = "
            SELECT category_id 
            FROM user_categories 
            WHERE user_id = $1 AND LOWER(category_name) = LOWER($2)";
        
        $checkResult = pg_query_params($dbconn, $checkQuery, array($_SESSION['user_id'], $categoryName));
        
        if ($checkResult && pg_num_rows($checkResult) > 0) {
            throw new Exception('Category already exists');
        }

        // Új kategória létrehozása
        $insertQuery = "
            INSERT INTO user_categories (user_id, category_name, created_at)
            VALUES ($1, $2, NOW())
            RETURNING category_id";
        
        $result = pg_query_params($dbconn, $insertQuery, array($_SESSION['user_id'], $categoryName));
        
        if ($result === false) {
            throw new Exception('Failed to create category: ' . pg_last_error($dbconn));
        }

        $row = pg_fetch_assoc($result);
        $categoryId = $row['category_id'];
        
        // Ha van repo_id, akkor frissítjük a kedvenc kategóriáját
        if ($repoId) {
            $updateQuery = "
                UPDATE favorite_repos 
                SET category_id = $1 
                WHERE repo_id = $2 AND user_id = $3";
            
            $updateResult = pg_query_params($dbconn, $updateQuery, array($categoryId, $repoId, $_SESSION['user_id']));
            
            if ($updateResult === false) {
                throw new Exception('Failed to update repository category: ' . pg_last_error($dbconn));
            }
        }

        // Tranzakció véglegesítése - paraméteres hívással az SQL injection ellen
        pg_query_params($dbconn, "COMMIT", array());

        $response['success'] = true;
        $response['message'] = 'Category created successfully';
        $response['category_id'] = $categoryId;
        $response['category_name'] = $categoryName;

    } catch (Exception $e) {
        // Tranzakció visszavonása hiba esetén - paraméteres hívással az SQL injection ellen
        pg_query_params($dbconn, "ROLLBACK", array());
        throw $e;
    }

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
} finally {
    if (isset($dbconn)) {
        pg_close($dbconn);
    }
    
    // Kimeneti puffer törlése és válasz küldése
    ob_end_clean();
    echo json_encode($response);
}
