/**
 * Github Import Functionality
 * Manages the Github import functionality
 */

// Globális változók deklarálása, hogy az egész scriptben elérhetőek legyenek
let importGithubReposCheckbox;
let importWatchingReposCheckbox;
let importFollowingDevsCheckbox;
let startOperationBtn;

document.addEventListener('DOMContentLoaded', () => {
    // Elements inicializálása a DOM betöltése után
    importGithubReposCheckbox = document.getElementById('import-github-repos');
    importWatchingReposCheckbox = document.getElementById('import-watching-repos');
    importFollowingDevsCheckbox = document.getElementById('import-following-devs');
    startOperationBtn = document.getElementById('start-operation-btn');
    
    // Egyszerre csak egy jelölőnégyzet lehet kiválasztva
    if (importGithubReposCheckbox && importWatchingReposCheckbox && importFollowingDevsCheckbox) {
        importGithubReposCheckbox.addEventListener('change', () => {
            if (importGithubReposCheckbox.checked) {
                importWatchingReposCheckbox.checked = false;
                importFollowingDevsCheckbox.checked = false;
            }
        });
        
        importWatchingReposCheckbox.addEventListener('change', () => {
            if (importWatchingReposCheckbox.checked) {
                importGithubReposCheckbox.checked = false;
                importFollowingDevsCheckbox.checked = false;
            }
        });

        importFollowingDevsCheckbox.addEventListener('change', () => {
            if (importFollowingDevsCheckbox.checked) {
                importGithubReposCheckbox.checked = false;
                importWatchingReposCheckbox.checked = false;
            }
        });
    }

    // Initialize event listeners
    if (startOperationBtn) {
        startOperationBtn.addEventListener('click', startOperation);
    }

    /**
     * Starts the import operation
     */
    function startOperation() {
        // Get selected options
        const importStarred = importGithubReposCheckbox.checked;
        const importWatching = importWatchingReposCheckbox.checked;
        const importFollowing = importFollowingDevsCheckbox.checked;

        // Validate that at least one import option is selected
        if (!importStarred && !importWatching && !importFollowing) {
            alert('Please enable at least one import option to continue.');
            return;
        }
        
        // Meghatározzuk az importálás típusát
        let importType = '';
        if (importStarred) {
            importType = 'starred';
        } else if (importWatching) {
            importType = 'watching';
        } else if (importFollowing) {
            importType = 'following';
        }

        // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó - egységes megoldással
        if (document.getElementById('user-info').classList.contains('d-none')) {
            // Közvetlenül hívjuk meg a saját függvényünket
            if (typeof showLoginRequiredMessage === 'function') {
                showLoginRequiredMessage();
            } else {
                // Ha a függvény nem elérhető, használjuk az eredeti megoldást
                alert('Please login first to import GitHub repositories.');
            }
            return;
        } else {
            // Ha be van jelentkezve, kiírjuk a konzolba
            console.log('User is logged in');
            
            if (importType === 'following') {
                // Követett fejlesztők importálása
                importFollowingDevelopers();
            } else {
                // Repositorik importálása
                importGithubRepositories(importType);
            }
        }
    }

    /**
     * Imports GitHub repositories
     * @param {string} type - Type of repositories to import (starred, watching)
     */
    async function importGithubRepositories(type = 'starred') {
        // A bejelentkezés ellenőrzése már a startOperation-ben megtörtént
        // Itt már csak a felhasználónevet kérjük le
        const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
        const username = userInfo.login;

        // Értesítés az import indításáról
        showNotification(`Import operation initiated. Importing ${type} GitHub repositories for ${username}...`);
        console.log(`Importing ${type} GitHub repositories for user:`, username);
        
        // Létrehozunk egy progress indikátort
        let progressContainer = document.getElementById('import-progress-container');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'import-progress-container';
            progressContainer.className = 'mt-3';
            document.getElementById('github-import-export-panel').appendChild(progressContainer);
        }
        
        progressContainer.innerHTML = `
            <div class="alert alert-info">
                <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <div>Importing ${type} repositories... This may take a while.</div>
                </div>
            </div>
        `;
        
        try {
            // A megfelelő PHP fájl hívása a típus alapján
            let endpoint = '';
            if (type === 'starred') {
                endpoint = 'import_starred_repos.php';
            } else if (type === 'watching') {
                endpoint = 'import_watching_repos.php';
            } else {
                throw new Error(`Unknown repository type: ${type}`);
            }
            
            // API hívás az import végrehajtásához
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Import response:', data);
            
            if (data.success) {
                // Sikeres import
                progressContainer.innerHTML = `
                    <div class="alert alert-success">
                        <h5><i class="bi bi-check-circle-fill me-2"></i>Import Completed</h5>
                        <p>${data.message}</p>
                        <div class="mt-2">
                            <strong>Summary:</strong>
                            <ul>
                                <li>Imported: ${data.imported}</li>
                                <li>Skipped (already in favorites): ${data.skipped}</li>
                                <li>Total repositories processed: ${data.total}</li>
                            </ul>
                        </div>
                    </div>
                `;
                showNotification(`Import completed successfully! Imported: ${data.imported}, Skipped: ${data.skipped}, Total: ${data.total}`);
            } else {
                // Sikertelen import
                progressContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>Import Failed</h5>
                        <p>${data.message}</p>
                    </div>
                `;
                showNotification(`Import failed: ${data.message}`);
            }
        } catch (error) {
            console.error('Error importing repositories:', error);
            // Ellenőrizzük, hogy a status elem létezik-e
            const statusElement = document.getElementById('github-import-status');
            if (statusElement) {
                statusElement.innerHTML = 
                    '<div class="alert alert-danger">Error importing repositories. Please try again later.</div>';
            }
            console.error('Error during import:', error);
            // Biztosítsuk, hogy a progressContainer létezik
            if (progressContainer) {
                progressContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>Import Error</h5>
                        <p>${error.message}</p>
                    </div>
                `;
            }
            showNotification(`Import error: ${error.message}`);
        }
    }



    /**
     * Shows a notification to the user
     * @param {string} message - The message to display
     */
    function showNotification(message) {
        // Check if notification container exists, otherwise create it
        let notificationContainer = document.getElementById('notification-container');
        
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.position = 'fixed';
            notificationContainer.style.top = '20px';
            notificationContainer.style.right = '20px';
            notificationContainer.style.zIndex = '9999';
            document.body.appendChild(notificationContainer);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'alert alert-info alert-dismissible fade show';
        notification.role = 'alert';
    }
});

