/**
 * Image Loader Fix v2 - Képbetöltés ellenőrzés és késleltetett újratöltés
 * 
 * Ez a script ellenőrzi a repository képek betöltését, és megjegyzi azokat a képeket,
 * amelyeket nem sikerült betölteni. A lista végén megpróbálja a hibás képeket újra betölteni
 * az eredeti forrásból.
 */

// Megjegyzi a hibás képeket és azok pozícióját
const IMAGE_LOADER = {
    // A listában található összes ismeretlen/feldolgozatlan kép száma
    pendingImageCount: 0,
    
    // A hibásan betöltött képek tárolása: { elemRef, url, owner, repo, timestamp, retryCount }
    failedImages: [],
    
    // A maximális próbálkozási számot elért hibás képek tárolása
    maxedOutImages: [],
    
    // Maximum újrapróbálkozások száma egy képre normál esetben
    maxRetries: 3,
    
    // Maximum újrapróbálkozások száma a végső újrapróbálkozási ciklusban
    finalRetries: 3,
    
    // Utolsó listázás elindításának ideje
    lastListingTime: 0,
    
    // Jelenleg folyamatban van-e újratöltés
    isRetrying: false,
    
    // Végső újratöltési ciklus folyamatban van-e
    isFinalRetrying: false,
    
    // Újratöltés periódusa (ms-ban) - ezt az időt kell várnunk, mielőtt újraböngésznénk a DOM-ot képekért
    retryPeriod: 1500,
    
    // Végső újrapróbálkozás várakozási ideje milliszekundumban
    finalRetryDelay: 3000
};

/**
 * Ellenőrzi egy kép betöltését és megjegyzi a hibás képeket későbbi újratöltésre
 * @param {HTMLImageElement} imgElement - A kép DOM elem
 * @param {string} owner - A repository tulajdonosa (felhasználónév)
 * @param {string} repo - A repository neve
 */
function checkAndFixImageLoad(imgElement, owner, repo) {
    // Növeljük a függőben lévő képek számát
    IMAGE_LOADER.pendingImageCount++;
    
    // Eredeti kép forrásának mentése
    const originalSrc = imgElement.src;
    
    // Időbélyeg a cache elkerüléséhez és a képek azonosításához
    const timestamp = Date.now();
    
    // Kép betöltési hiba kezelése
    imgElement.onerror = function() {
        // Csökkentjük a függőben lévő képek számát
        IMAGE_LOADER.pendingImageCount--;
        
        console.log(`Kép betöltési hiba: ${owner}/${repo}`);
        
        // Hozzáadjuk a hibás képet a listához
        IMAGE_LOADER.failedImages.push({
            elemRef: imgElement,            // Kép DOM elem referencia
            url: originalSrc,               // Eredeti kép URL
            owner: owner,                   // Repository tulajdonos
            repo: repo,                     // Repository név
            timestamp: timestamp,           // Időbélyeg
            retryCount: 0                   // Hányszor próbálkoztunk már
        });
        
        console.log(`Kép betöltési hiba: ${owner}/${repo} - Megjegyezve későbbi újrapróbálkozásra`);
        
        // Ha nincs több függőben lévő kép, akkor elindíthatjuk az újratöltést
        checkIfListingFinished();
    };
    
    // Sikeres betöltés kezelése
    imgElement.onload = function() {
        // Csökkentjük a függőben lévő képek számát
        IMAGE_LOADER.pendingImageCount--;
        
        // Eltávolítjuk az eseménykezelőket, mivel nincs további teendő
        imgElement.onerror = null;
        imgElement.onload = null;
        
        // Ellenőrizzük, hogy végzett-e a folyamat
        checkIfListingFinished();
    };
}

/**
 * Ellenőrzi, hogy befejeződött-e már a listázás, és ha igen, elindítja az újratöltést
 */
function checkIfListingFinished() {
    // Frissítjük a listázás idejét
    IMAGE_LOADER.lastListingTime = Date.now();
    
    // Várjunk, hogy minden DOM művelet és AJAX kérés befejeződjön
    setTimeout(() => {
        // Ellenőrizzük, hogy nincs-e több függőben lévő kép
        if (IMAGE_LOADER.pendingImageCount <= 0 && IMAGE_LOADER.failedImages.length > 0 && !IMAGE_LOADER.isRetrying) {
            console.log(`Minden kép feldolgozásra került. ${IMAGE_LOADER.failedImages.length} hibás kép újratöltése...`);
            retryFailedImages();
        }
    }, IMAGE_LOADER.retryPeriod);
}

