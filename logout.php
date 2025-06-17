<?php
require_once 'security_headers.php'; // Biztonsági fejlécek beállítása
require_once 'session_config.php';
require_once 'error_log.php';
session_start();

$response = ['success' => false, 'message' => ''];

try {
    // Naplózás a kijelentkezésről
    $username = isset($_SESSION['username']) ? $_SESSION['username'] : 'unknown';
    $isOAuth = isset($_SESSION['github_user']) && $_SESSION['github_user'] === true;
    
    if ($isOAuth) {
        logError('GitHub OAuth logout', "GitHub OAuth user logged out: {$username}");
    } else {
        logError('User logout', "User logged out: {$username}");
    }
    
    // Session törlése
    session_destroy();
    
    // Session cookie törlése
    if (isset($_COOKIE[session_name()])) {
        setcookie(session_name(), '', time() - 3600, '/');
    }
    
    $response['success'] = true;
    $response['message'] = 'Logged out successfully';
    
} catch (Exception $e) {
    $response['message'] = 'Error during logout: ' . $e->getMessage();
    logError('Logout error', $e->getMessage());
}

echo json_encode($response);
?>
