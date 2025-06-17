<?php
/**
 * Proxy Image Service
 * 
 * Ez a script letölti a GitHub repository social preview képeket a szerver oldalon,
 * így elkerülve a CORS korlátozásokat, amelyek a böngészőben jelentkeznek.
 * 
 * Használat: proxy_image.php?url=https://opengraph.githubassets.com/1/owner/repo
 */

// Hibaüzenetek naplózása képernyőre írás helyett
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Győződjünk meg róla, hogy semmilyen kimenet nem történt eddig
if (ob_get_level() === 0) {
    ob_start();
}

// CORS fejlécek beállítása, hogy a saját domainünkről jövő kéréseket engedélyezze
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

try {
    // URL paraméter ellenőrzése
    if (!isset($_GET['url']) || empty($_GET['url'])) {
        throw new Exception('Hiányzó URL paraméter');
    }

    $url = $_GET['url'];
    
    // Csak a GitHub OpenGraph URL-eket engedélyezzük biztonsági okokból
    if (!preg_match('/^https:\/\/opengraph\.githubassets\.com\/\d+\/[^\/]+\/[^\/]+$/', $url)) {
        throw new Exception('Érvénytelen URL formátum. Csak GitHub OpenGraph URL-ek engedélyezettek.');
    }
    
    // Inicializáljuk a cURL-t
    $ch = curl_init();
    
    // cURL beállítások
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Rate limiting kezelése - véletlenszerű késleltetés hozzáadása (0-500ms)
    usleep(rand(0, 500000));
    
    // Kép letöltése
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    
    // Ellenőrizzük a HTTP státuszkódot
    if ($httpCode !== 200) {
        throw new Exception("HTTP hiba: $httpCode");
    }
    
    // Ellenőrizzük, hogy valóban képet kaptunk-e
    if (!preg_match('/^image\//', $contentType)) {
        throw new Exception("Nem kép típusú tartalom: $contentType");
    }
    
    // Fejlécek beállítása a kép típusának megfelelően
    header("Content-Type: $contentType");
    header("Content-Length: " . strlen($response));
    header("Cache-Control: public, max-age=86400"); // 1 nap cache
    
    // Kép kiküldése
    echo $response;
    
} catch (Exception $e) {
    // Hiba esetén 500-as státuszkód és hibaüzenet
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => $e->getMessage()]);
    
    // Naplózzuk a hibát
    error_log('Proxy Image Error: ' . $e->getMessage());
}

// Befejezzük a kimeneti pufferelést
if (ob_get_level() > 0) {
    ob_end_flush();
}
