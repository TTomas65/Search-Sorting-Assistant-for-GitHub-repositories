<?php
// Hibaüzenetek megjelenítése
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Győződjünk meg róla, hogy semmilyen kimenet nem történt eddig
ob_start();

require_once 'config.php';
require_once 'session_config.php';

// Debug log
error_log("Received request to update notes");

header('Content-Type: application/json');

$response = ['success' => false, 'message' => ''];

try {
    // Session ellenőrzése
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        error_log("User not logged in. Session data: " . print_r($_SESSION, true));
        throw new Exception('User not logged in');
    }

    // JSON adatok beolvasása
    $input = file_get_contents('php://input');
    error_log("Received input: " . $input);
    
    $data = json_decode($input, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input: ' . json_last_error_msg());
    }
    
    if (!isset($data['repo_id']) || !isset($data['notes'])) {
        throw new Exception('Missing required parameters');
    }

    $repo_id = intval($data['repo_id']);
    $notes = $data['notes'];
    $user_id = $_SESSION['user_id'];

    error_log("Processing update for repo_id: $repo_id, user_id: $user_id");

    // Adatbázis kapcsolat létrehozása
    $dbconn = pg_connect("host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD);
    
    if (!$dbconn) {
        throw new Exception('Could not connect to the database');
    }

    // Ellenőrizzük, hogy a repository a felhasználóhoz tartozik-e
    $check_query = "SELECT favorite_id FROM favorite_repos WHERE repo_id = $1 AND user_id = $2";
    $check_result = pg_query_params($dbconn, $check_query, array($repo_id, $user_id));
    
    if (pg_num_rows($check_result) === 0) {
        throw new Exception('Repository not found or not owned by user');
    }

    // Megjegyzés frissítése
    $query = "UPDATE favorite_repos 
              SET individual_notes = $1 
              WHERE repo_id = $2 AND user_id = $3";
    
    $result = pg_query_params($dbconn, $query, array($notes, $repo_id, $user_id));
    
    if ($result === false) {
        throw new Exception('Failed to update notes: ' . pg_last_error($dbconn));
    }

    $response['success'] = true;
    $response['message'] = 'Notes updated successfully';
    error_log("Notes updated successfully");

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    error_log("Error updating notes: " . $e->getMessage());
} finally {
    if (isset($dbconn)) {
        pg_close($dbconn);
    }
}

// Töröljük az esetleges korábbi kimenetet
ob_end_clean();

// Küldjük el a JSON választ
echo json_encode($response);
exit;