/**
 * Megpróbálja újratölteni az összes hibás képet kizárólag az eredeti forrásból
 * Inteligensen kezeli a rate limitet, de gyorsabban próbálkozik, mert a GitHub rate limit 
 * nem az összes képre vonatkozik, hanem valószínűleg repository-nként.
 */
function retryFailedImages() {
    // Ha nincs hibás kép, nem kell semmit csinálnunk
    if (IMAGE_LOADER.failedImages.length === 0) {
        IMAGE_LOADER.isRetrying = false;
        return;
    }
    
    // Jelöljük, hogy folyamatban van az újratöltés
    IMAGE_LOADER.isRetrying = true;
    
    // Másolat készítése a hibás képekről
    const imagesToRetry = [...IMAGE_LOADER.failedImages];
    
    // Ürítsük ki a listát
    IMAGE_LOADER.failedImages = [];
    
    console.log(`${imagesToRetry.length} hibás kép újratöltése kezdődik...`);
    
    // Adaptív újratöltési stratégia, rövidebb várakozási időkkel
    imagesToRetry.forEach((imageInfo, index) => {
        // Várakozási idő számítása: index alapján növekvő, de maximálisan 100ms
        const delay = Math.min(50 + (index * 30), 100);
        
        setTimeout(() => {
            // Ellenőrizzük, hogy létezik-e még a DOM-ban ez a kép elem
            if (imageInfo.elemRef && document.body.contains(imageInfo.elemRef)) {
                // Növeljük a próbálkozások számát
                imageInfo.retryCount++;
                
                // Új időbélyeg generálása a cache elkerüléséhez
                const newTimestamp = Date.now();
                
                // Sikeres betöltés kezelése
                imageInfo.elemRef.onload = function() {
                    console.log(`Kép sikeresen betöltve újratöltésnél: ${imageInfo.owner}/${imageInfo.repo}`);
                    // Eltávolítjuk az eseménykezelőket
                    imageInfo.elemRef.onload = null;
                    imageInfo.elemRef.onerror = null;
                };
                
                // Hiba kezelése újratöltésnél
                imageInfo.elemRef.onerror = function() {
                    console.log(`Újratöltési hiba: ${imageInfo.owner}/${imageInfo.repo} (${imageInfo.retryCount}/${IMAGE_LOADER.maxRetries})`);
                    
                    // Növeljük a számlálót a vizsgálat előtt (hogy az összehasonlítás helyes legyen)
                    imageInfo.retryCount++;
                    
                    // Ha még nem értük el a maximum próbálkozást, akkor ismét megjegyezzük későbbi újrapróbálkozásra
                    if (imageInfo.retryCount < IMAGE_LOADER.maxRetries) {
                        console.log(`További újrapróbálkozás lesz a következő ciklusban: ${imageInfo.owner}/${imageInfo.repo}`);
                        IMAGE_LOADER.failedImages.push(imageInfo);
                    } else {
                        // Elmentjük a maximális próbálkozást elért képeket is a végső újrapróbálkozási ciklushoz
                        console.log(`Maximális próbálkozás elérve, felvétel a végső listába: ${imageInfo.owner}/${imageInfo.repo}`);
                        // Reseteljük a próbálkozások számát, hogy újra kezdhesse
                        imageInfo.retryCount = 0;
                        IMAGE_LOADER.maxedOutImages.push(imageInfo);
                    }
                };
                
                // Újratöltés az eredeti forrásból, friss időbélyeggel
                if (imageInfo.url.includes('opengraph.githubassets.com')) {
                    // Ha az eredeti URL OpenGraph volt, frissítsük az időbélyeget
                    imageInfo.elemRef.src = `https://opengraph.githubassets.com/${newTimestamp}/${imageInfo.owner}/${imageInfo.repo}`;
                } else {
                    // Egyébként használjuk az eredeti URL-t
                    imageInfo.elemRef.src = imageInfo.url;
                }
            }
        }, delay); // Adaptív késleltetés, rövidebb időkkel
    });
    
    // Gyorsabb újrapróbálkozás a hibás képekre
    setTimeout(() => {
        IMAGE_LOADER.isRetrying = false;
        
        // Ha még mindig vannak hibás képek, akkor újra próbálkozunk
        if (IMAGE_LOADER.failedImages.length > 0) {
            console.log(`Még mindig van ${IMAGE_LOADER.failedImages.length} hibás kép. Ismételt betöltési kísérlet...`);
            // Gyorsabb újraindítás, csak 250ms várakozással
            setTimeout(retryFailedImages, 250);
        } 
        // Ha nincsenek már újabb hibás képek, de vannak maximális próbálkozást elért képek,
        // akkor elindítjuk a végső újratöltési ciklust
        else if (IMAGE_LOADER.maxedOutImages.length > 0 && !IMAGE_LOADER.isFinalRetrying) {
            console.log(`Nem maradt több hibás kép, de van ${IMAGE_LOADER.maxedOutImages.length} maximális próbálkozást elért kép.`);
            console.log(`Végső újratöltési ciklus indítása ${IMAGE_LOADER.finalRetryDelay/1000} másodperc múlva...`);
            
            // Elindítjuk a végső újratöltési ciklust a beállított késleltetés után
            setTimeout(() => {
                startFinalRetryProcess();
            }, IMAGE_LOADER.finalRetryDelay);
        }
    }, Math.min(500, imagesToRetry.length * 50 + 200));  // Rövidebb várakozási idő
}

