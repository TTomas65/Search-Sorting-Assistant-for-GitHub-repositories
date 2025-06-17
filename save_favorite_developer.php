<?php
require_once 'config.php';
require_once 'session_config.php';
require_once 'error_log.php';

// Kikapcsoljuk a HTML error megjelenítést
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

session_start();

// Töröljük a korábbi outputokat
ob_clean();
header('Content-Type: application/json');

$response = ['success' => false, 'message' => '', 'debug' => []];

function addDebug($message) {
    global $response;
    $response['debug'][] = $message;
    error_log($message);
}

// Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
    $response['message'] = 'This feature is only available for registered users.';
    addDebug("User not logged in. Session: " . print_r($_SESSION, true));
    ob_end_clean();
    echo json_encode($response);
    exit;
}

addDebug("User is logged in: " . $_SESSION['user_id']);

// Ellenőrizzük, hogy kaptunk-e owner paramétert
if (!isset($_POST['owner'])) {
    $response['message'] = 'Missing developer identifier!';
    addDebug("Missing owner parameter in POST data: " . print_r($_POST, true));
    ob_end_clean();
    echo json_encode($response);
    exit;
}

addDebug("Owner parameter received: " . $_POST['owner']);

try {
    // Adatbázis kapcsolat létrehozása
    addDebug("Connecting to database...");
    addDebug("Connection string: host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER);
    
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    $db = new PDO("pgsql:".$connection_string);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    addDebug("Database connection established");

    // GitHub API hívás a fejlesztő adatainak lekéréséhez
    $owner = $_POST['owner'];
    $api_url = "https://api.github.com/users/" . urlencode($owner);
    addDebug("GitHub API URL: " . $api_url);

    $ch = curl_init($api_url);
    
    $headers = [
        'User-Agent: GitHub-Search-App',
        'Accept: application/vnd.github.v3+json'
    ];

    if (isset($_SESSION['github_token'])) {
        $headers[] = "Authorization: Bearer " . $_SESSION['github_token'];
        addDebug("Using GitHub token for API request");
    }
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_USERAGENT => 'GitHub-Search-App',
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    addDebug("Sending GitHub API request with headers: " . print_r($headers, true));
    $response_data = curl_exec($ch);
    
    if (curl_errno($ch)) {
        throw new Exception("GitHub API request failed: " . curl_error($ch));
    }
    
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    addDebug("GitHub API response code: " . $http_code);
    addDebug("GitHub API raw response: " . $response_data);
    
    curl_close($ch);
    
    $developer_data = json_decode($response_data, true);
    if (!$developer_data) {
        throw new Exception("Failed to parse GitHub API response: " . json_last_error_msg());
    }
    
    if (isset($developer_data['message'])) {
        throw new Exception("GitHub API error: " . $developer_data['message']);
    }
    
    if (!isset($developer_data['id'])) {
        throw new Exception("Invalid GitHub API response: missing user ID");
    }
    
    addDebug("GitHub API data fetched successfully for user: " . $owner);
    addDebug("GitHub user data: " . print_r($developer_data, true));

    // Ellenőrizzük, hogy a fejlesztő már szerepel-e a kedvencek között
    $check_stmt = $db->prepare("SELECT developer_id FROM favorite_developers WHERE user_id = ? AND github_id = ?");
    $check_stmt->execute([$_SESSION['user_id'], $developer_data['id']]);
    
    if ($check_stmt->fetch()) {
        $response['message'] = 'This developer is already in your favorites!';
        addDebug("Developer already exists in favorites for user: " . $_SESSION['user_id']);
        ob_end_clean();
        echo json_encode($response);
        exit;
    }

    // Fejlesztő mentése az adatbázisba
    $insert_stmt = $db->prepare("
        INSERT INTO favorite_developers (
            user_id, github_id, login, name, avatar_url, html_url, 
            bio, company, location, email, public_repos, 
            followers, following, created_at, last_updated
        ) VALUES (
            ?, ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?,
            ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    ");

    $insert_stmt->execute([
        $_SESSION['user_id'],
        $developer_data['id'],
        $developer_data['login'],
        $developer_data['name'],
        $developer_data['avatar_url'],
        $developer_data['html_url'],
        $developer_data['bio'],
        $developer_data['company'],
        $developer_data['location'],
        $developer_data['email'],
        $developer_data['public_repos'],
        $developer_data['followers'],
        $developer_data['following']
    ]);
    addDebug("Developer successfully saved to database with github_id: " . $developer_data['id']);

    $response['success'] = true;

} catch (PDOException $e) {
    http_response_code(500);
    $response['message'] = 'Database error occurred';
    addDebug("Database error in save_favorite_developer.php: " . $e->getMessage());
    error_log('Database error in save_favorite_developer.php: ' . $e->getMessage());
} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = 'Internal server error';
    addDebug("Error in save_favorite_developer.php: " . $e->getMessage());
    error_log('Error in save_favorite_developer.php: ' . $e->getMessage());
}

ob_end_clean();
echo json_encode($response);
?>
