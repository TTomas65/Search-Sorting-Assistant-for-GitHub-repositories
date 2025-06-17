<?php
require_once 'security_headers.php'; 
// Hibaüzenetek naplózása képernyőre írás helyett
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Győződjünk meg róla, hogy semmilyen kimenet nem történt eddig
if (ob_get_level() === 0) {
    ob_start();
}

try {
    require_once 'config.php';
    require_once 'session_config.php';

    $response = ['success' => false, 'favorites' => [], 'message' => '', 'debug' => [], 'total_count' => 0];

    function addDebug($message) {
        global $response;
        $response['debug'][] = $message;
        error_log($message);
    }

    session_start();
    addDebug("Session started. Session data: " . print_r($_SESSION, true));
    
    // Ellenőrizzük, hogy a felhasználó be van-e jelentkezve
    if (!isset($_SESSION['user_id']) || !$_SESSION['logged_in']) {
        throw new Exception('User not logged in');
    }

    addDebug("User logged in with ID: " . $_SESSION['user_id']);
    
    // Kapcsolódás az adatbázishoz
    $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
    addDebug("Attempting database connection...");
    
    $dbconn = pg_connect($connection_string);
    
    if (!$dbconn) {
        $error = pg_last_error();
        throw new Exception('Database connection failed: ' . $error);
    }

    addDebug("Database connection successful");

    // Get category filter from request
    $category = isset($_GET['category']) ? $_GET['category'] : 'all';
    
    // Get pagination parameters
    $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
    $offset = ($page - 1) * $limit;
    
    addDebug("Category filter: " . $category . ", Page: " . $page . ", Limit: " . $limit);

    // First, get total count of favorites
    $countQuery = "
        SELECT COUNT(*) as total
        FROM favorite_repos fr
        LEFT JOIN user_categories uc ON fr.category_id = uc.category_id
        WHERE fr.user_id = $1";
    
    $countParams = array($_SESSION['user_id']);
    
    // Add category filter if not 'all'
    if ($category !== 'all') {
        $countQuery .= " AND uc.category_name = $2";
        $countParams[] = $category;
    }
    
    $countResult = pg_query_params($dbconn, $countQuery, $countParams);
    
    if ($countResult === false) {
        $error = pg_last_error($dbconn);
        throw new Exception('Failed to count favorites: ' . $error);
    }
    
    $countRow = pg_fetch_assoc($countResult);
    $totalFavorites = intval($countRow['total']);
    $response['total_count'] = $totalFavorites;
    
    addDebug("Total favorites count: " . $totalFavorites);
    
    // Kedvencek lekérdezése a statisztikákkal és kategória nevekkel együtt
    $query = "
        SELECT fr.*, rs.stars_count, rs.forks_count, rs.languages, uc.category_name, fr.individual_notes
        FROM favorite_repos fr
        LEFT JOIN repo_statistics rs ON fr.favorite_id = rs.favorite_id
        LEFT JOIN user_categories uc ON fr.category_id = uc.category_id
        WHERE fr.user_id = $1";
    
    $params = array($_SESSION['user_id']);
    
    // Add category filter if not 'all'
    if ($category !== 'all') {
        $query .= " AND uc.category_name = $2";
        $params[] = $category;
    }
    
    $query .= " ORDER BY fr.name";
    
    // Add pagination
    $query .= " LIMIT $" . (count($params) + 1) . " OFFSET $" . (count($params) + 2);
    $params[] = $limit;
    $params[] = $offset;
    
    addDebug("Executing query for user_id: " . $_SESSION['user_id'] . " with limit: " . $limit . " and offset: " . $offset);
    
    $result = pg_query_params($dbconn, $query, $params);
    
    if ($result === false) {
        $error = pg_last_error($dbconn);
        throw new Exception('Failed to fetch favorites: ' . $error);
    }

    addDebug("Query executed successfully");

    while ($row = pg_fetch_assoc($result)) {
        // Biztonságos érték hozzárendelések null ellenőrzéssel
        $stars_count = isset($row['stars_count']) ? intval($row['stars_count']) : 0;
        $forks_count = isset($row['forks_count']) ? intval($row['forks_count']) : 0;
        $languages = isset($row['languages']) && !empty($row['languages']) ? json_decode($row['languages'], true) : array();
        
        $favorite = [
            'id' => intval($row['repo_id']),
            'name' => $row['name'],
            'full_name' => $row['full_name'],
            'description' => $row['description'],
            'html_url' => $row['html_url'],
            'owner' => [
                'login' => $row['owner'],
                'html_url' => $row['owner_url']
            ],
            'stargazers_count' => $stars_count,
            'forks_count' => $forks_count,
            'languages' => $languages,
            'category_id' => isset($row['category_id']) ? intval($row['category_id']) : null,
            'category_name' => isset($row['category_name']) ? $row['category_name'] : null,
            'individual_notes' => isset($row['individual_notes']) ? $row['individual_notes'] : null
        ];
        $response['favorites'][] = $favorite;
    }

    addDebug("Found " . count($response['favorites']) . " favorites");

    $response['success'] = true;
    $response['message'] = 'Favorites retrieved successfully';

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    $response['debug'][] = "Error: " . $e->getMessage();
    if (isset($e->getTrace()[0])) {
        $response['debug'][] = "Error location: " . print_r($e->getTrace()[0], true);
    }
} finally {
    if (isset($dbconn)) {
        pg_close($dbconn);
        addDebug("Database connection closed");
    }
}

// Kimeneti puffer tartalmának teljes törlése
while (ob_get_level() > 0) {
    ob_end_clean();
}

// Content-Type header beállítása közvetlenül a válasz küldése előtt
header('Content-Type: application/json');
echo json_encode($response);
exit;
