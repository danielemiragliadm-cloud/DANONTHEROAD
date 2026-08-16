/**
 * AUTO-LAYOUT FOTO — Dan on the Road
 * ------------------------------------------------
 * Al posto di scrivere a mano ogni <div class="universal-flex-row">,
 * passi una lista piatta di foto (nell'ordine in cui le vuoi mostrare)
 * e questa funzione decide da sola come raggrupparle in righe,
 * rispettando:
 *   - massimo N foto per riga (default 4)
 *   - larghezza massima del contenitore (default 1020px, quella
 *     usata da .timeline-container su desktop)
 *
 * Le larghezze delle card (225px verticale, 300px orizzontale) e il
 * gap (20px) sono presi identici al CSS che hai già in arizona25.html,
 * quindi il calcolo rispecchia esattamente quello che vedrai a schermo.
 */

const CARD_WIDTHS = {
    verticale: 180,
    orizzontale: 250
    // 'panoramica' non ha una larghezza fissa: occupa sempre
    // l'intera larghezza del contenitore (vedi packPhotosIntoRows)
    // Con queste larghezze: 4 verticali in riga = 780px, 3 orizzontali = 790px,
    // entrambi entro gli 800px della colonna .day-content
};

/**
 * Divide un array di foto in righe, evitando quando possibile righe
 * con meno di 3 foto (a meno che il gruppo non sia troppo piccolo o
 * non si divida esattamente in parti da 3-4, nel qual caso una riga
 * più corta resta inevitabile).
 *
 * Come funziona: prova tutte le suddivisioni in righe compatibili con
 * maxPerRow e containerWidth, e sceglie quella con il minor numero di
 * righe "orfane" (una sola foto). A parità di orfane, sceglie quella
 * con meno righe totali (foto più raggruppate).
 *
 * @param {Array} photos - [{ src, alt, caption, orientation }, ...]
 *   orientation può essere 'verticale', 'orizzontale' o 'panoramica'.
 *   Una foto 'panoramica' va sempre da sola nella sua riga, a piena
 *   larghezza, per allinearsi esattamente ai bordi delle righe sopra.
 * @param {Object} opts
 * @param {number} opts.maxPerRow - foto massime per riga (default 4)
 * @param {number} opts.containerWidth - larghezza utile del contenitore in px
 *   (default 800: è la larghezza reale della colonna .day-content in
 *   arizona25.html — .timeline-container è 1020px di larghezza utile,
 *   meno 180px della colonna .day-sticky e 40px di gap tra le colonne)
 * @param {number} opts.gap - spazio tra le foto in px
 * @returns {Array<Array>} array di righe, ogni riga è un array di foto
 */
function packPhotosIntoRows(photos, opts = {}) {
    const {
        maxPerRow = 4,
        containerWidth = 800,
        gap = 20
    } = opts;

    // Le foto panoramiche spezzano sempre la sequenza: vanno da sole
    // nella loro riga. Divido prima in "gruppi" di foto normali
    // separati dalle eventuali panoramiche.
    const segments = [];
    let currentGroup = [];
    for (const photo of photos) {
        if (photo.orientation === 'panoramica') {
            if (currentGroup.length) segments.push({ type: 'group', items: currentGroup });
            segments.push({ type: 'panoramica', items: [photo] });
            currentGroup = [];
        } else {
            currentGroup.push(photo);
        }
    }
    if (currentGroup.length) segments.push({ type: 'group', items: currentGroup });

    const rows = [];
    for (const segment of segments) {
        if (segment.type === 'panoramica') {
            rows.push(segment.items);
        } else {
            rows.push(...partitionGroupIntoRows(segment.items, { maxPerRow, containerWidth, gap }));
        }
    }
    return rows;
}

/** Larghezza totale (in px) di una riga di foto, gap inclusi. */
function rowWidth(items, gap) {
    let width = 0;
    items.forEach((photo, idx) => {
        width += CARD_WIDTHS[photo.orientation] || CARD_WIDTHS.verticale;
        if (idx > 0) width += gap;
    });
    return width;
}

/** Confronta due costi [numeroRigheOrfane, numeroRigheTotali]: negativo se a è migliore di b. */
function compareCost(a, b) {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
}

/**
 * Penalità per una riga di "size" foto: una riga da 1 foto sola è
 * sempre peggio di una riga da 2 (anche se entrambe sono sotto la
 * soglia minima di 3), altrimenti a parità di punteggio totale
 * l'algoritmo potrebbe scegliere una riga orfana invece di una coppia.
 */
function rowPenalty(size) {
    if (size === 1) return 2;
    if (size === 2) return 1;
    return 0;
}

/**
 * Suddivide un gruppo di foto (senza panoramiche) in righe, minimizzando
 * le righe con MENO di 3 foto (1 o 2). Programmazione dinamica: dp[i] =
 * miglior suddivisione di photos[i:] in righe. Una riga sotto le 3 foto
 * resta possibile solo se inevitabile (es. un gruppo di 1, 2 o 5 foto
 * non si divide mai in parti tutte da 3 o 4).
 */