/**
 * Végső újratöltési ciklus indítása a maximális próbálkozást elért képekhez
 * Ez a folyamat azokkal a képekkel foglalkozik, amelyek elérték a normál maximális próbálkozási számot
 * és még egy utolsó esélyt kapnak a betöltésre (további 3 próbálkozási ciklussal).
 */
function startFinalRetryProcess() {
    // Jelöljük, hogy végső újratöltési ciklusban vagyunk
    IMAGE_LOADER.isFinalRetrying = true;
    
    console.log(`Végső újratöltési ciklus kezdődik ${IMAGE_LOADER.maxedOutImages.length} képre...`);
    
    // Ha nincs kép a végső listában, akkor azonnal befejezzük
    if (IMAGE_LOADER.maxedOutImages.length === 0) {
        IMAGE_LOADER.isFinalRetrying = false;
        return;
    }
    
    // Átmozgatjuk a képeket a failedImages listába újabb kísérlethez
    IMAGE_LOADER.failedImages = [...IMAGE_LOADER.maxedOutImages];
    IMAGE_LOADER.maxedOutImages = [];
    
    // Elindítjuk az újratöltési folyamatot ezekre a képekre
    console.log('Végső újratöltési ciklusban adjuk át a képeket a normál újratöltési folyamatnak...');
    retryFailedImages();
    
    // Közvetlenül adjunk hozzá egy ellenőrzést a végső listához
    setTimeout(() => {
        // Direkt ellenőrzés: ha vannak képek a maxedOutImages listában, akkor gyűjtsük össze őket
        if (IMAGE_LOADER.maxedOutImages.length > 0) {
            console.log(`Közvetlen ellenőrzés: ${IMAGE_LOADER.maxedOutImages.length} végleg hibis képet találtunk, ezeket adjuk a failedImages listához`);
            // A maxedOutImages listában lévő képeket másoljuk át a failedImages listába
            IMAGE_LOADER.failedImages = IMAGE_LOADER.failedImages.concat(IMAGE_LOADER.maxedOutImages);
            IMAGE_LOADER.maxedOutImages = [];
        }
    }, 1000);
    
    // 3 újabb ciklus után befejeztük a végső újratöltési ciklust és mindenképpen megpróbáljuk a gombok létrehozását
    setTimeout(() => {
        console.log('Végső újratöltési ciklus befejeződött.');
        IMAGE_LOADER.isFinalRetrying = false;
        
        // FONTOS: Most mindenhol ellenőrizzük a hibás képeket
        let allFailedImages = [];
        
        // 1. Ellenőrizzük a failedImages listát
        if (IMAGE_LOADER.failedImages.length > 0) {
            console.log(`${IMAGE_LOADER.failedImages.length} hibás kép a failedImages listában`);
            allFailedImages = allFailedImages.concat(IMAGE_LOADER.failedImages);
            IMAGE_LOADER.failedImages = [];
        }
        
        // 2. Ellenőrizzük a maxedOutImages listát (ha maradt benne valami)
        if (IMAGE_LOADER.maxedOutImages.length > 0) {
            console.log(`${IMAGE_LOADER.maxedOutImages.length} hibás kép a maxedOutImages listában`);
            allFailedImages = allFailedImages.concat(IMAGE_LOADER.maxedOutImages);
            IMAGE_LOADER.maxedOutImages = [];
        }
        
        // 3. Külön ellenőrizzük még a DOM-ban azokat a képeket, amik hibásak, de nem kerültek a listákba
        // Ez egy extra biztoonsági lépés
        console.log('DOM-ban lévő hibás képek ellenőrzése...');
        const repoImages = document.querySelectorAll('.repo-image');
        for (let img of repoImages) {
            // Ha a kép hibás vagy nem töltődött be és nem már gombot tartalmazó container
            if ((img.naturalWidth === 0 || !img.complete) && 
                img.parentNode && !img.parentNode.classList.contains('reload-button-container')) {
                
                console.log('Talált hibás kép a DOM-ban, gomb hozzáadása...');
                
                // Próbáljuk meg kinyerni az owner/repo információkat az URL-ből vagy az alt szövegből
                let owner = 'unknown';
                let repo = 'repository';
                
                if (img.src && img.src.includes('opengraph.githubassets.com')) {
                    const parts = img.src.split('/');
                    if (parts.length >= 2) {
                        repo = parts[parts.length - 1];
                        owner = parts[parts.length - 2];
                    }
                } else if (img.alt) {
                    const altParts = img.alt.split(' ');
                    if (altParts.length >= 1) {
                        repo = altParts[0];
                    }
                }
                
                // Létrehozunk egy imageInfo objektumot a kézi újratöltési gombhoz
                const directImageInfo = {
                    elemRef: img,
                    url: img.src,
                    owner: owner,
                    repo: repo,
                    timestamp: Date.now(),
                    retryCount: IMAGE_LOADER.maxRetries // Már elérte a maximális próbálkozást
                };
                
                allFailedImages.push(directImageInfo);
            }
        }
        
        // Most már mindenképpen van valami a listában, készítsük el a gombokat
        if (allFailedImages.length > 0) {
            console.log(`Összesen ${allFailedImages.length} véglegesen hibás kép, kézi újratöltési gombok hozzáadása...`);
            
            // A végleg hibás képek helyére tegyünk manuális újratöltési gombot
            allFailedImages.forEach(imageInfo => {
                if (imageInfo.elemRef && document.body.contains(imageInfo.elemRef)) {
                    // Közvetlenül hívjuk meg a gombot készítő funkciót
                    setTimeout(() => {
                        addManualReloadButton(imageInfo);
                    }, 10);
                }
            });
        } else {
            console.log('Nem találtunk egyetlen véglegesen hibás képet sem.');
        }
    }, 3000); // Késleltetés, hogy legyen ideje a retryFailedImages-nek lefutni
}

