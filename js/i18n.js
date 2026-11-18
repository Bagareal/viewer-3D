// Interface texts: French, English, Italian.
export const LANGS = { fr: 'Français', en: 'English', it: 'Italiano' };

const T = {
fr: {
  tabTools: 'Outils', tabHelp: 'Mode d’emploi',
  sFile: 'Fichier', sFrame: 'Cadrage', sProduct: 'Position du produit', sParts: 'Éléments', sLook: 'Rendu',
  noModel: 'Aucun modèle chargé', load: 'Charger un fichier 3D', loadOther: 'Charger un autre fichier', loadHint: 'STEP, IGES, GLB, OBJ, STL. Le fichier reste sur votre ordinateur.',
  dropTitle: 'Glissez un fichier 3D ici', dropSub: 'STEP · IGES · GLB · OBJ · STL', dropPrivacy: 'Le fichier reste sur votre ordinateur : rien n’est envoyé en ligne.', choose: 'Choisir un fichier', dropNow: 'Déposez le fichier pour l’ouvrir',
  nav: 'Clic gauche : tourner · Molette : zoomer · Clic droit : déplacer · Clic sur une pièce : la retrouver dans la liste',
  views: 'Vues rapides', presets: ['Face', '3/4 gauche', '3/4 droite', 'Profil', 'Plongée', 'Contre-plongée', 'Arrière'],
  focal: 'Focale', focalHint: '24 mm : grand angle, perspective forte. 85–105 mm : perspective écrasée.',
  ratio: 'Format de l’image', ratioFree: 'Libre', ratioHint: 'Le cadre à l’écran montre exactement ce qui sera enregistré.',
  saved: 'Vues enregistrées', viewName: 'Nom de la vue', viewSave: 'Enregistrer', viewNone: 'Aucune vue enregistrée. Enregistrez un cadrage pour le réutiliser sur d’autres produits.', viewExport: 'Exporter', viewImport: 'Importer', viewAuto: 'Vue', viewDel: 'Supprimer', viewBad: 'Ce fichier ne contient pas de vues valides.',
  front: 'Face avant', frontBtn: 'C’est la face avant', frontHint: 'Tournez la caméra jusqu’à voir l’avant du produit, droit, puis cliquez. La position est mémorisée pour ce nom de fichier, dans ce navigateur.', orientReset: 'Orientation d’origine',
  turn: 'Redresser de 90°', turnHint: 'Si le produit arrive couché. Mémorisé aussi pour ce fichier.', drag: 'Le clic gauche fait tourner', dragOrbit: 'La caméra', dragHint: 'X, Y ou Z : le produit tourne sur cet axe seulement (Z = vertical).', reset: 'Réinitialiser',
  cube: { front: 'Avant', back: 'Arrière', left: 'Gauche', right: 'Droite', top: 'Dessus', bottom: 'Dessous' },
  partsFilter: 'Rechercher un élément…', showAll: 'Tout afficher', expand: 'Tout déplier', collapse: 'Tout replier', partsHint: 'Décochez pour masquer. « Seul » isole un élément. Survolez un nom pour le repérer sur le modèle.', partsEmpty: 'Aucun modèle chargé', solo: 'Seul', exMark: 'Éclater cet élément',
  explode: 'Vue éclatée', expAll: 'Tous les éléments', expSel: 'Éléments choisis', expHint: 'En mode « Éléments choisis », cliquez ✦ dans la liste sur les pièces à écarter.',
  style: 'Type d’image', stShaded: 'Rendu', stDepth: 'Profondeur', stLines: 'Traits', styleHint: 'Profondeur et Traits servent de guides précis pour la génération d’images par IA.',
  colors: 'Couleurs', colGrey: 'Gris neutre', colOrig: 'Du fichier',
  bg: 'Fond', bgGrey: 'Gris', bgWhite: 'Blanc', bgNone: 'Transparent', floor: 'Afficher le sol',
  size: 'Côté long', save: 'Enregistrer l’image', saveHint: 'JPEG, ou PNG pour le fond transparent, la profondeur et les traits.', savedMsg: 'Enregistré : ', view: 'vue',
  sMove: 'Mouvements de caméra', moveKeys: 'Images clés', moveInfo: '{n} images à exporter, {c} clip(s) vidéo de la première à la dernière image.', moveDetail: 'Détail visé (cliquez une pièce sur le modèle) : ', moveCentre: 'centre du produit', movePart: 'pièce sans nom',
  movePlay: 'Aperçu', moveStop: 'Arrêter', moveExport: 'Exporter les images', moveDone: '{n} images et le fichier des prompts téléchargés.',
  moveHint: '0° = vue de face : redressez d’abord le produit (section 3). Choisissez le format avant (ex. 16:9) : la vidéo reprend celui de la première image. Le type d’image de la section 5 vaut pour toutes les images.',
  'mv_ORB-S': 'Orbite courte', 'mvd_ORB-S': 'Tourne de 60° devant le produit. Convient à tous les produits.',
  'mv_ORB-34': 'De 3/4 à face', 'mvd_ORB-34': 'De la vue 3/4 droite à la face. Machines à café, robots, fers.',
  'mv_ORB-180': 'Arrière → face', 'mvd_ORB-180': 'Demi-tour de l’arrière à la face, en deux clips de 90°. Produits de plan de travail.',
  mv_PUSH: 'Approche', mvd_PUSH: 'Du produit entier à un gros plan sur le détail. Bec verseur, écran, fond de poêle.',
  mv_PULL: 'Recul', mvd_PULL: 'Du gros plan sur le détail au produit entier dans le décor.',
  mv_CRANE: 'Montée', mvd_CRANE: 'La caméra monte le long du produit, de la base au sommet. Aspirateurs balais, produits hauts.',
  mv_TOP: 'Du dessus à 3/4', mvd_TOP: 'D’une vue du dessus, descend en 3/4. Poêles, casseroles, paniers ouverts.',
  mv_TRUCK: 'Travelling latéral', mvd_TRUCK: 'La caméra glisse sur le côté, parallèle au produit (côté long face à la caméra). Fers, produits allongés, poêles alignées.',
  mv_HERO: 'Contre-plongée', mvd_HERO: 'Depuis le bas, la caméra s’approche en montant un peu : le produit paraît imposant. Machines à café, aspirateurs.',
  mv_ARC: 'Arc descendant', mvd_ARC: 'Tourne autour du produit en descendant de la plongée à la hauteur du produit, en deux clips.',
  bigTitle: 'Fichier STEP volumineux', bigSize: 'Ce fichier fait {mb} Mo.', bigTip: 'Au-delà de ~100 Mo, le navigateur manque souvent de mémoire pour lire un STEP. Conseil : convertissez-le d’abord en GLB (avec un autre logiciel ou une IA) en gardant les pièces séparées, puis chargez le GLB.', bigGo: 'Essayer quand même', bigNo: 'Annuler',
  oom: 'mémoire du navigateur insuffisante pour ce STEP. Convertissez-le d’abord en GLB (avec un autre logiciel ou une IA), puis chargez le GLB.',
  opening: 'Ouverture de ', prep: 'Préparation du lecteur STEP…', conv: 'Conversion en cours…', failTitle: 'Impossible d’ouvrir le fichier', unsup: 'Format non pris en charge.', empty: 'Aucune géométrie trouvée dans le fichier.', gltfExt: 'Ce .gltf dépend de fichiers séparés. Utilisez plutôt un .glb, qui contient tout.', retry: 'Choisir un autre fichier',
  help: `<div><h3>1. Charger un fichier</h3><p>Bouton <b>Charger un fichier 3D</b> ou glisser-déposer dans la fenêtre. Formats : STEP / STP, IGES, GLB / GLTF, OBJ, STL.</p><p>Le fichier est lu par votre navigateur et reste sur votre ordinateur : rien n’est envoyé en ligne.</p><p><b>STEP jusqu’à ~100 Mo.</b> Au-delà, convertissez-le d’abord en <b>GLB</b> (avec un autre logiciel ou une IA) en gardant les pièces séparées.</p></div>
<div><h3>2. Se déplacer</h3><ul><li><b>Clic gauche</b> maintenu : tourner autour du produit</li><li><b>Molette</b> : zoomer</li><li><b>Clic droit</b> (ou molette enfoncée) maintenu : déplacer la vue</li><li><b>Clic sur une pièce</b> : elle est repérée dans la liste Éléments</li><li><b>Cube en haut à droite</b> : cliquez une face, une arête ou un coin pour voir le produit de ce côté. Les axes suivent la convention CAO (Z = vertical)</li></ul></div>
<div><h3>3. Cadrer</h3><ul><li><b>Vues rapides</b> : face, 3/4, profil, plongée…</li><li><b>Focale</b> : 24 mm = grand angle ; 85–105 mm = téléobjectif</li><li><b>Format de l’image</b> : 1:1, 4:5, 16:9… Le cadre à l’écran montre exactement ce qui sera enregistré</li><li><b>Vues enregistrées</b> : gardez un cadrage et réappliquez-le à un autre produit pour des séries cohérentes. <b>Exporter</b> / <b>Importer</b> pour les partager</li></ul></div>
<div><h3>4. Positionner le produit</h3><ul><li><b>C’est la face avant</b> : tournez la caméra jusqu’à voir l’avant du produit, droit, puis cliquez ; le fichier s’ouvrira ensuite déjà droit</li><li><b>Redresser de 90°</b> si le produit arrive couché</li><li><b>Le clic gauche fait tourner</b> : la caméra, ou le produit sur un seul axe ; <b>Réinitialiser</b> le remet comme au départ</li></ul></div>
<div><h3>5. Choisir les éléments</h3><p>Décochez une pièce pour la masquer, <b>Seul</b> pour ne garder qu’elle, <b>Tout afficher</b> pour revenir. La recherche filtre la liste par nom.</p><p><b>Vue éclatée</b> : le curseur écarte les pièces du centre. <b>Éléments choisis</b> n’écarte que les pièces marquées ✦.</p></div>
<div><h3>6. Choisir le rendu</h3><ul><li><b>Rendu</b> : l’image ombrée, en gris neutre ou avec les couleurs du fichier</li><li><b>Profondeur</b> : carte de profondeur (blanc = proche, noir = loin)</li><li><b>Traits</b> : dessin au trait des contours</li><li><b>Fond transparent</b> : PNG détouré, sans sol</li></ul></div>
<div><h3>7. Enregistrer</h3><p><b>Enregistrer l’image</b> télécharge ce qui est dans le cadre, à la taille choisie.</p></div>
<div><h3>8. Mouvements de caméra</h3><p>Pour la vidéo IA. Redressez d’abord le produit (0° = vue de face) et choisissez le format (ex. 16:9). Choisissez un mouvement : il se joue tout de suite (<b>Aperçu</b> pour le revoir). Vérifiez les images clés avec 1, 2, 3, puis <b>Exporter les images</b> : les images clés et un fichier <b>_seedance.txt</b> avec un clip première → dernière image par paire et son prompt. Pour <b>Approche</b> et <b>Recul</b>, cliquez d’abord la pièce à viser.</p></div>
<div><h3>Astuce</h3><p>Donnez à l’IA l’image comme référence de position et de perspective, et à côté une vraie photo du produit pour les couleurs et les matières.</p></div>`
},
en: {
  tabTools: 'Tools', tabHelp: 'How to use',
  sFile: 'File', sFrame: 'Framing', sProduct: 'Product position', sParts: 'Parts', sLook: 'Look',
  noModel: 'No model loaded', load: 'Load a 3D file', loadOther: 'Load another file', loadHint: 'STEP, IGES, GLB, OBJ, STL. The file stays on your computer.',
  dropTitle: 'Drop a 3D file here', dropSub: 'STEP · IGES · GLB · OBJ · STL', dropPrivacy: 'The file stays on your computer: nothing is sent online.', choose: 'Choose a file', dropNow: 'Drop the file to open it',
  nav: 'Left drag: orbit · Wheel: zoom · Right drag: pan · Click a part: find it in the list',
  views: 'Quick views', presets: ['Front', '3/4 left', '3/4 right', 'Side', 'High angle', 'Low angle', 'Back'],
  focal: 'Focal length', focalHint: '24 mm: wide angle, strong perspective. 85–105 mm: flattened perspective.',
  ratio: 'Image format', ratioFree: 'Free', ratioHint: 'The frame on screen shows exactly what will be saved.',
  saved: 'Saved views', viewName: 'View name', viewSave: 'Save view', viewNone: 'No saved views. Save a framing to reuse it on other products.', viewExport: 'Export', viewImport: 'Import', viewAuto: 'View', viewDel: 'Delete', viewBad: 'This file does not contain valid views.',
  front: 'Front', frontBtn: 'This is the front', frontHint: 'Turn the camera until you see the front of the product, upright, then click. Remembered for this file name, in this browser.', orientReset: 'Original orientation',
  turn: 'Turn by 90°', turnHint: 'If the product comes in lying down. Also remembered for this file.', drag: 'Left drag turns', dragOrbit: 'The camera', dragHint: 'X, Y or Z: the product turns on that axis only (Z = vertical).', reset: 'Reset',
  cube: { front: 'Front', back: 'Back', left: 'Left', right: 'Right', top: 'Top', bottom: 'Bottom' },
  partsFilter: 'Search a part…', showAll: 'Show all', expand: 'Expand all', collapse: 'Collapse all', partsHint: 'Untick to hide. “Solo” isolates a part. Hover a name to spot it on the model.', partsEmpty: 'No model loaded', solo: 'Solo', exMark: 'Explode this part',
  explode: 'Exploded view', expAll: 'All parts', expSel: 'Chosen parts', expHint: 'In “Chosen parts” mode, click ✦ in the list on the parts to move apart.',
  style: 'Image type', stShaded: 'Render', stDepth: 'Depth', stLines: 'Lines', styleHint: 'Depth and Lines are precise guides for AI image generation.',
  colors: 'Colours', colGrey: 'Neutral grey', colOrig: 'From the file',
  bg: 'Background', bgGrey: 'Grey', bgWhite: 'White', bgNone: 'Transparent', floor: 'Show the floor',
  size: 'Long side', save: 'Save the image', saveHint: 'JPEG, or PNG for transparent background, depth and lines.', savedMsg: 'Saved: ', view: 'view',
  sMove: 'Camera moves', moveKeys: 'Keyframes', moveInfo: '{n} frames to export, {c} video clip(s) from first to last frame.', moveDetail: 'Detail aimed at (click a part on the model): ', moveCentre: 'centre of the product', movePart: 'unnamed part',
  movePlay: 'Preview', moveStop: 'Stop', moveExport: 'Export the frames', moveDone: '{n} frames and the prompt file downloaded.',
  moveHint: '0° = front view: straighten the product first (section 3). Choose the image format first (e.g. 16:9): the video takes the format of the first frame. The image type in section 5 applies to all frames.',
  'mv_ORB-S': 'Short orbit', 'mvd_ORB-S': 'Turns 60° in front of the product. Works for every product.',
  'mv_ORB-34': '3/4 to front', 'mvd_ORB-34': 'From the 3/4 right view to the front. Coffee machines, food processors, irons.',
  'mv_ORB-180': 'Back → front', 'mvd_ORB-180': 'Half turn from the back to the front, in two 90° clips. Countertop products.',
  mv_PUSH: 'Push in', mvd_PUSH: 'From the whole product to a close-up of the detail. Spout, display, bottom of a pan.',
  mv_PULL: 'Pull back', mvd_PULL: 'From the close-up of the detail to the whole product in its setting.',
  mv_CRANE: 'Crane up', mvd_CRANE: 'The camera rises along the product, from the base to the top. Stick vacuums, tall products.',
  mv_TOP: 'Top to 3/4', mvd_TOP: 'From a top-down view, comes down to 3/4. Pans, pots, open baskets.',
  mv_TRUCK: 'Side tracking', mvd_TRUCK: 'The camera slides sideways, parallel to the product (long side facing the camera). Irons, long products, pans in a row.',
  mv_HERO: 'Low hero', mvd_HERO: 'From below, the camera comes closer while rising a little: the product looks imposing. Coffee machines, vacuums.',
  mv_ARC: 'Descending arc', mvd_ARC: 'Turns around the product while coming down from a high angle to product height, in two clips.',
  bigTitle: 'Large STEP file', bigSize: 'This file is {mb} MB.', bigTip: 'Above ~100 MB the browser often runs out of memory reading a STEP. Tip: first convert it to GLB (with another program or an AI), keeping the parts separate, then load the GLB.', bigGo: 'Try anyway', bigNo: 'Cancel',
  oom: 'not enough browser memory for this STEP. First convert it to GLB (with another program or an AI), then load the GLB.',
  opening: 'Opening ', prep: 'Preparing the STEP reader…', conv: 'Converting…', failTitle: 'Could not open the file', unsup: 'Unsupported format.', empty: 'No geometry found in the file.', gltfExt: 'This .gltf depends on separate files. Use a .glb instead, which contains everything.', retry: 'Choose another file',
  help: `<div><h3>1. Load a file</h3><p><b>Load a 3D file</b> button, or drag and drop onto the window. Formats: STEP / STP, IGES, GLB / GLTF, OBJ, STL.</p><p>The file is read by your browser and stays on your computer: nothing is sent online.</p><p><b>STEP up to ~100 MB.</b> Above that, first convert it to <b>GLB</b> (with another program or an AI), keeping the parts separate.</p></div>
<div><h3>2. Move around</h3><ul><li>Hold <b>left click</b>: orbit around the product</li><li><b>Scroll wheel</b>: zoom</li><li>Hold <b>right click</b> (or the wheel button): pan the view</li><li><b>Click a part</b>: it is located in the Parts list</li><li><b>Cube at the top right</b>: click a face, an edge or a corner to look at the product from that side. The axes follow the CAD convention (Z = vertical)</li></ul></div>
<div><h3>3. Frame the shot</h3><ul><li><b>Quick views</b>: front, 3/4, side, high angle…</li><li><b>Focal length</b>: 24 mm = wide angle; 85–105 mm = telephoto</li><li><b>Image format</b>: 1:1, 4:5, 16:9… The frame on screen shows exactly what will be saved</li><li><b>Saved views</b>: keep a framing and apply it to another product for consistent series. <b>Export</b> / <b>Import</b> to share them</li></ul></div>
<div><h3>4. Position the product</h3><ul><li><b>This is the front</b>: turn the camera until you see the front of the product, upright, then click; the file will then open upright</li><li><b>Turn by 90°</b> if the product comes in lying down</li><li><b>Left drag turns</b>: the camera, or the product on one axis only; <b>Reset</b> puts it back as it was</li></ul></div>
<div><h3>5. Pick the parts</h3><p>Untick a part to hide it, <b>Solo</b> to keep only that one, <b>Show all</b> to go back. The search box filters the list by name.</p><p><b>Exploded view</b>: the slider moves parts away from the centre. <b>Chosen parts</b> only moves the parts marked ✦.</p></div>
<div><h3>6. Choose the look</h3><ul><li><b>Render</b>: the shaded image, in neutral grey or with the file's colours</li><li><b>Depth</b>: depth map (white = near, black = far)</li><li><b>Lines</b>: line drawing of the outlines</li><li><b>Transparent background</b>: cut-out PNG, without the floor</li></ul></div>
<div><h3>7. Save</h3><p><b>Save the image</b> downloads what is inside the frame, at the chosen size.</p></div>
<div><h3>8. Camera moves</h3><p>For AI video. First straighten the product (0° = front view) and choose the format (e.g. 16:9). Pick a move: it plays at once (<b>Preview</b> to play it again). Check the keyframes with 1, 2, 3, then <b>Export the frames</b>: the keyframes and a <b>_seedance.txt</b> file with one first → last frame clip per pair and its prompt. For <b>Push in</b> and <b>Pull back</b>, first click the part to aim at.</p></div>
<div><h3>Tip</h3><p>Give the AI the image as a position and perspective reference, and alongside it a real photo of the product for colours and materials.</p></div>`
},
it: {
  tabTools: 'Strumenti', tabHelp: 'Guida',
  sFile: 'File', sFrame: 'Inquadratura', sProduct: 'Posizione del prodotto', sParts: 'Elementi', sLook: 'Aspetto',
  noModel: 'Nessun modello caricato', load: 'Carica un file 3D', loadOther: 'Carica un altro file', loadHint: 'STEP, IGES, GLB, OBJ, STL. Il file resta sul tuo computer.',
  dropTitle: 'Trascina qui un file 3D', dropSub: 'STEP · IGES · GLB · OBJ · STL', dropPrivacy: 'Il file resta sul tuo computer: niente viene inviato online.', choose: 'Scegli un file', dropNow: 'Rilascia il file per aprirlo',
  nav: 'Tasto sinistro: ruota · Rotella: zoom · Tasto destro: sposta · Clic su un pezzo: lo trova nella lista',
  views: 'Viste rapide', presets: ['Fronte', '3/4 sinistra', '3/4 destra', 'Profilo', 'Dall’alto', 'Dal basso', 'Retro'],
  focal: 'Focale', focalHint: '24 mm: grandangolo, prospettiva forte. 85–105 mm: prospettiva schiacciata.',
  ratio: 'Formato dell’immagine', ratioFree: 'Libero', ratioHint: 'La cornice a schermo mostra esattamente ciò che verrà salvato.',
  saved: 'Viste salvate', viewName: 'Nome della vista', viewSave: 'Salva vista', viewNone: 'Nessuna vista salvata. Salva un’inquadratura per riusarla su altri prodotti.', viewExport: 'Esporta', viewImport: 'Importa', viewAuto: 'Vista', viewDel: 'Elimina', viewBad: 'Questo file non contiene viste valide.',
  front: 'Fronte', frontBtn: 'Questa è la fronte', frontHint: 'Gira la camera finché vedi il davanti del prodotto, dritto, poi clicca. Viene ricordato per questo nome di file, in questo browser.', orientReset: 'Orientamento originale',
  turn: 'Raddrizza di 90°', turnHint: 'Se il prodotto arriva coricato. Ricordato anche questo per il file.', drag: 'Il tasto sinistro fa ruotare', dragOrbit: 'La camera', dragHint: 'X, Y o Z: il prodotto ruota solo su quell’asse (Z = verticale).', reset: 'Reimposta',
  cube: { front: 'Fronte', back: 'Retro', left: 'Sinistra', right: 'Destra', top: 'Sopra', bottom: 'Sotto' },
  partsFilter: 'Cerca un elemento…', showAll: 'Mostra tutto', expand: 'Espandi tutto', collapse: 'Comprimi tutto', partsHint: 'Togli la spunta per nascondere. «Solo» isola un elemento. Passa sopra un nome per individuarlo sul modello.', partsEmpty: 'Nessun modello caricato', solo: 'Solo', exMark: 'Esplodi questo elemento',
  explode: 'Vista esplosa', expAll: 'Tutti gli elementi', expSel: 'Elementi scelti', expHint: 'In modalità «Elementi scelti», clicca ✦ nella lista sui pezzi da allontanare.',
  style: 'Tipo di immagine', stShaded: 'Render', stDepth: 'Profondità', stLines: 'Linee', styleHint: 'Profondità e Linee sono guide precise per la generazione di immagini con IA.',
  colors: 'Colori', colGrey: 'Grigio neutro', colOrig: 'Del file',
  bg: 'Sfondo', bgGrey: 'Grigio', bgWhite: 'Bianco', bgNone: 'Trasparente', floor: 'Mostra il pavimento',
  size: 'Lato lungo', save: 'Salva l’immagine', saveHint: 'JPEG, oppure PNG per sfondo trasparente, profondità e linee.', savedMsg: 'Salvato: ', view: 'vista',
  sMove: 'Movimenti camera', moveKeys: 'Fotogrammi chiave', moveInfo: '{n} frame da esportare, {c} clip video dal primo all’ultimo frame.', moveDetail: 'Dettaglio inquadrato (clicca un pezzo sul modello): ', moveCentre: 'centro del prodotto', movePart: 'pezzo senza nome',
  movePlay: 'Anteprima', moveStop: 'Ferma', moveExport: 'Esporta i frame', moveDone: '{n} frame e il file dei prompt scaricati.',
  moveHint: '0° = vista Fronte: prima raddrizza il prodotto (sezione 3). Scegli prima il formato (es. 16:9): il video prende quello del primo frame. Il tipo di immagine della sezione 5 vale per tutti i frame.',
  'mv_ORB-S': 'Orbita corta', 'mvd_ORB-S': 'Gira di 60° davanti al prodotto. Va bene per tutti i prodotti.',
  'mv_ORB-34': 'Da 3/4 a fronte', 'mvd_ORB-34': 'Dalla vista 3/4 destra al fronte. Macchine da caffè, robot da cucina, ferri da stiro.',
  'mv_ORB-180': 'Retro → fronte', 'mvd_ORB-180': 'Mezzo giro dal retro al fronte, in due clip da 90°. Prodotti da piano di lavoro.',
  mv_PUSH: 'Avvicinamento', mvd_PUSH: 'Dal prodotto intero a un primo piano del dettaglio. Erogatore, display, fondo della padella.',
  mv_PULL: 'Allontanamento', mvd_PULL: 'Dal primo piano del dettaglio al prodotto intero nella scena.',
  mv_CRANE: 'Salita', mvd_CRANE: 'La camera sale lungo il prodotto, dalla base alla cima. Aspirapolvere scopa, prodotti alti.',
  mv_TOP: 'Dall’alto a 3/4', mvd_TOP: 'Da una vista dall’alto scende a 3/4. Padelle, pentole, cestelli aperti.',
  mv_TRUCK: 'Carrellata laterale', mvd_TRUCK: 'La camera scorre di lato, parallela al prodotto (lato lungo verso la camera). Ferri da stiro, prodotti allungati, padelle in fila.',
  mv_HERO: 'Hero dal basso', mvd_HERO: 'Dal basso, la camera si avvicina salendo un po’: il prodotto sembra imponente. Macchine da caffè, aspirapolvere.',
  mv_ARC: 'Arco in discesa', mvd_ARC: 'Gira attorno al prodotto scendendo dall’alto all’altezza del prodotto, in due clip.',
  bigTitle: 'File STEP molto grande', bigSize: 'Questo file pesa {mb} MB.', bigTip: 'Oltre ~100 MB il browser spesso non ha abbastanza memoria per leggere uno STEP. Consiglio: convertilo prima in GLB (con un altro programma o un’IA) tenendo i pezzi separati, poi carica il GLB.', bigGo: 'Prova comunque', bigNo: 'Annulla',
  oom: 'memoria del browser insufficiente per questo STEP. Convertilo prima in GLB (con un altro programma o un’IA), poi carica il GLB.',
  opening: 'Apertura di ', prep: 'Preparazione del lettore STEP…', conv: 'Conversione in corso…', failTitle: 'Impossibile aprire il file', unsup: 'Formato non supportato.', empty: 'Nessuna geometria trovata nel file.', gltfExt: 'Questo .gltf dipende da file separati. Usa invece un .glb, che contiene tutto.', retry: 'Scegli un altro file',
  help: `<div><h3>1. Caricare un file</h3><p>Pulsante <b>Carica un file 3D</b> oppure trascina il file nella finestra. Formati: STEP / STP, IGES, GLB / GLTF, OBJ, STL.</p><p>Il file viene letto dal browser e resta sul tuo computer: niente viene inviato online.</p><p><b>STEP fino a ~100 MB.</b> Oltre, convertilo prima in <b>GLB</b> (con un altro programma o un’IA) tenendo i pezzi separati.</p></div>
<div><h3>2. Muoversi</h3><ul><li><b>Tasto sinistro</b> premuto: ruotare attorno al prodotto</li><li><b>Rotella</b>: zoom</li><li><b>Tasto destro</b> (o rotella premuta): spostare la vista</li><li><b>Clic su un pezzo</b>: viene individuato nella lista Elementi</li><li><b>Cubo in alto a destra</b>: clicca una faccia, uno spigolo o un angolo per vedere il prodotto da quel lato. Gli assi seguono la convenzione CAD (Z = verticale)</li></ul></div>
<div><h3>3. Inquadrare</h3><ul><li><b>Viste rapide</b>: fronte, 3/4, profilo, dall’alto…</li><li><b>Focale</b>: 24 mm = grandangolo; 85–105 mm = teleobiettivo</li><li><b>Formato dell’immagine</b>: 1:1, 4:5, 16:9… La cornice a schermo mostra esattamente ciò che verrà salvato</li><li><b>Viste salvate</b>: conserva un’inquadratura e riapplicala a un altro prodotto per serie coerenti. <b>Esporta</b> / <b>Importa</b> per condividerle</li></ul></div>
<div><h3>4. Posizionare il prodotto</h3><ul><li><b>Questa è la fronte</b>: gira la camera finché vedi il davanti del prodotto, dritto, poi clicca; il file poi si aprirà già dritto</li><li><b>Raddrizza di 90°</b> se il prodotto arriva coricato</li><li><b>Il tasto sinistro fa ruotare</b>: la camera, oppure il prodotto su un solo asse; <b>Reimposta</b> lo riporta com’era</li></ul></div>
<div><h3>5. Scegliere gli elementi</h3><p>Togli la spunta a un pezzo per nasconderlo, <b>Solo</b> per tenere soltanto quello, <b>Mostra tutto</b> per tornare indietro. La ricerca filtra la lista per nome.</p><p><b>Vista esplosa</b>: il cursore allontana i pezzi dal centro. <b>Elementi scelti</b> allontana solo i pezzi marcati ✦.</p></div>
<div><h3>6. Scegliere l’aspetto</h3><ul><li><b>Render</b>: l’immagine ombreggiata, in grigio neutro o con i colori del file</li><li><b>Profondità</b>: mappa di profondità (bianco = vicino, nero = lontano)</li><li><b>Linee</b>: disegno al tratto dei contorni</li><li><b>Sfondo trasparente</b>: PNG già scontornato, senza pavimento</li></ul></div>
<div><h3>7. Salvare</h3><p><b>Salva l’immagine</b> scarica ciò che è dentro la cornice, alla dimensione scelta.</p></div>
<div><h3>8. Movimenti camera</h3><p>Per i video con IA. Prima raddrizza il prodotto (0° = vista Fronte) e scegli il formato (es. 16:9). Scegli un movimento: parte subito (<b>Anteprima</b> per rivederlo). Controlla i fotogrammi chiave con 1, 2, 3, poi <b>Esporta i frame</b>: i fotogrammi chiave e un file <b>_seedance.txt</b> con una clip primo → ultimo frame per ogni coppia e il suo prompt. Per <b>Avvicinamento</b> e <b>Allontanamento</b>, prima clicca il pezzo da inquadrare.</p></div>
<div><h3>Consiglio</h3><p>Dai all’IA l’immagine come riferimento di posizione e prospettiva, e accanto una foto vera del prodotto per colori e materiali.</p></div>`
}};

let lang = 'fr';
try { lang = localStorage.getItem('lang') || (navigator.language || 'fr').slice(0, 2); } catch (e) {}
if (!T[lang]) lang = 'en';
export const getLang = () => lang;
export function setLang(l) { lang = T[l] ? l : 'en'; try { localStorage.setItem('lang', lang); } catch (e) {} }
export const t = k => T[lang][k] ?? k;
