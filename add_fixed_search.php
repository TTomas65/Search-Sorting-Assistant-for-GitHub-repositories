<?php
// Minden kimenetet puffereljünk, hogy csak a JSON válasz kerüljön kiküldésre
ob_start();

// Hibajelentés bekapcsolása fejlesztéshez, de csak a naplóba
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Konfigurációs fájl betöltése
require_once 'config.php';
require_once 'session_config.php';

// Naplózás beállítása
$log_file = 'fixedsearch_log.txt';

// Válasz objektum létrehozása
$response = ['status' => 'error', 'message' => ''];

// Naplózási funkció
function addDebug($message) {
    error_log($message);
    file_put_contents('fixedsearch_log.txt', date('Y-m-d H:i:s') . " - " . $message . "\n", FILE_APPEND);
}

// Session indítása a felhasználó azonosításához
session_start();
addDebug("Session started. Session data: " . print_r($_SESSION, true));

// Válasz fejléc beállítása
header('Content-Type: application/json');

try {
    // Bejövő JSON adat feldolgozása
    $json_data = file_get_contents('php://input');
    $data = json_decode($json_data, true);
    
    if (!$data || !isset($data['term'])) {
        throw new Exception("Missing search term");
    }
    
    $search_term = trim($data['term']);
    
    // Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
    if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
        addDebug("No user logged in. Session: " . print_r($_SESSION, true));
        throw new Exception("No user logged in. Please log in to use this feature.");
    }
    
    addDebug("User logged in with ID: " . $_SESSION['user_id']);
    
    // Felhasználó ID kiolvasása a session-ből
    $user_id = (int)$_SESSION['user_id'];
    
    // Ellenőrizzük, hogy érvényes-e a felhasználó ID
    if ($user_id <= 0) {
        addDebug("Invalid user ID: {$user_id}");
        throw new Exception("Invalid user ID. Please log in again.");
    }
    
    // Adatbázis kapcsolat létrehozása
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    
    // Kapcsolódás az adatbázishoz, hiba esetén tiszta JSON válasz
    $dbconn = @pg_connect($connection_string);
    
    if (!$dbconn) {
        throw new Exception("Database connection error: " . pg_last_error());
    }
    
    // Ellenőrizzük, hogy a kifejezés már létezik-e a felhasználóhoz
    $check_query = "SELECT COUNT(*) FROM fixedsearch WHERE user_id = $1 AND search_term = $2";
    $check_result = pg_query_params($dbconn, $check_query, [$user_id, $search_term]);
    
    if (!$check_result) {
        throw new Exception("Query error during check");
    }
    
    $exists = (int)pg_fetch_result($check_result, 0, 0);
    
    if ($exists > 0) {
        // A kifejezés már létezik, nem kell újra hozzáadni
        echo json_encode(['status' => 'success', 'message' => 'The term already exists']);
        exit;
    }
    
    // Beszúrás a fixedsearch táblába
    $insert_query = "INSERT INTO fixedsearch (user_id, search_term) VALUES ($1, $2)";
    $insert_result = pg_query_params($dbconn, $insert_query, [$user_id, $search_term]);
    
    if (!$insert_result) {
        throw new Exception("An error occurred when saving the search term");
    }
    
    // Sikeres válasz
    echo json_encode(['status' => 'success', 'message' => 'Search term saved successfully']);
    
} catch (Exception $e) {
    // Hiba esetén naplózás és hibaüzenet küldése
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Hiba: " . $e->getMessage() . "\n", FILE_APPEND);
    
    // Töröljük a pufferelt kimenetet, hogy csak a JSON válasz kerüljön kiküldésre
    ob_end_clean();
    
    // Hibaüzenetet küldünk JSON formátumban
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
} finally {
    // Ha még van pufferelt kimenet, akkor töröljük
    if (ob_get_level() > 0) {
        ob_end_flush();
    }
}
?>