/**
 * Kézi újratöltési gombot ad egy hibás kép helyére
 * @param {Object} imageInfo - A kép információi (elemRef, owner, repo, url)
 */
function addManualReloadButton(imageInfo) {
    // Ellenőrizzük, hogy létezik-e és elérhető-e még a DOM-ban a kép elem
    if (!imageInfo.elemRef || !document.body.contains(imageInfo.elemRef)) {
        return;
    }
    
    // Mentsük el a kép dimenzióit és stílusát
    // Először próbáljuk a szülő container méretét használni, hogy biztos legalább olyan nagy legyen, mint a konténer
    const parentElement = imageInfo.elemRef.parentNode;
    let parentStyle = window.getComputedStyle(parentElement);
    let imgStyle = window.getComputedStyle(imageInfo.elemRef);
    
    // Meghatározzuk a megfelelő méreteket
    const imgWidth = Math.max(
        imageInfo.elemRef.width || 0,
        imageInfo.elemRef.naturalWidth || 0,
        parseInt(imgStyle.width) || 0,
        parseInt(parentStyle.width) || 0,
        100 // Minimum szélesség
    );
    
    const imgHeight = Math.max(
        imageInfo.elemRef.height || 0,
        imageInfo.elemRef.naturalHeight || 0,
        parseInt(imgStyle.height) || 0,
        parseInt(parentStyle.height) || 0,
        80 // Minimum magasság
    );
    
    console.log(`Kép méretei: ${imgWidth}x${imgHeight}`);
    
    // Hozzunk létre egy container div-et ugyanazokkal a dimenziókkal
    const container = document.createElement('div');
    container.classList.add('reload-button-container'); // Ez fontos osztály a későbbi azonosításhoz
    container.style.width = '100%'; // Teljes rendelkezésre álló szélesség
    container.style.height = '100%'; // Teljes rendelkezésre álló magasság
    container.style.minWidth = `${imgWidth}px`;
    container.style.minHeight = `${imgHeight}px`;
    container.style.position = 'relative';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.backgroundColor = '#f0f0f0';
    container.style.borderRadius = imgStyle.borderRadius || '4px';
    container.style.overflow = 'hidden';
    
    // Létrehozzuk az újratöltési gombot - nagyobb, feltűnőbb
    const reloadButton = document.createElement('button');
    reloadButton.textContent = 'Image Reload';
    reloadButton.style.padding = '10px 15px';
    reloadButton.style.width = '80%';
    reloadButton.style.maxWidth = '150px';
    reloadButton.style.backgroundColor = '#0366d6'; // GitHub kék
    reloadButton.style.color = 'white';
    reloadButton.style.border = '2px solid #0366d6';
    reloadButton.style.borderRadius = '6px';
    reloadButton.style.cursor = 'pointer';
    reloadButton.style.fontWeight = 'bold';
    reloadButton.style.fontSize = '14px';
    reloadButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    
    // Hover effekt
    reloadButton.onmouseover = function() {
        this.style.backgroundColor = '#0056b3';
    };
    reloadButton.onmouseout = function() {
        this.style.backgroundColor = '#0366d6';
    };
    
    // Kattintási eseménykezelő a kézi újratöltéshez
    reloadButton.onclick = function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Változtassuk meg a gomb szövegét, hogy jelezze a folyamatot
        reloadButton.textContent = 'Loading...';
        reloadButton.disabled = true;
        
        // Új kép elem létrehozása és beállítása
        const newImage = new Image();
        
        // Alap beállítások
        newImage.style.width = 'auto';
        newImage.style.height = 'auto';
        newImage.style.maxWidth = '100%';
        newImage.style.maxHeight = '100%';
        newImage.style.minWidth = `${imgWidth}px`;
        newImage.style.minHeight = `${imgHeight}px`;
        newImage.style.borderRadius = imgStyle.borderRadius || '4px';
        newImage.style.objectFit = 'contain';
        newImage.style.display = 'block';
        
        // Osztályok és attribútumok beállítása
        newImage.className = imageInfo.elemRef.className;
        newImage.classList.add('repo-image');
        
        // Fontos adatok beállítása
        newImage.dataset.owner = imageInfo.owner;
        newImage.dataset.repo = imageInfo.repo;
        newImage.dataset.manuallyReloaded = 'true';
        newImage.dataset.timestamp = Date.now();
        newImage.dataset.checkerAttached = 'true';
        newImage.dataset.attachSource = 'manual-reload';
        
        // Képellenőrző beállítása
        newImage.addEventListener('load', function() {
            console.log(`Kép betöltve: ${imageInfo.owner}/${imageInfo.repo}`);
            
            // Újratöltési mechanizmus beállítása
            setupRetryMechanism(newImage);
            
            // Kép helyezése
            container.parentNode.replaceChild(newImage, container);
            
            // Gomb visszaállítása
            reloadButton.textContent = 'Try Again';
            reloadButton.disabled = false;
        });
        
        newImage.addEventListener('error', function() {
            console.log(`Kép betöltése sikertelen: ${imageInfo.owner}/${imageInfo.repo}`);
            
            // Újratöltési mechanizmus beállítása
            setupRetryMechanism(newImage);
            
            // Gomb visszaállítása
            reloadButton.textContent = 'Try Again';
            reloadButton.disabled = false;
        });
        
        // Kép forrás beállítása
        const timestamp = Date.now();
        newImage.src = `https://opengraph.githubassets.com/${timestamp}/${imageInfo.owner}/${imageInfo.repo}`;
    };
    
    // Kép azonosító információk megjelenítése a gomb alatt
    const repoName = document.createElement('div');
    repoName.textContent = `${imageInfo.owner}/${imageInfo.repo}`;
    repoName.style.fontSize = '10px';
    repoName.style.color = '#666';
    repoName.style.marginTop = '4px';
    repoName.style.textAlign = 'center';
    repoName.style.maxWidth = '100%';
    repoName.style.overflow = 'hidden';
    repoName.style.textOverflow = 'ellipsis';
    repoName.style.whiteSpace = 'nowrap';
    
    // Összekapcsoljuk az elemeket
    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.display = 'flex';
    buttonWrapper.style.flexDirection = 'column';
    buttonWrapper.style.alignItems = 'center';
    
    buttonWrapper.appendChild(reloadButton);
    buttonWrapper.appendChild(repoName);
    container.appendChild(buttonWrapper);
    
    // Kicseréljük a képet a container-re
    imageInfo.elemRef.parentNode.replaceChild(container, imageInfo.elemRef);
}

