<?php
require_once 'security_headers.php'; 
// Hibajelentés bekapcsolása fejlesztéshez
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Válasz fejléc beállítása
header('Content-Type: application/json');

// A repository lista fájl elérési útja
$repo_file = __DIR__ . '/private/weekly_repos.txt';

try {
    // Ellenőrizzük, hogy létezik-e a fájl
    if (!file_exists($repo_file)) {
        throw new Exception("A repository lista fájl nem található");
    }
    
    // Fájl tartalmának beolvasása
    $content = file_get_contents($repo_file);
    if ($content === false) {
        throw new Exception("Nem sikerült beolvasni a repository lista fájlt");
    }
    
    // Sorokra bontás és üres sorok kiszűrése
    $repos = array_filter(explode("\n", $content), function($line) {
        return !empty(trim($line));
    });
    
    // Sikeres válasz
    echo json_encode([
        'status' => 'success',
        'repos' => array_values($repos) // Újraindexelés, hogy biztosan szekvenciális legyen a tömb
    ]);
    
} catch (Exception $e) {
    // Hiba esetén hibaüzenet küldése
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>
