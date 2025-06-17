/**
 * Sidebar navigation functionality
 * Handles sidebar toggle and navigation between sections
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const menuLinks = document.querySelectorAll('.menu-link');
    const body = document.body;
    const sidebarClose = document.getElementById('sidebar-close');
    
    // Inicializáljuk a sidebar és toggle gomb állapotát
    function initSidebarState() {
        if (window.innerWidth < 768) {
            // Mobilon alapértelmezetten a sidebar el van rejtve
            sidebar.classList.remove('active');
            menuToggle.style.display = 'block';
        } else {
            // Asztali nézetben is alapértelmezetten a sidebar el van rejtve
            sidebar.classList.remove('active');
            // Beállítjuk a sidebar-collapsed osztályt a body-ra
            body.classList.add('sidebar-collapsed');
            menuToggle.style.display = 'block';
        }
    }
    
    // Toggle sidebar on mobile
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            if (window.innerWidth < 768) {
                // Mobilon egyszerűen megjelenítjük a sidebárt
                sidebar.classList.add('active');
                menuToggle.style.display = 'none';
            } else {
                // Asztali nézetben visszaállítjuk a sidebar-collapsed állapotot
                body.classList.remove('sidebar-collapsed');
                sidebar.classList.add('active');
                menuToggle.style.display = 'none';
            }
        });
    }
    
    // Close sidebar with X button
    if (sidebarClose) {
        sidebarClose.addEventListener('click', function() {
            console.log("X button clicked");
            
            if (window.innerWidth < 768) {
                // On mobile, just remove active class
                sidebar.classList.remove('active');
            } else {
                // On desktop, toggle collapsed state and remove active class
                body.classList.toggle('sidebar-collapsed');
                if (body.classList.contains('sidebar-collapsed')) {
                    sidebar.classList.remove('active');
                } else {
                    sidebar.classList.add('active');
                }
            }
            
            // Késleltetés a CSS tranzíció miatt
            setTimeout(() => {
                // Ha a sidebar el van rejtve, megjelenítjük a toggle gombot
                if (!sidebar.classList.contains('active')) {
                    menuToggle.style.display = 'block';
                } else {
                    menuToggle.style.display = 'none';
                }
                console.log("Sidebar active:", sidebar.classList.contains('active'));
                console.log("Menu toggle display:", menuToggle.style.display);
            }, 50);
        });
    }
    
    // Handle menu item clicks
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all menu items
            menuLinks.forEach(item => {
                item.parentElement.classList.remove('active');
            });
            
            // Add active class to clicked menu item
            this.parentElement.classList.add('active');
            
            // Get the section to navigate to
            const section = this.getAttribute('data-section');
            
            // Handle navigation based on section
            switch(section) {
                case 'search':
                    // Show search section
                    showSection('search');
                    break;
                case 'favorites':
                    // Show favorites section and trigger list favorites
                    showSection('favorites');
                    document.getElementById('list-favorites-button').click();
                    break;
                case 'developers':
                    // Show developers section and trigger list developers
                    showSection('developers');
                    // document.getElementById('list-developers-button').click();
                    break;
                case 'import-export':
                    // Show import/export section
                    showSection('import-export');
                    break;
                case 'excel-export':
                    // Show excel export section
                    showSection('excel-export');
                    break;
                case 'readme':
                    // A README menüpont kezelése - nem kell külön showSection hívás,
                    // mivel a data-bs-toggle és data-bs-target attribútumok miatt
                    // automatikusan megnyílik a modal
                    break;
                default:
                    // Default to search
                    showSection('search');
            }
            
            // On mobile, close the sidebar after selecting an option
            if (window.innerWidth < 768) {
                sidebar.classList.remove('active');
                setTimeout(() => {
                    menuToggle.style.display = 'block';
                }, 50);
            }
            // Asztali nézetben is bezárjuk a menüt
            else {
                sidebar.classList.remove('active');
                body.classList.add('sidebar-collapsed');
                setTimeout(() => {
                    menuToggle.style.display = 'block';
                }, 50);
            }
        });
    });
    
    // Function to show specific section
    function showSection(sectionName) {
        console.log(`Navigating to section: ${sectionName}`);
        
        // Alapértelmezetten minden szekciót elrejtünk
        const searchControls = document.querySelector('.card.mb-4');
        const favoritesInfo = document.querySelector('.card.mb-3:nth-of-type(2)');
        const developersInfo = document.querySelector('.card.mb-3:nth-of-type(3)');
        const infoPanel = document.querySelector('.card.mb-3:nth-of-type(1)');
        const projectsContainer = document.getElementById('projects-container');
        const searchResults = document.getElementById('search-results');
        
        // Elrejtünk mindent alapértelmezetten
        if (searchControls) searchControls.style.display = 'none';
        if (favoritesInfo) favoritesInfo.style.display = 'none';
        if (developersInfo) developersInfo.style.display = 'none';
        if (projectsContainer) projectsContainer.style.display = 'none';
        if (searchResults) searchResults.style.display = 'none';
        
        // Mindig megjelenítjük az info panelt
        if (infoPanel) infoPanel.style.display = 'block';
        
        // A kiválasztott szekció alapján jelenítjük meg a megfelelő elemeket
        switch(sectionName) {
            case 'search':
                // Keresési vezérlők és találatok megjelenítése
                if (searchControls) searchControls.style.display = 'block';
                if (projectsContainer) projectsContainer.style.display = 'flex';
                break;
                
            case 'favorites':
                // Kedvencek panel megjelenítése
                if (favoritesInfo) favoritesInfo.style.display = 'block';
                break;
                
            case 'developers':
                // Fejlesztők panel megjelenítése
                if (developersInfo) developersInfo.style.display = 'block';
                break;
                
            case 'import-export':
                // Ebben az esetben csak az infopanel látszik
                break;
                
            case 'excel-export':
                // Ebben az esetben csak az infopanel látszik
                break;
                
            default:
                // Alapértelmezetten a keresési elemeket jelenítjük meg
                if (searchControls) searchControls.style.display = 'block';
                if (projectsContainer) projectsContainer.style.display = 'flex';
        }
    }
    
    // Check window size on load and resize
    function checkWindowSize() {
        initSidebarState();
    }
    
    // Initial check
    initSidebarState();
    
    // A program indulásakor csak a keresési szekciót jelenítjük meg
    showSection('search');
    
    // Set the 'Search' menu item as active by default
    menuLinks.forEach(link => {
        if(link.getAttribute('data-section') === 'search') {
            link.parentElement.classList.add('active');
        }
    });
    
    // Listen for window resize
    window.addEventListener('resize', function() {
        checkWindowSize();
    });
});