/**
 * Inicializálja a képellenőrzést az összes repository kártyára
 * Mind a normál, mind a csillagozott repository-khoz
 */
function initializeImageLoadChecking() {
    console.log('Képbetöltés ellenőrzés inicializálása...');
    
    // Eseménykezelő hozzáadása a DOM betöltéséhez - biztonsági okokból
    document.addEventListener('DOMContentLoaded', function() {
        attachImageLoadCheckers();
    });
    
    // Azonnal is megpróbáljuk, ha a DOM már betöltődött
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        attachImageLoadCheckers();
    }
    
    // Figyelő a dinamikusan hozzáadott repository kártyákhoz
    observeRepositoryContainers();
}

/**
 * Eseménykezelők csatolása a jelenlegi képekhez
 */
function attachImageLoadCheckers() {
    // Az összes repo kép kiválasztása
    const repoImages = document.querySelectorAll('.repo-image');
    
    repoImages.forEach(img => {
        if (!img.dataset.checkerAttached) {
            const card = img.closest('.dev-repo-card') || img.closest('.card');
            if (card) {
                // Keressük a repository adatokat
                const readmeBtn = card.querySelector('.btn-readme');
                if (readmeBtn) {
                    const owner = readmeBtn.getAttribute('data-owner');
                    const repo = readmeBtn.getAttribute('data-repo');
                    
                    if (owner && repo) {
                        // Beállítjuk a kép ellenőrzést
                        checkAndFixImageLoad(img, owner, repo);
                        // Megjelöljük, hogy már csatoltuk a checker-t
                        img.dataset.checkerAttached = 'true';
                    }
                }
            }
        }
    });
}

