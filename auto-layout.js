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
 * @param {number} opts.maxPerRow - foto massime per riga (default 5)
 * @param {number} opts.containerWidth - larghezza utile del contenitore in px
 *   (default 1000 in questa versione "temp": .timeline-container è stato
 *   allargato a 1160px, .day-content ora a piena larghezza senza colonna
 *   .day-sticky laterale, quindi c'è più spazio per riga)
 * @param {number} opts.gap - spazio tra le foto in px
 * @returns {Array<Array>} array di righe, ogni riga è un array di foto
 */
function packPhotosIntoRows(photos, opts = {}) {
    const {
        maxPerRow = 5,
        containerWidth = 1000,
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
 * Il valore 3 (invece di 2) evita anche i pareggi tipo "1+3" contro
 * "2+2": in quel caso entrambi davano lo stesso punteggio totale e
 * l'algoritmo poteva scegliere la combinazione con l'orfana solo
 * perché valutata per prima.
 */
function rowPenalty(size) {
    if (size === 1) return 3;
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
                <span class="youtube-play-icon"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
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

/**
 * Disegna una mini "mappa" del giorno in puro SVG (nessuna libreria
 * esterna): una striscia orizzontale con le tappe collegate da una
 * linea tratteggiata, ogni tappa è una miniatura circolare presa da
 * una foto reale di quel posto, con il nome sotto (ed eventualmente
 * città e stato, su righe separate).
 *
 * @param {string} containerSelector - es. "#giorno2-route"
 * @param {Array} stops - [{ nome, citta, stato, foto }, ...] in ordine
 *   cronologico.
 *   `nome` è sempre mostrato (es. "Cathedral Rock" o "Scottsdale").
 *   `citta` è opzionale: usala solo quando `nome` NON è già una città
 *   (es. "Cathedral Rock" -> citta: "Sedona"); se `nome` è già una
 *   città (es. "Scottsdale") ometti `citta`.
 *   `stato` è opzionale, mostrato come ultima riga (es. "Arizona").
 *   `foto` è il path della foto da usare come miniatura circolare
 *   (di solito la prima foto di quella tappa già usata più sotto
 *   nella pagina, così non serve caricare immagini in più).
 */
function renderDayRoute(containerSelector, stops) {
    const container = document.querySelector(containerSelector);
    if (!container || !stops || !stops.length) return;

    // Stima approssimativa della larghezza di una riga di testo (in px) in
    // base al numero di caratteri, per calcolare quanto margine laterale
    // serve ed evitare che i nomi più lunghi vengano tagliati ai bordi.
    function estimateLabelWidth(text, isSubLabel) {
        return text.length * (isSubLabel ? 7.65 : 8.55); // ricalibrato per il font ancora più grande (14px / 12px)
    }

    // Le righe di testo di una tappa: nome (sempre), poi eventualmente
    // città e stato, su righe separate sotto.
    function stopLines(stop) {
        const lines = [{ text: stop.nome, sub: false }];
        if (stop.citta) lines.push({ text: stop.citta, sub: true });
        if (stop.stato) lines.push({ text: stop.stato, sub: true });
        return lines;
    }

    const radius = 28;     // raggio del cerchio miniatura
    const cy = 34;          // altezza verticale del centro dei cerchi
    const lineHeight = 18;  // spazio verticale tra una riga di etichetta e la successiva (aumentato per il font più grande)

    // La larghezza massima di una riga di testo (nome, città o stato) tra
    // tutte le tappe: serve sia per il margine laterale (prima/ultima tappa)
    // sia per la distanza tra una tappa e la successiva, altrimenti i nomi
    // più lunghi si sovrappongono a quelli delle tappe vicine.
    const maxLabelFullWidth = Math.max(...stops.map(s =>
        Math.max(...stopLines(s).map(l => estimateLabelWidth(l.text, l.sub)))
    ));

    // Distanza orizzontale tra una tappa e la successiva: mai sotto i 150px,
    // ma cresce se serve più spazio per non far toccare i testi adiacenti.
    const spacing = Math.max(150, maxLabelFullWidth + 30);

    // Il margine laterale deve essere abbastanza largo da contenere metà
    // della riga più lunga, altrimenti la prima/ultima tappa vengono
    // tagliate ai bordi.
    const padding = Math.max(40, maxLabelFullWidth / 2 + 10);

    const width = padding * 2 + spacing * (stops.length - 1);
    // Altezza fissa (sempre spazio per 3 righe: nome + città + stato), così
    // tutte le mini-mappe del sito restano della stessa dimensione anche
    // quando alcune tappe hanno meno righe di altre.
    const height = 98 + 2 * lineHeight;

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Linea tratteggiata che collega tutte le tappe
    if (stops.length > 1) {
        const points = stops.map((s, i) => `${padding + i * spacing},${cy}`).join(' ');
        svg += `<polyline class="day-route-line" points="${points}"/>`;
    }

    stops.forEach((stop, i) => {
        const cx = padding + i * spacing;
        const clipId = `route-clip-${containerSelector.replace('#', '')}-${i}`;
        // Se non c'è una foto tua (stop.foto), usiamo un id univoco sull'<image>
        // così, se serve, possiamo aggiornarla in un secondo momento pescandola
        // da Wikipedia (vedi sotto la foreach).
        const imgId = `route-img-${containerSelector.replace('#', '')}-${i}`;
        const lines = stopLines(stop);
        const firstLineY = cy + radius + 16;
        const linesHtml = lines.map((l, li) => {
            const cls = li === 0 ? 'day-route-label' : 'day-route-sublabel';
            const y = firstLineY + li * lineHeight;
            return `<text class="${cls}" x="${cx}" y="${y}" text-anchor="middle">${escapeHtml(l.text)}</text>`;
        }).join('');
        svg += `
            <g class="day-route-stop">
                <clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${radius - 2}"/></clipPath>
                <image id="${imgId}" href="${stop.foto || ''}" x="${cx - radius + 2}" y="${cy - radius + 2}" width="${(radius - 2) * 2}" height="${(radius - 2) * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
                <circle class="day-route-ring" cx="${cx}" cy="${cy}" r="${radius}"/>
                ${linesHtml}
            </g>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;

    // Per le tappe senza foto tua ma con `wiki: 'Nome pagina Wikipedia'`,
    // recuperiamo una foto ufficiale (Wikimedia Commons, licenza libera)
    // e la inseriamo appena arriva, senza bloccare il resto del rendering.
    stops.forEach((stop, i) => {
        if (stop.foto || !stop.wiki) return;
        const imgId = `route-img-${containerSelector.replace('#', '')}-${i}`;
        fetchWikiThumb(stop.wiki).then(url => {
            if (!url) return;
            const el = document.getElementById(imgId);
            if (el) el.setAttribute('href', url);
        });
    });
}

/**
 * Recupera l'immagine di anteprima ufficiale (Wikimedia Commons,
 * licenza libera) di una pagina Wikipedia, tramite l'API pubblica.
 * Usata da renderDayRoute() per le tappe senza una foto tua.
 */
function fetchWikiThumb(pageTitle) {
    return fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(pageTitle))
        .then(resp => resp.ok ? resp.json() : null)
        .then(data => (data && data.thumbnail && data.thumbnail.source) ? data.thumbnail.source : null)
        .catch(() => null);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Fa "vivere" il banner a mosaico in cima alla pagina: raccoglie
 * automaticamente tutte le foto già usate nei vari giorni (tramite
 * renderPhotoDay) e, ogni tot secondi, sostituisce con una dissolvenza
 * una delle miniature del mosaico con una nuova foto pescata a caso
 * dal mazzo — così il banner cambia combinazione nel tempo invece di
 * restare fisso sulle stesse 5 foto.
 *
 * Ogni tassello ha un attributo data-orientation="verticale"|"orizzontale"
 * nell'HTML (in base alla sua forma nella griglia): le foto pescate per
 * quel tassello vengono sempre dal mazzo con lo stesso orientamento,
 * così le verticali non vengono più tagliate in tasselli larghi e stretti
 * pensati per le orizzontali (le panoramiche vengono trattate come
 * orizzontali, essendo comunque foto larghe).
 *
 * IMPORTANTE: va chiamata DOPO tutti i renderPhotoDay() della pagina,
 * altrimenti non trova ancora le foto nel DOM da cui pescare.
 *
 * @param {string} bannerSelector - es. ".trip-banner" (il contenitore del banner)
 * @param {number} intervalMs - ogni quanto cambia una foto (default 6000ms)
 */
function initTripBannerMosaic(bannerSelector, intervalMs = 6000) {
    const banner = document.querySelector(bannerSelector);
    if (!banner) return;

    const tileEls = Array.from(banner.querySelectorAll('.trip-banner-tile'));
    if (!tileEls.length) return;

    // Raccoglie le foto reali già usate nei giorni, divise per orientamento
    // (letto dalla classe size-verticale/size-orizzontale/size-panoramica
    // impostata da buildRowHTML in base a photo.orientation).
    const pools = { verticale: [], orizzontale: [] };
    const seen = new Set();

    document.querySelectorAll('.photo-container-frame img.lightbox-trigger').forEach(img => {
        const src = img.getAttribute('src');
        if (!src || seen.has(src)) return;
        seen.add(src);
        const frame = img.closest('.photo-container-frame');
        const isVerticale = frame && frame.classList.contains('size-verticale');
        // Le panoramiche (larghe) vanno nel mazzo "orizzontale" insieme alle orizzontali normali
        pools[isVerticale ? 'verticale' : 'orizzontale'].push(src);
    });

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Una coda mescolata per ciascun orientamento
    const queues = {
        verticale: shuffle(pools.verticale),
        orizzontale: shuffle(pools.orizzontale)
    };
    const queueIndex = { verticale: 0, orizzontale: 0 };

    function nextPhoto(orientation) {
        const pool = pools[orientation];
        if (!pool || pool.length < 2) return null; // non abbastanza foto di quel formato
        if (queueIndex[orientation] >= queues[orientation].length) {
            queues[orientation] = shuffle(pool);
            queueIndex[orientation] = 0;
        }
        return queues[orientation][queueIndex[orientation]++];
    }

    // Le immagini attualmente mostrate in ciascun tassello, per evitare doppioni contemporanei
    const currentlyShown = new Set(tileEls.map(t => t.querySelector('img').getAttribute('src')));

    // Solo i tasselli il cui mazzo ha abbastanza foto da poter davvero alternare
    const animatableTiles = tileEls.filter(t => {
        const orientation = t.dataset.orientation === 'verticale' ? 'verticale' : 'orizzontale';
        return pools[orientation] && pools[orientation].length >= 2;
    });
    if (!animatableTiles.length) return;

    function swapRandomTile() {
        const tile = animatableTiles[Math.floor(Math.random() * animatableTiles.length)];
        const img = tile.querySelector('img');
        const orientation = tile.dataset.orientation === 'verticale' ? 'verticale' : 'orizzontale';

        // Pesca una foto dello stesso formato del tassello, non già visibile altrove nel mosaico
        let candidate = nextPhoto(orientation);
        let attempts = 0;
        while (candidate && currentlyShown.has(candidate) && attempts < pools[orientation].length) {
            candidate = nextPhoto(orientation);
            attempts++;
        }
        if (!candidate) return;

        const preload = new Image();
        preload.onload = () => {
            currentlyShown.delete(img.getAttribute('src'));
            img.style.opacity = '0';
            setTimeout(() => {
                img.setAttribute('src', candidate);
                currentlyShown.add(candidate);
                // Riavvia l'animazione Ken Burns da capo per la nuova foto
                img.style.animation = 'none';
                void img.offsetWidth; // forza il reflow
                img.style.animation = '';
                img.style.opacity = '1';
            }, 400);
        };
        preload.src = candidate;
    }

    setInterval(swapRandomTile, intervalMs);
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