// Initialize event listeners
if (startOperationBtn) {
    startOperationBtn.addEventListener('click', startOperation);
}

/**
 * Starts the import operation
 */
function startOperation() {
    // Get selected options
    const importStarred = importGithubReposCheckbox.checked;
    const importWatching = importWatchingReposCheckbox.checked;
    const importFollowing = importFollowingDevsCheckbox.checked;

    // Validate that at least one import option is selected
    if (!importStarred && !importWatching && !importFollowing) {
        alert('Please enable at least one import option to continue.');
        return;
    }
    
    // Meghatározzuk az importálás típusát
    let importType = '';
    if (importStarred) {
        importType = 'starred';
    } else if (importWatching) {
        importType = 'watching';
    } else if (importFollowing) {
        importType = 'following';
    }

    // Ellenőrizzük, hogy be van-e jelentkezve a felhasználó - egységes megoldással
    if (document.getElementById('user-info').classList.contains('d-none')) {
        // Közvetlenül hívjuk meg a saját függvényünket
        if (typeof showLoginRequiredMessage === 'function') {
            showLoginRequiredMessage();
        } else {
            // Ha a függvény nem elérhető, használjuk az eredeti megoldást
            alert('Please login first to import GitHub repositories.');
        }
        return;
    } else {
        // Ha be van jelentkezve, kiírjuk a konzolba
        console.log('User is logged in');
        
        if (importType === 'following') {
            // Követett fejlesztők importálása
            importFollowingDevelopers();
        } else {
            // Repositorik importálása
            importGithubRepositories(importType);
        }
    }
}

/**
 * Imports GitHub repositories
 * @param {string} type - Type of repositories to import (starred, watching)
 */
