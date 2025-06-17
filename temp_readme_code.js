// README betöltése
document.addEventListener('DOMContentLoaded', function() {
    // README modal megnyitásakor töltjük be a tartalmat közvetlenül a helyi README.md fájlból
    document.querySelector('[data-bs-target="#readmeModal"]').addEventListener('click', async function() {
        const readmeContent = document.getElementById('readme-content');
        readmeContent.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        
        try {
            // Helyi README.md fájl betöltése
            console.log('Loading local README.md file');
            const localResponse = await fetch('README.md');
            
            if (!localResponse.ok) {
                throw new Error('Failed to load README locally');
            }
            
            const localContent = await localResponse.text();
            
            // Markdown formázás
            if (typeof marked !== 'undefined') {
                // Marked.js beállítások
                marked.setOptions({
                    gfm: true,
                    breaks: true,
                    headerIds: true,
                    mangle: false
                });
                
                // Markdown tartalom formázása
                const formattedContent = marked.parse(localContent);
                
                // Ideiglenes div a HTML tartalom kezeléséhez
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = formattedContent;
                
                // Relatív képhivatkozások kezelése a helyi fájlrendszerben
                tempDiv.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src');
                    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                        // Relatív hivatkozás megtartása, hogy a helyi képek betöltődjenek
                        // A ./ kezdetű útvonalakat külön kezeljük
                        const cleanSrc = src.startsWith('./') ? src.substring(2) : src;
                        img.src = cleanSrc;
                    }
                });
                
                // Videók kezelése
                tempDiv.querySelectorAll('video source').forEach(source => {
                    const src = source.getAttribute('src');
                    if (src && !src.startsWith('http')) {
                        // A ./ kezdetű útvonalakat külön kezeljük
                        const cleanSrc = src.startsWith('./') ? src.substring(2) : src;
                        source.src = cleanSrc;
                    }
                });
                
                // Linkek kezelése
                tempDiv.querySelectorAll('a').forEach(link => {
                    const href = link.getAttribute('href');
                    if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
                        // A ./ kezdetű útvonalakat külön kezeljük
                        const cleanHref = href.startsWith('./') ? href.substring(2) : href;
                        
                        // Csak a repository-n belüli linkek kezelése
                        if (cleanHref.endsWith('.md') || cleanHref.endsWith('.markdown')) {
                            // Markdown fájlokra mutató linkek megtartása
                            link.href = cleanHref;
                        } else {
                            // Egyéb fájlokra mutató linkek megtartása
                            link.href = cleanHref;
                        }
                    }
                });
                
                readmeContent.innerHTML = tempDiv.innerHTML;
            } else {
                readmeContent.innerHTML = localContent;
            }
        } catch (error) {
            console.error('Error loading README:', error);
            readmeContent.innerHTML = `<div class="alert alert-danger">
                Failed to load README content. Error: ${error.message}
            </div>`;
        }
    });
});