/**
 * MutationObserver beállítása a dinamikusan hozzáadott repository kártyákhoz
 */
function observeRepositoryContainers() {
    // Az összes repository container figyelése
    const containers = [
        // A fejlesztői repository container
        '.dev-repositories-container',
        // A starred repository container
        '.starred-list-container',
        // Általános repository konténerek
        '#results-list',
        '#projects-container'
    ];
    
    // MutationObserver létrehozása
    const observer = new MutationObserver(function(mutations) {
        let newImagesFound = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Elem csomópont
                        // Ellenőrizzük, hogy van-e benne repo kép
                        const repoImages = node.querySelectorAll ? node.querySelectorAll('.repo-image') : [];
                        if (repoImages.length > 0) {
                            newImagesFound = true;
                        }
                    }
                });
            }
        });
        
        // Ha új képeket találtunk, csatoljuk hozzájuk az ellenőrzőket
        if (newImagesFound) {
            console.log('Új repository képek észlelve - ellenőrzők csatolása...');
            attachImageLoadCheckers();
        }
    });
    
    // Az observer beindítása minden konténerre
    containers.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            observer.observe(el, { childList: true, subtree: true });
        });
    });
    
    // Figyeljük a teljes body-t is, mert később létrejöhetnek új konténerek
    observer.observe(document.body, { childList: true, subtree: true });
    
    console.log('Repository konténerek megfigyelése beállítva');
}

// Inicializáljuk a képellenőrzést
initializeImageLoadChecking();

// Egyedi esemény létrehozása, amit kiválthatunk, amikor manuálisan kell újraellenőrizni a képeket
const imageCheckEvent = new CustomEvent('checkRepoImages');

// Kép attribútumok és eseménykezelők kezelése
function setupImageAttributesAndEvents(img, owner, repo) {
    // Alap attribútumok beállítása
    img.dataset.owner = owner;
    img.dataset.repo = repo;
    img.dataset.checkerAttached = 'true';
    img.dataset.attachSource = 'manual-reload';
    img.dataset.manuallyReloaded = 'true';
    
    // Képellenőrző beállítása
    img.addEventListener('load', function() {
        console.log(`Kép betöltve: ${owner}/${repo}`);
        // Újratöltési mechanizmus beállítása
        setupRetryMechanism(img);
    });
    
    img.addEventListener('error', function() {
        console.log(`Kép betöltése sikertelen: ${owner}/${repo}`);
        // Újratöltési mechanizmus beállítása
        setupRetryMechanism(img);
    });
}

// Újratöltési mechanizmus beállítása
function setupRetryMechanism(img) {
    const owner = img.dataset.owner;
    const repo = img.dataset.repo;
    
    if (!owner || !repo) {
        console.error('Hiányzó adatok a kép újratöltéséhez');
        return;
    }
    
    // Ellenőrizzük, hogy a kép már manuálisan újratöltött-e
    if (img.dataset.manuallyReloaded === 'true') {
        console.log('Kép már manuálisan újratöltött, nem indítunk automatikus újratöltést');
        return;
    }
    
    // Ellenőrizzük, hogy már van-e újratöltési időzítő a képhez
    if (img.dataset.retryTimerId) {
        console.log('Már van újratöltési időzítő a képhez');
        return;
    }
    
    // Eredeti URL megőrzése
    const originalUrl = img.src;
    
    // Újratöltési számláló beállítása
    img.dataset.retryCount = img.dataset.retryCount || '0';
    
    // Újratöltési függvény
    function retryLoad() {
        // Ellenőrizzük, hogy a kép még létezik-e a DOM-ban
        if (!document.body.contains(img)) {
            console.log('Kép már nem létezik a DOM-ban, újratöltés leállítása');
            clearTimeout(parseInt(img.dataset.retryTimerId));
            return;
        }
        
        // Ellenőrizzük, hogy a kép már betöltődött-e
        if (img.complete && img.naturalWidth > 0) {
            console.log('Kép már betöltődött, újratöltés leállítása');
            clearTimeout(parseInt(img.dataset.retryTimerId));
            return;
        }
        
        // Ellenőrizzük, hogy elértük-e a maximális próbálkozási számot
        const retryCount = parseInt(img.dataset.retryCount);
        if (retryCount >= 3) {
            console.log('Elértük a maximális próbálkozási számot, újratöltés leállítása');
            clearTimeout(parseInt(img.dataset.retryTimerId));
            return;
        }
        
        // Növeljük a próbálkozási számlálót
        img.dataset.retryCount = (retryCount + 1).toString();
        
        // Új időbélyeg generálása
        const timestamp = Date.now();
        
        // URL frissítése
        if (originalUrl.includes('opengraph.githubassets.com')) {
            img.src = `https://opengraph.githubassets.com/${timestamp}/${owner}/${repo}`;
        } else {
            img.src = originalUrl;
        }
        
        // Újratöltési időzítő beállítása
        const timerId = setTimeout(retryLoad, 5000); // 5 másodpercenként próbálkozunk újra
        img.dataset.retryTimerId = timerId.toString();
    }
    
    // Először próbálkozunk
    retryLoad();
}

