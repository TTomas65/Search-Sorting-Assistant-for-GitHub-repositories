<?php
require_once 'security_headers.php'; // Biztonsági fejlécek beállítása
require_once 'session_config.php';

session_start();

// CORS fejlécek közvetlen beállítása
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// OPTIONS kérések kezelése (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header('HTTP/1.1 200 OK');
    exit();
}

$response = ['success' => false];

if (isset($_SESSION['github_token']) && !empty($_SESSION['github_token'])) {
    $response['success'] = true;
    $response['token'] = $_SESSION['github_token'];
}

header('Content-Type: application/json');
echo json_encode($response);
exit;
?>