function partitionGroupIntoRows(items, { maxPerRow, containerWidth, gap }) {
    const n = items.length;
    const dp = new Array(n + 1);
    dp[n] = { cost: [0, 0], next: null };

    for (let i = n - 1; i >= 0; i--) {
        let best = null;
        for (let j = i + 1; j <= Math.min(i + maxPerRow, n); j++) {
            const slice = items.slice(i, j);
            const width = rowWidth(slice, gap);
            if (width > containerWidth) break; // aggiungendo foto la larghezza cresce solo: oltre questo punto, sempre troppo larga
            const rowSize = j - i;
            const candidate = [dp[j].cost[0] + rowPenalty(rowSize), dp[j].cost[1] + 1];
            if (best === null || compareCost(candidate, best.cost) < 0) {
                best = { cost: candidate, next: j };
            }
        }
        // Non dovrebbe mai restare null: nel caso limite, una riga da
        // una sola foto è sempre una suddivisione valida.
        dp[i] = best;
    }

    const rows = [];
    let i = 0;
    while (i < n) {
        rows.push(items.slice(i, dp[i].next));
        i = dp[i].next;
    }
    return rows;
}

/**
 * Costruisce l'HTML di una singola riga, usando le stesse classi
 * CSS già presenti nel tuo sito (photo-container-frame, size-verticale
 * ecc.) — quindi lo stile visivo resta identico a quello attuale.
 *
 * Supporta anche i video: aggiungi `type: 'video'` all'oggetto media
 * (stesso formato delle foto, con src/alt/caption/orientation) e verrà
 * inserito con i controlli nativi al posto dell'immagine, mantenendo
 * la stessa cornice e dimensione in base all'orientamento.
 *
 * Supporta anche i video YouTube: `type: 'youtube'` + `videoId: '...'`
 * al posto di `src`. Mostra la miniatura ufficiale di YouTube con un
 * tasto play sopra; al click si apre un popup con il player incorporato
 * (richiede lo script di popup YouTube incluso nella pagina).
 */
function buildRowHTML(row) {
    const figures = row.map(media => {
        let mediaTag;
        if (media.type === 'youtube') {
            mediaTag = `<div class="youtube-trigger media-trigger" data-video-id="${media.videoId}">
                <img src="https://img.youtube.com/vi/${media.videoId}/hqdefault.jpg" alt="${escapeHtml(media.alt)}" loading="lazy">
                <span class="youtube-play-icon">&#9658;</span>
            </div>`;
        } else if (media.type === 'video') {
            mediaTag = `<video src="${media.src}" controls playsinline preload="metadata" class="media-trigger"></video>`;
        } else {
            mediaTag = `<img src="${media.src}" alt="${escapeHtml(media.alt)}" class="lightbox-trigger media-trigger" loading="lazy">`;
        }

        return `
        <figure class="photo-container-frame size-${media.orientation}">
            ${mediaTag}
            <figcaption class="photo-caption">${escapeHtml(media.caption)}</figcaption>
        </figure>`;
    }).join('');

    return `<div class="universal-flex-row">${figures}</div>`;
}

/**
 * Funzione principale: prende un selettore CSS del contenitore
 * (es. "#giorno1-foto") e la lista di foto, e inietta l'HTML
 * già impacchettato in righe.
 */
function renderPhotoDay(containerSelector, photos, opts = {}) {
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.warn(`renderPhotoDay: contenitore "${containerSelector}" non trovato`);
        return;
    }
    const rows = packPhotosIntoRows(photos, opts);
    container.innerHTML = rows.map(buildRowHTML).join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ------------------------------------------------
 * ESEMPIO D'USO (da mettere nella pagina del viaggio,
 * al posto del blocco scritto a mano):
 *
 * <div class="universal-media-wrapper">
 *     <div id="giorno1-foto"></div>
 * </div>
 *
 * <script src="auto-layout.js"></script>
 * <script>
 * renderPhotoDay('#giorno1-foto', [
 *     { src: 'ARIZONA25/FOTO/20250819_163549.jpg', alt: 'Pinnacle Peak Trail', caption: 'Pinnacle Peak Trail', orientation: 'verticale' },
 *     { src: 'ARIZONA25/FOTO/20250819_164436.jpg', alt: 'Pinnacle Peak Trail', caption: 'Pinnacle Peak Trail', orientation: 'verticale' },
 *     { src: 'ARIZONA25/FOTO/20250819_165348.jpg', alt: 'Pinnacle Peak Trail', caption: 'Pinnacle Peak Trail', orientation: 'orizzontale' },
 *     // ... aggiungi tutte le foto del giorno, in ordine cronologico
 * ]);
 * </script>
 * ------------------------------------------------ */
