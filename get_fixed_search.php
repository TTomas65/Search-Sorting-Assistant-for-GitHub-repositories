<?php
require_once 'security_headers.php'; 
// Hibajelentés bekapcsolása fejlesztéshez
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Session indítása a felhasználó azonosításához
session_start();

// Konfigurációs fájl betöltése
require_once('config.php');

// Válasz fejléc beállítása
header('Content-Type: application/json');

// Naplózás beállítása
$log_file = 'fixedsearch_get_log.txt';

try {
    // Felhasználó azonosítása
    $user_id = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;
    
    if (!$user_id) {
        // Ha nincs bejelentkezett felhasználó, üres listát adunk vissza
        echo json_encode(['status' => 'success', 'terms' => []]);
        exit;
    }
    
    // Adatbázis kapcsolat létrehozása
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        throw new Exception("Database connection error");
    }
    
    // Tábla létezésének ellenőrzése
    $table_check_query = "SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'fixedsearch'
    )";
    
    $table_check_result = pg_query($dbconn, $table_check_query);
    
    if (!$table_check_result) {
        throw new Exception("Query error during table check");
    }
    
    $table_exists = pg_fetch_result($table_check_result, 0, 0);
    
    if ($table_exists !== 't') {
        // Ha a tábla nem létezik, üres listát adunk vissza
        echo json_encode(['status' => 'success', 'terms' => []]);
        exit;
    }
    
    // Keresési kifejezések lekérdezése
    $query = "SELECT search_term FROM fixedsearch WHERE user_id = $1 ORDER BY search_id";
    $result = pg_query_params($dbconn, $query, [$user_id]);
    
    if (!$result) {
        throw new Exception("Query error during search term retrieval");
    }
    
    // Eredmények összegyűjtése
    $terms = [];
    while ($row = pg_fetch_assoc($result)) {
        $terms[] = $row['search_term'];
    }
    
    // Sikeres válasz
    echo json_encode(['status' => 'success', 'terms' => $terms]);
    
} catch (Exception $e) {
    // Hiba esetén naplózás és hibaüzenet küldése
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Hiba: " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
