/**
 * Excel Export Login Fix
 * 
 * This script implements the login check functionality for the Excel export feature.
 * It provides a common utility function that consistently shows login required messages 
 * across the application, replacing individual alert messages with a standardized Bootstrap alert.
 */

/**
 * Shows a standardized Bootstrap alert message when login is required
 * This can be used by any feature that requires user login
 */
function showLoginRequiredMessage() {
    // Ellenőrizzük, hogy van-e már login-error üzenet a DOM-ban
    let loginErrorContainer = document.getElementById('login-error-container');
    
    // Ha nincs még hiba container, létrehozzuk
    if (!loginErrorContainer) {
        const mainContent = document.querySelector('.main-content .container');
        if (!mainContent) return;
        
        loginErrorContainer = document.createElement('div');
        loginErrorContainer.id = 'login-error-container';
        loginErrorContainer.className = 'login-error-container';
        
        // Beszúrjuk az első elem előtt
        mainContent.insertBefore(loginErrorContainer, mainContent.firstChild);
    }
    
    // Törüljük az esetleges korábbi üzeneteket
    loginErrorContainer.innerHTML = '';
    
    // Létrehozzuk az alert elemet
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-warning alert-dismissible fade show';
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        <strong>Login Required!</strong> 
        You must be logged in to use this function. Please log in with your GitHub account.
        <a href="github_login.php" class="btn btn-sm btn-warning ms-2">
            <i class="bi bi-github"></i> Login with GitHub
        </a>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Hozzáadjuk a containerhez
    loginErrorContainer.appendChild(alertDiv);
    
    // Görgessük a lap tetejére, hogy a felhasználó lássa az üzenetet
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Automatikus elrejtés 10 másodperc után
    setTimeout(() => {
        const bsAlert = new bootstrap.Alert(alertDiv);
        bsAlert.close();
    }, 10000);
}

/**
 * Inicializáljuk a kiegészítő eventlistenereket
 */
function initExcelLoginFix() {
    // Figyelünk a szekció váltásokra
    document.addEventListener('sectionChanged', function(e) {
        // Ha az Excel export szekcióra váltunk, meggyőződünk róla, hogy a felhasználó be van jelentkezve
        if (e.detail.section === 'excel-export') {
            const userInfoElement = document.getElementById('user-info');
            if (userInfoElement && userInfoElement.classList.contains('d-none')) {
                showLoginRequiredMessage();
            }
        }
    });
}

// Inicializáljuk a javításokat, amikor a DOM betöltődött
document.addEventListener('DOMContentLoaded', function() {
    initExcelLoginFix();
    console.log('Excel export login fix initialized');
});
