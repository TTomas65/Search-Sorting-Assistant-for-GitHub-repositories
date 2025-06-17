<?php
require_once 'session_config.php';
require_once 'config.php';
session_start();

$response = ['success' => false, 'message' => ''];

// Csak akkor frissítünk, ha be van jelentkezve a felhasználó
if (isset($_SESSION['user_id']) && $_SESSION['logged_in']) {
    try {
        $connection_string = "host=".DB_HOST." dbname=".DB_NAME." user=".DB_USER." password=".DB_PASSWORD;
        $dbconn = pg_connect($connection_string);
        
        if (!$dbconn) {
            throw new Exception('Database connection failed: ' . pg_last_error());
        }

        // Frissítjük a last_used mezőt az aktuális időre
        $query = "UPDATE users SET last_used = CURRENT_TIMESTAMP WHERE user_id = $1";
        $result = pg_query_params($dbconn, $query, array($_SESSION['user_id']));

        if ($result === false) {
            throw new Exception('Failed to update last_used: ' . pg_last_error($dbconn));
        }

        $response['success'] = true;
        $response['message'] = 'Last used time updated successfully';

    } catch (Exception $e) {
        $response['message'] = $e->getMessage();
    } finally {
        if (isset($dbconn)) {
            pg_close($dbconn);
        }
    }
}

header('Content-Type: application/json');
echo json_encode($response);
?>