async function importGithubRepositories(type = 'starred') {
    // A bejelentkezés ellenőrzése már a startOperation-ben megtörtént
    // Itt már csak a felhasználónevet kérjük le
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
    const username = userInfo.login;

    // Értesítés az import indításáról
    showNotification(`Import operation initiated. Importing ${type} GitHub repositories for ${username}...`);
    console.log(`Importing ${type} GitHub repositories for user:`, username);
    
    // Létrehozunk egy progress indikátort
    let progressContainer = document.getElementById('import-progress-container');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'import-progress-container';
        progressContainer.className = 'mt-3';
        document.getElementById('github-import-export-panel').appendChild(progressContainer);
    }
    
    progressContainer.innerHTML = `
        <div class="alert alert-info">
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div>Importing ${type} repositories... This may take a while.</div>
            </div>
        </div>
    `;
    
    try {
        // A megfelelő PHP fájl hívása a típus alapján
        let endpoint = '';
        if (type === 'starred') {
            endpoint = 'import_starred_repos.php';
        } else if (type === 'watching') {
            endpoint = 'import_watching_repos.php';
        } else {
            throw new Error(`Unknown repository type: ${type}`);
        }
        
        // API hívás az import végrehajtásához
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Import response:', data);
        
        if (data.success) {
            // Sikeres import
            progressContainer.innerHTML = `
                <div class="alert alert-success">
                    <h5><i class="bi bi-check-circle-fill me-2"></i>Import Completed</h5>
                    <p>${data.message}</p>
                    <div class="mt-2">
                        <strong>Summary:</strong>
                        <ul>
                            <li>Imported: ${data.imported}</li>
                            <li>Skipped (already in favorites): ${data.skipped}</li>
                            <li>Total repositories processed: ${data.total}</li>
                        </ul>
                    </div>
                </div>
            `;
            showNotification(`Import completed successfully! Imported: ${data.imported}, Skipped: ${data.skipped}, Total: ${data.total}`);
        } else {
            // Sikertelen import
            progressContainer.innerHTML = `
                <div class="alert alert-danger">
                    <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>Import Failed</h5>
                    <p>${data.message}</p>
                </div>
            `;
            showNotification(`Import failed: ${data.message}`);
        }
    } catch (error) {
        console.error('Error importing repositories:', error);
        // Ellenőrizzük, hogy a status elem létezik-e
        const statusElement = document.getElementById('github-import-status');
        if (statusElement) {
            statusElement.innerHTML = 
                '<div class="alert alert-danger">Error importing repositories. Please try again later.</div>';
        }
        console.error('Error during import:', error);
        // Biztosítsuk, hogy a progressContainer létezik
        if (progressContainer) {
            progressContainer.innerHTML = `
                <div class="alert alert-danger">
                    <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>Import Error</h5>
                    <p>${error.message}</p>
                </div>
            `;
        }
        showNotification(`Import error: ${error.message}`);
    }
}

/**
 * Shows a notification to the user
 * @param {string} message - The message to display
 */
function showNotification(message) {
    // Check if notification container exists, otherwise create it
    let notificationContainer = document.getElementById('notification-container');
    
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        document.body.appendChild(notificationContainer);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'alert alert-info alert-dismissible fade show';
    notification.role = 'alert';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Add to container
    notificationContainer.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 150);
    }, 5000);
}

/**
 * Imports followed developers from GitHub
 */
async function importFollowingDevelopers() {
    // A bejelentkezés ellenőrzése már a startOperation-ben megtörtént
    // Itt már csak a felhasználónevet kérjük le
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
    const username = userInfo.login;

    // Értesítés az import indításáról
    showNotification(`Import operation initiated. Importing followed developers for ${username}...`);
    console.log(`Importing followed developers for user:`, username);
    
    // Létrehozunk egy progress indikátort
    let progressContainer = document.getElementById('import-progress-container');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'import-progress-container';
        progressContainer.className = 'mt-3';
        document.getElementById('github-import-export-panel').appendChild(progressContainer);
    }
    
    progressContainer.innerHTML = `
        <div class="alert alert-info">
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div>Importing followed developers... This may take a while.</div>
            </div>
        </div>
    `;
    
    try {
        // API hívás az import végrehajtásához
        const endpoint = 'import_following_devs.php';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Import response:', data);
        
        if (data.success) {
            // Sikeres import
            progressContainer.innerHTML = `
                <div class="alert alert-success">
                    <h5><i class="bi bi-check-circle-fill me-2"></i>Import Completed</h5>
                    <p>${data.message}</p>
                    <div class="mt-2">
                        <strong>Summary:</strong>
                        <ul>
                            <li>Imported: ${data.imported}</li>
                            <li>Skipped (already in favorites): ${data.skipped}</li>
                            <li>Total developers processed: ${data.total}</li>
                        </ul>
                    </div>
                </div>
            `;
            showNotification(`Import completed successfully! Imported: ${data.imported}, Skipped: ${data.skipped}, Total: ${data.total}`);
        } else {
            // Sikertelen import
            progressContainer.innerHTML = `
                <div class="alert alert-danger">
                    <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>Import Failed</h5>
                    <p>${data.message}</p>
                </div>
            `;
            showNotification(`Import failed: ${data.message}`);
        }
    } catch (error) {
        console.error('Error importing followed developers:', error);
        // Ellenőrizzük, hogy a status elem létezik-e
        const statusElement = document.getElementById('github-import-status');
        if (statusElement) {
            statusElement.innerHTML = 
                '<div class="alert alert-danger">Error importing followed developers. Please try again later.</div>';
        }
        console.error('Error during import:', error);
        // Biztosítsuk, hogy a progressContainer létezik
        if (progressContainer) {
            progressContainer.innerHTML = `
                <div class="alert alert-danger">
                    <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>Import Error</h5>
                    <p>${error.message}</p>
                </div>
            `;
        }
        showNotification(`Import error: ${error.message}`);
    }
}
