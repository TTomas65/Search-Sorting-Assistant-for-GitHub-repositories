<?php
require_once 'security_headers.php'; // Biztonsági fejlécek beállítása
require_once 'session_config.php';
session_start();
header('Content-Type: application/json');

$response = [
    'logged_in' => false,
    'username' => null,
    'github_user' => false,
    'github_avatar' => null,
    'github_token' => null
];

if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
    $response['logged_in'] = true;
    $response['username'] = $_SESSION['username'];
    
    // GitHub OAuth adatok hozzáadása, ha van
    if (isset($_SESSION['github_user']) && $_SESSION['github_user'] === true) {
        $response['github_user'] = true;
        
        if (isset($_SESSION['github_avatar'])) {
            $response['github_avatar'] = $_SESSION['github_avatar'];
        }
        
        if (isset($_SESSION['github_token'])) {
            $response['github_token'] = $_SESSION['github_token'];
        }
    }
}

echo json_encode($response);
?>
