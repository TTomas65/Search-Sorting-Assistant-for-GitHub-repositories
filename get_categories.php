<?php
require_once 'security_headers.php'; 
// Hibaüzenetek megjelenítése helyett naplózása
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

    $response = ['success' => false, 'categories' => [], 'message' => ''];

    session_start();
    
    // Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
    if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
        throw new Exception('User not logged in');
    }
    
    // Kapcsolódás az adatbázishoz
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        throw new Exception('Database connection failed: ' . pg_last_error());
    }

    // Kategóriák lekérdezése
    $query = "
        SELECT category_id, category_name
        FROM user_categories
        WHERE user_id = $1
        ORDER BY category_name";
    
    $result = pg_query_params($dbconn, $query, array($_SESSION['user_id']));
    
    if ($result === false) {
        throw new Exception('Failed to fetch categories: ' . pg_last_error($dbconn));
    }

    while ($row = pg_fetch_assoc($result)) {
        $category = [
            'id' => intval($row['category_id']),
            'name' => $row['category_name']
        ];
        $response['categories'][] = $category;
    }

    $response['success'] = true;
    $response['message'] = 'Categories retrieved successfully';

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
} finally {
    if (isset($dbconn)) {
        pg_close($dbconn);
    }
    
    // Kimeneti puffer tartalmának törlése
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    // Content-Type header beállítása a tiszta válasz előtt
    header('Content-Type: application/json');
    // Győződjünk meg róla, hogy nincs kimenet a JSON előtt
    echo json_encode($response);
}
