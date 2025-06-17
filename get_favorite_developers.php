<?php
require_once 'security_headers.php'; 
require_once 'config.php';
require_once 'session_config.php';

header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'developers' => [], 'message' => ''];

// Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
    $response['message'] = 'User not logged in';
    echo json_encode($response);
    exit;
}

try {
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $db = new PDO("pgsql:".$connection_string);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Lekérjük a felhasználó kedvenc fejlesztőit
    $stmt = $db->prepare("SELECT github_id, login, notes FROM favorite_developers WHERE user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    
    $response['developers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $response['success'] = true;

} catch (PDOException $e) {
    $response['message'] = 'Database error occurred';
    error_log('Database error in get_favorite_developers.php: ' . $e->getMessage());
} catch (Exception $e) {
    $response['message'] = 'Internal server error';
    error_log('Error in get_favorite_developers.php: ' . $e->getMessage());
}

echo json_encode($response);
?>
