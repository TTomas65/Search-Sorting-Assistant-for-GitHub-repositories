<?php
// Initialize GitHub OAuth login process
require_once 'security_headers.php'; // Biztonsági fejlécek beállítása
require_once 'session_config.php';
require_once 'github_oauth_config.php';
require_once 'error_log.php';

session_start();

// Generate a unique "state" token to prevent CSRF attacks
// Kriptográfiailag biztonságos véletlenszám-generálás
function secure_random_bytes_compat($length = 16) {
    // PHP 7+ natív megoldás (preferencia)
    if (function_exists('random_bytes')) {
        try {
            return random_bytes($length);
        } catch (Exception $e) {
            // Hiba esetén tovább lépünk a következő módszerre
            error_log('random_bytes() error: ' . $e->getMessage());
        }
    }
    
    // OpenSSL módszer (második preferencia)
    if (function_exists('openssl_random_pseudo_bytes')) {
        $strong = false;
        $bytes = openssl_random_pseudo_bytes($length, $strong);
        
        // Csak akkor fogadjuk el, ha az erős flag igaz
        if ($bytes !== false && $strong === true) {
            return $bytes;
        }
        
        error_log('openssl_random_pseudo_bytes() did not return cryptographically strong bytes');
    }
    
    // Végső eset: ha nincs biztonságos RNG, hiba
    throw new Exception('No cryptographically secure random number generator available on this system. ' .
                        'Please upgrade PHP to 7.0+ or enable the OpenSSL extension.');
}

$state = bin2hex(secure_random_bytes_compat(16));

// Save state to session
$_SESSION['oauth_state'] = $state;

// Optional: If the user wants to return to a specific page, we can save that too
if (isset($_GET['redirect_uri'])) {
    $_SESSION['oauth_redirect'] = $_GET['redirect_uri'];
} else {
    $_SESSION['oauth_redirect'] = '/index.html'; // Default redirect path
}

logError('GitHub OAuth login', 'Initiating GitHub OAuth login, state: ' . $state);

// Build the authorization URL
$auth_url = GITHUB_OAUTH_URL . '?' . http_build_query([
    'client_id' => GITHUB_CLIENT_ID,
    'redirect_uri' => GITHUB_REDIRECT_URI,
    'scope' => GITHUB_SCOPE,
    'state' => $state,
    'allow_signup' => 'true' // Allow registration if the user doesn't have a GitHub account yet
]);

// Redirect to GitHub authorization page
header('Location: ' . $auth_url);
exit;
?>
