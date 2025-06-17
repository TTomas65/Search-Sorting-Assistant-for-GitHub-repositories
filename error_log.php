<?php
function logError($error_message, $error_details = '') {
    $log_file = 'errors.log';
    $timestamp = date('Y-m-d H:i:s');
    
    // Bizalmas/érzékeny adatok szűrése
    $filtered_error_message = filterSensitiveData($error_message);
    
    // Alap log formátum
    $log_message = "[{$timestamp}] {$filtered_error_message}\n";
    
    // Részletek kezelése - csak esemény típusok, nem érzékeny adatok
    if ($error_details) {
        $filtered_details = filterSensitiveData($error_details);
        
        // Ha a részletek tartalmára nincs szükség, használhatjuk ezt is:
        // $log_message .= "Event recorded\n";
        
        // Vagy minimális információ rögzítése:
        $log_message .= "Type: {$filtered_details}\n";
    }
    
    $log_message .= "------------------------\n";
    
    error_log($log_message, 3, $log_file);
}

/**
 * Érzékeny információk szűrése a naplózandó szövegből
 */
function filterSensitiveData($text) {
    // GitHub OAuth state paraméter szűrése
    $text = preg_replace('/state: [a-f0-9]+/', 'state: [FILTERED]', $text);
    
    // GitHub tokenek szűrése
    $text = preg_replace('/token[^\s]*: [a-zA-Z0-9_\-\.]+/', 'token: [FILTERED]', $text);
    $text = preg_replace('/access_token[^\s]*: [a-zA-Z0-9_\-\.]+/', 'access_token: [FILTERED]', $text);
    
    // OAuth kódok és tokenek szűrése URL-ekben
    $text = preg_replace('/code=[a-zA-Z0-9_\-\.]+/', 'code=[FILTERED]', $text);
    $text = preg_replace('/token=[a-zA-Z0-9_\-\.]+/', 'token=[FILTERED]', $text);
    
    // Egyéb azonosítók és kulcsok szűrése
    $text = preg_replace('/API_?KEY[^\s]*: [a-zA-Z0-9_\-\.]+/', 'API_KEY: [FILTERED]', $text);
    $text = preg_replace('/SECRET[^\s]*: [a-zA-Z0-9_\-\.]+/', 'SECRET: [FILTERED]', $text);
    
    return $text;
}
?>
