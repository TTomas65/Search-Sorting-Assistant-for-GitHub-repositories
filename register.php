<?php
require_once 'security_headers.php'; // Biztonsági fejlécek beállítása
require_once 'session_config.php';
session_start();
header('Content-Type: application/json');

// CORS biztonságos beállítása - csak a saját domain engedélyezése
$allowed_origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

// Ellenőrizzük, hogy az origin a megengedett domain-ek között van-e
// Példa: saját domén és lokális fejlesztési környezet
$allowed_domains = [
    'https://githubsearch.tomorgraphic.com', // Csere a valódi doménre
    'http://localhost',
    'http://127.0.0.1',
    // További megbízható doméneket itt adhat hozzá
];

$origin_is_allowed = false;
foreach ($allowed_domains as $domain) {
    if (strpos($allowed_origin, $domain) === 0) {
        $origin_is_allowed = true;
        break;
    }
}

if ($origin_is_allowed) {
    // Csak a konkrét eredeti domain-t engedélyezzük, nem a wildcard (*) értéket
    header("Access-Control-Allow-Origin: $allowed_origin");
    header('Access-Control-Allow-Methods: POST');
    header('Access-Control-Allow-Headers: Content-Type');
    // Biztonsági okokból hozzáadjuk a Vary fejlécet is
    header('Vary: Origin');
} else {
    // Ha nem megengedett doménről jön a kérés, nem engedünk CORS hozzáférést
    // Nem állítjuk be az Access-Control-Allow-Origin fejlécet
    // Naplózzuk a gyanús kérést
    error_log("CORS blocked request from unauthorized origin: $allowed_origin");
}

require_once 'error_log.php';

// Log that someone tried to use the legacy registration
logError('Legacy registration attempt', 'Redirecting to GitHub login');

// Return an error message informing that only GitHub login is now supported
$response = [
    'success' => false,
    'message' => 'Standard registration is no longer supported. Please use Sign in with GitHub.',
    'redirect_to_github' => true,
    'github_login_url' => 'github_login.php'
];

echo json_encode($response);
?>