// Globális függvény exportálása, ami bármikor mehívható a képek ellenőrzéséhez
window.recheckRepositoryImages = function(forceRecheck = false) {
    console.log(`Minden repository kép újraellenőrzése...${forceRecheck ? ' (kényszerített)' : ''}`);
    
    // Az összes repo kép kiválasztása és ellenőrzése
    const repoImages = document.querySelectorAll('.repo-image');
    
    repoImages.forEach(img => {
        // Ellenőrizzük, hogy a kép rendelkezik-e a szükséges adatokkal
        const owner = img.dataset.owner;
        const repo = img.dataset.repo;
        
        if (owner && repo) {
            // Ha a kép nem töltődött be vagy hibás
            if (!img.complete || img.naturalWidth === 0) {
                console.log(`Kép ellenőrzése: ${owner}/${repo}`);
                
                // Újratöltési mechanizmus beállítása
                if (typeof setupRetryMechanism === 'function') {
                    setupRetryMechanism(img);
                }
                
                // Kép újratöltése
                const timestamp = Date.now();
                img.src = `https://opengraph.githubassets.com/${timestamp}/${owner}/${repo}`;
            }
        }
    });
    
    // Eseménykezelők csatolása minden képhez
    attachImageLoadCheckers(forceRecheck);
    
    // Esemény kiváltása
    document.dispatchEvent(imageCheckEvent);
};

