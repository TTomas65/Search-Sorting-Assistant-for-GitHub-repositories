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

    header('Content-Type: application/json');

    $response = ['success' => false, 'message' => ''];

    session_start();
    
    // Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
    if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
        throw new Exception('User not logged in');
    }

    // JSON adatok beolvasása
    $jsonData = file_get_contents('php://input');
    $data = json_decode($jsonData, true);

    if (!isset($data['category_id']) || empty($data['category_id'])) {
        throw new Exception('Category ID is required');
    }

    if (!isset($data['new_category_name']) || empty(trim($data['new_category_name']))) {
        throw new Exception('New category name is required');
    }

    $categoryId = $data['category_id'];
    $newCategoryName = trim($data['new_category_name']);

    // Kapcsolódás az adatbázishoz
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        throw new Exception('Database connection failed: ' . pg_last_error());
    }

    // Tranzakció kezdése
    pg_query($dbconn, "BEGIN");

    try {
        // Ellenőrizzük, hogy létezik-e már ilyen kategória
        $checkQuery = "
            SELECT category_id 
            FROM user_categories 
            WHERE user_id = $1 AND LOWER(category_name) = LOWER($2) AND category_id != $3";
        
        $checkResult = pg_query_params($dbconn, $checkQuery, array($_SESSION['user_id'], $newCategoryName, $categoryId));
        
        if ($checkResult && pg_num_rows($checkResult) > 0) {
            throw new Exception('Category name already exists');
        }

        // Ellenőrizzük, hogy a kategória a felhasználóhoz tartozik-e
        $ownerCheckQuery = "
            SELECT category_id 
            FROM user_categories 
            WHERE user_id = $1 AND category_id = $2";
        
        $ownerCheckResult = pg_query_params($dbconn, $ownerCheckQuery, array($_SESSION['user_id'], $categoryId));
        
        if (!$ownerCheckResult || pg_num_rows($ownerCheckResult) === 0) {
            throw new Exception('Category not found or does not belong to the user');
        }

        // Kategória nevének módosítása
        $updateQuery = "
            UPDATE user_categories 
            SET category_name = $1
            WHERE category_id = $2 AND user_id = $3
            RETURNING category_id, category_name";
        
        $result = pg_query_params($dbconn, $updateQuery, array($newCategoryName, $categoryId, $_SESSION['user_id']));
        
        if ($result === false) {
            throw new Exception('Failed to update category: ' . pg_last_error($dbconn));
        }

        if (pg_num_rows($result) === 0) {
            throw new Exception('Category not found or not updated');
        }

        $row = pg_fetch_assoc($result);

        // Tranzakció véglegesítése
        pg_query($dbconn, "COMMIT");

        $response['success'] = true;
        $response['message'] = 'Category modified successfully';
        $response['category_id'] = $row['category_id'];
        $response['category_name'] = $row['category_name'];

    } catch (Exception $e) {
        // Tranzakció visszavonása hiba esetén
        pg_query($dbconn, "ROLLBACK");
        throw $e;
    }

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
} finally {
    // Kapcsolat lezárása
    if (isset($dbconn) && $dbconn) {
        pg_close($dbconn);
    }
    
    // Kimenet törlése és JSON válasz küldése
    ob_end_clean();
    echo json_encode($response);
}
?>
