// Ez a script frissíti a developer_list.js fájlt
// Hozzáadja a checkRepositoryFavoriteStatus hívást a createStarredRepositoryCard függvényhez

const fs = require('fs');
const path = require('path');

// Olvassuk be a fájlt
const filePath = path.join(__dirname, 'developer_list.js');
let content = fs.readFileSync(filePath, 'utf8');

// Keressük meg a createStarredRepositoryCard függvényt
const regex = /function createStarredRepositoryCard\(repo\) \{([\s\S]*?)return repoCardContainer;\s*\}/;
const match = content.match(regex);

if (match) {
    // Adjuk hozzá a checkRepositoryFavoriteStatus hívást a return előtt
    const newContent = content.replace(
        regex,
        `function createStarredRepositoryCard(repo) {$1// Ellenőrizzük, hogy a repository már kedvenc-e
    checkRepositoryFavoriteStatus(repo, repoCardContainer.querySelector('.btn-repo-favorite'));

    return repoCardContainer;
}`
    );

    // Írjuk vissza a fájlt
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('A createStarredRepositoryCard függvény frissítve!');
} else {
    console.error('Nem találtuk meg a createStarredRepositoryCard függvényt!');
}