// Figyelő a View Starred List és Repos gombokra
function listenToDeveloperListButtons() {
    console.log('Fejlesztői lista és repository gombok figyelésének beállítása...');
    
    // Eseménydelegació a teljes dokumentumra - ez biztosítja, hogy a később létrehozott gombokra is működik
    document.addEventListener('click', function(event) {
        // Ellenőrizzük, hogy a repository listát megjelenítő gombok valamelyikére történt-e kattintás
        let repoListButton = null;
        
        // A lehetséges gombok listája:
        // 1. "View Developer Starred List" gomb (.btn-view-starred vagy data-action="view-starred")
        // 2. "Repos" gomb (.btn-view-repos vagy data-action="view-repos")
        
        // Debug log melyik elemre történt a kattintás
        console.log('Kattintás észlelve:', event.target.tagName, 
                   'class:', event.target.className, 
                   'text:', event.target.textContent?.trim()?.substring(0, 20));
        
        // Különböző lehetőségek, hogy melyik elemet találhatjuk meg
        // Kiterjesztjük a szelektorokat és több lehetőséget adunk a felismeréshez
        if (event.target.classList.contains('btn-view-starred') || 
            event.target.getAttribute('data-action') === 'view-starred' ||
            event.target.closest('.btn-view-starred') ||
            event.target.closest('[data-action="view-starred"]') ||
            event.target.classList.contains('btn-view-repos') ||
            event.target.getAttribute('data-action') === 'view-repos' ||
            event.target.closest('.btn-view-repos') ||
            event.target.closest('[data-action="view-repos"]') ||
            // Szöveg alapján is felismerjük a gombokat
            (event.target.textContent && event.target.textContent.includes('View Developer Starred List')) ||
            (event.target.textContent && event.target.textContent.includes('Repos')) ||
            // Ha a szülői elem tartalmazza a szöveget
            (event.target.parentElement && event.target.parentElement.textContent && 
              (event.target.parentElement.textContent.includes('View Developer Starred List') || 
               event.target.parentElement.textContent.includes('Repos'))) ||
            // Ha a legközelebbi gomb tartalmazza a szöveget
            (event.target.closest('button') && event.target.closest('button').textContent && 
              (event.target.closest('button').textContent.includes('View Developer Starred List') || 
               event.target.closest('button').textContent.includes('Repos')))) {
            
            // Megállapítjuk, hogy melyik elemre történt a kattintás és megjegyezzük
            repoListButton = event.target;
            
            // Logolják minden alkalommal a talált gombot a jobb diagnosztika érdekében
            console.log('Talált gomb:', repoListButton.tagName, 
                       'class:', repoListButton.className,
                       'text:', repoListButton.textContent?.trim()?.substring(0, 20));
        }
        
        // Ha megtaláltuk bármelyik gombot, figyelünk, hogy mikor töltődik be a lista
        if (repoListButton) {
            // Fejlettített gomb típus felismerés - szöveg alapján is dolgozik
            let buttonType = 'repos'; // alapból 'repos', hacsak nem találjuk csillagozott típusúnak
            
            // Vizsgáljuk meg az elemet és annak szülőit/leszármazottait a jobb felismerésért
            if (repoListButton.classList && repoListButton.classList.contains('btn-view-starred')) {
                buttonType = 'csillagozott';
            } else if (repoListButton.getAttribute && repoListButton.getAttribute('data-action') === 'view-starred') {
                buttonType = 'csillagozott';
            } else if (repoListButton.textContent && repoListButton.textContent.includes('View Developer Starred List')) {
                buttonType = 'csillagozott';
            } else if (repoListButton.closest && (repoListButton.closest('.btn-view-starred') || repoListButton.closest('[data-action="view-starred"]'))) {
                buttonType = 'csillagozott';
            } else if (repoListButton.closest && repoListButton.closest('button') && 
                      repoListButton.closest('button').textContent && 
                      repoListButton.closest('button').textContent.includes('View Developer Starred List')) {
                buttonType = 'csillagozott';
            }
            
            console.log(`Felismert gomb típus: ${buttonType}`);
            
            console.log(`${buttonType} lista gombra történt kattintás. Várakozás a tartalom betöltésére...`);
            
            // Rövid késleltetés a lista betöltése után - ez biztosítja, hogy a DOM már kész
            setTimeout(() => {
                console.log('Késleltetett képbetöltés ellenőrzés: első próba');
                window.recheckRepositoryImages();
                
                // Még egy újrapróbálkozás néhány milliszekundummal később
                setTimeout(() => {
                    console.log('Késleltetett képbetöltés ellenőrzés: második próba');
                    window.recheckRepositoryImages();
                    
                    // És még egy végső próba, hogy biztosan elkapjuk az AJAX után betöltődő dolgokat is
                    setTimeout(() => {
                        console.log('Késleltetett képbetöltés ellenőrzés: harmadik, végső próba');
                        window.recheckRepositoryImages();
                    }, 500);
                }, 300);
            }, 100);
        }
    });
    
    // MutationObserver figyeli a kontenermódosításokat
    const repoListObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Bejárjuk a hozzáadott csomópontokat
                mutation.addedNodes.forEach(node => {
                    // Ha HTML elem a hozzáadott csomópont
                    if (node.nodeType === 1) {
                        // Ellenőrizzük, hogy ez egy lista kontainer vagy tartalmaz képeket
                        const hasRepoImages = node.querySelectorAll && (
                            node.querySelectorAll('.repo-image').length > 0 ||
                            node.classList && (
                                node.classList.contains('starred-list-container') ||
                                node.classList.contains('dev-repositories-container')
                            )
                        );
                        
                        // Ha találtunk releváns tartalmat, akkor újra ellenőrizzük a képeket
                        if (hasRepoImages) {
                            console.log('Repository tartalom változás észlelve!', node);
                            window.recheckRepositoryImages();
                        }
                    }
                });
            }
        });
    });
    
    // Figyelő hozzáadása a releváns konteinerekre
    const containerSelectors = [
        '.starred-list-container',     // Csillagozott listák konteiner
        '.dev-repositories-container', // Fejlesztői repository-k konteiner
        '.repos-container'             // Általános repository kontainer
    ];
    
    // Minden konteinerhez hozzáadjuk a figyelőt
    containerSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(container => {
            console.log(`Figyelő hozzáadása: ${selector}`);
            repoListObserver.observe(container, { childList: true, subtree: true });
        });
    });
    
    // A document testjét is megfigyeli, hogy észlelje az újonnan létrehozott konteinereket
    repoListObserver.observe(document.body, { childList: true, subtree: true });
}

// Inicializáljuk a fejlesztői és repository lista gombok figyelését
listenToDeveloperListButtons();
