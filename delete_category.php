<?php
require_once 'security_headers.php'; 


// Hibaüzenetek megjelenítése
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Győződjünk meg róla, hogy semmilyen kimenet nem történt eddig
ob_start();

try {
    require_once 'config.php';
    require_once 'session_config.php';

    // Töröljük az eddigi kimenetet és beállítjuk a JSON fejlécet
    ob_clean();
    header('Content-Type: application/json');

    $response = ['success' => false, 'message' => ''];

    session_start();
    
    // Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
    if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
        throw new Exception('User not logged in');
    }

    if (!isset($_POST['category_id'])) {
        throw new Exception('Category ID is required');
    }

    $category_id = intval($_POST['category_id']);

    // Debug információ
    error_log("Trying to delete category: " . $category_id . " for user: " . $_SESSION['user_id']);

    // Kapcsolódás az adatbázishoz
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        throw new Exception('Database connection failed: ' . pg_last_error());
    }

    // Ellenőrizzük, hogy a kategória a felhasználóhoz tartozik-e
    $checkQuery = "SELECT category_id FROM user_categories WHERE category_id = $1 AND user_id = $2";
    $checkResult = pg_query_params($dbconn, $checkQuery, array($category_id, $_SESSION['user_id']));
    
    if (!$checkResult) {
        throw new Exception('Failed to check category: ' . pg_last_error());
    }

    if (pg_num_rows($checkResult) === 0) {
        // Debug információ
        error_log("Category not found: " . $category_id . " for user: " . $_SESSION['user_id']);
        throw new Exception('Category not found or access denied');
    }

    // Tranzakció kezdése - paraméteres hívással az SQL injection ellen
    pg_query_params($dbconn, "BEGIN", array());

    try {
        // Először keressük meg a General kategória ID-ját
        $generalQuery = "SELECT category_id FROM user_categories WHERE category_name = 'General' AND user_id = $1";
        $generalResult = pg_query_params($dbconn, $generalQuery, array($_SESSION['user_id']));
        
        if (!$generalResult || pg_num_rows($generalResult) === 0) {
            // Ha nincs még General kategória, hozzuk létre
            $createGeneralQuery = "INSERT INTO user_categories (user_id, category_name) VALUES ($1, 'General') RETURNING category_id";
            $createGeneralResult = pg_query_params($dbconn, $createGeneralQuery, array($_SESSION['user_id']));
            
            if (!$createGeneralResult) {
                throw new Exception('Failed to create General category: ' . pg_last_error());
            }
            
            $generalRow = pg_fetch_assoc($createGeneralResult);
            $generalCategoryId = $generalRow['category_id'];
        } else {
            $generalRow = pg_fetch_assoc($generalResult);
            $generalCategoryId = $generalRow['category_id'];
        }

        // Frissítjük a kedvenceket az új General kategóriára
        $updateQuery = "UPDATE favorite_repos SET category_id = $1 WHERE category_id = $2 AND user_id = $3";
        $updateResult = pg_query_params($dbconn, $updateQuery, array($generalCategoryId, $category_id, $_SESSION['user_id']));

        if (!$updateResult) {
            throw new Exception('Failed to update favorites: ' . pg_last_error());
        }

        // Majd töröljük a kategóriát
        $deleteQuery = "DELETE FROM user_categories WHERE category_id = $1 AND user_id = $2";
        $deleteResult = pg_query_params($dbconn, $deleteQuery, array($category_id, $_SESSION['user_id']));

        if (!$deleteResult) {
            throw new Exception('Failed to delete category: ' . pg_last_error());
        }

        // Tranzakció véglegesítése - paraméteres hívással az SQL injection ellen
        pg_query_params($dbconn, "COMMIT", array());
        
        $response['success'] = true;
        $response['message'] = 'Category deleted successfully, favorites moved to General category';

    } catch (Exception $e) {
        // Hiba esetén visszavonjuk a tranzakciót - paraméteres hívással az SQL injection ellen
        pg_query_params($dbconn, "ROLLBACK", array());
        throw $e;
    }

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    http_response_code(400);
    
    // Naplózás
    error_log("Error in delete_category.php: " . $e->getMessage());
} finally {
    // Kapcsolat lezárása ha létezik
    if (isset($dbconn)) {
        pg_close($dbconn);
    }
}

// Minden kimeneti puffer törlése a JSON válasz előtt
while (ob_get_level()) {
    ob_end_clean();
}

// Kimenet küldése
echo json_encode($response);
?>
