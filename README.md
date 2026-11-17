# Viewer 3D

[![English](https://img.shields.io/badge/lang-English-blue)](README.en.md)

Visualiseur 3D qui fonctionne entièrement dans le navigateur : on charge un fichier 3D, on choisit le point de vue et on enregistre une image de la vue. Pratique comme référence de position pour la génération d'images par IA.

**👉 Ouvrir l'outil : https://bagareal.github.io/viewer-3D/**

## Confidentialité
Les fichiers sont lus et convertis localement, par votre navigateur. Rien n'est envoyé sur GitHub ni sur aucun serveur, et le fichier disparaît à la fermeture de l'onglet. Seul le code de la page est public.

## Formats acceptés
STEP / STP, IGES, GLB / GLTF, OBJ, STL.

**STEP : jusqu'à ~100 Mo environ.** Au-delà, le navigateur manque de mémoire pour lire le fichier (la page prévient avant d'essayer). Convertissez d'abord le STEP en **GLB** avec un autre logiciel ou une IA, en gardant les pièces séparées : le GLB s'ouvre tout de suite, même lourd, et garde la liste des éléments et la vue éclatée.

## Utilisation
1. **Charger** un fichier (bouton ou glisser-déposer dans la fenêtre).
2. **Se déplacer** : clic gauche maintenu pour tourner, molette pour zoomer, clic droit (ou molette enfoncée) maintenu pour déplacer la vue. Un clic sur une pièce du modèle la retrouve dans la liste.
3. **Cadrer** : vues rapides (face, 3/4, profil, plongée…), focales de 24 à 105 mm, et un **format d'image** (libre, 1:1, 4:5, 3:2, 16:9, 9:16) affiché comme un cadre à l'écran. Les **vues enregistrées** gardent un cadrage pour le réappliquer à d'autres produits ; elles s'exportent et s'importent sous forme de fichier.
4. **Positionner le produit** : quarts de tour pour redresser un produit qui arrive couché, ou glisser pour le faire tourner sur un seul axe (X, Y ou Z, avec Réinitialiser). Les axes suivent la convention CAO : Z est vertical.
   Le **cube d'orientation** en haut à droite tourne avec la vue : cliquez une face, une arête ou un coin pour voir le produit de ce côté.
5. **Choisir les éléments** : la liste **Éléments** reprend l'arborescence du fichier, avec une recherche. Décocher pour masquer une pièce, **Seul** pour l'isoler, **Tout afficher** pour revenir ; au survol d'un nom, la pièce s'allume en orange.
6. **Vue éclatée** : le curseur écarte les pièces du centre du produit. **Tous les éléments** éclate tout, **Éléments choisis** n'éclate que les pièces ou groupes marqués ✦ dans la liste.
7. **Choisir le rendu** : **Rendu** ombré (gris neutre ou couleurs du fichier), carte de **Profondeur** (blanc = proche) ou dessin au **Trait**. Fond gris, blanc ou transparent.
8. **Enregistrer l'image** : ce qui est dans le cadre, 2000, 3000 ou 4000 px sur le côté long. JPEG, ou PNG pour le fond transparent, la profondeur et les traits.
9. **Mouvements de caméra** (pour la vidéo IA) : 10 mouvements prêts (orbites, approche, recul, montée, du dessus à 3/4, travelling latéral, contre-plongée, arc descendant), définis par rapport au produit : 0° = la vue de face, distance 1 = produit entier dans le cadre. Choisir un mouvement le joue tout de suite (**Aperçu** pour le revoir), les boutons 1, 2, 3 montrent chaque image clé, **Exporter les images** télécharge les images clés (avec le format, le type d'image et la taille choisis) et un fichier `_seedance.txt` : un clip première image → dernière image par paire d'images, avec le prompt de caméra en anglais. Pour l'approche et le recul, cliquez d'abord la pièce à viser sur le modèle.

L'onglet **Mode d'emploi** de la page reprend ces étapes. L'interface existe en français, en anglais et en italien.

## Licences et usage commercial
Les deux bibliothèques utilisées autorisent l'usage commercial : three.js (licence MIT) et occt-import-js / OpenCascade (licence LGPL-2.1, utilisées sans modification). Leurs textes de licence sont dans `vendor/`. Les images enregistrées avec l'outil ne sont pas concernées par ces licences.

## Technique
Aucune étape de compilation : HTML, CSS et modules JavaScript simples, avec toutes les dépendances dans le dépôt (la page fonctionne sans serveur externe).
- `index.html`, `css/style.css` : la page.
- `js/viewer.js` : scène, caméra, cadrage, types de rendu et export de l'image. `js/model.js` : matériaux, liste des éléments, vue éclatée, sélection. `js/loaders.js` et `js/step-worker.js` : lecture des fichiers. `js/i18n.js` : textes. `js/moves.js` : mouvements de caméra et fichier des prompts. `js/main.js` : liaison avec l'interface.
- `vendor/three` : [three.js](https://threejs.org) 0.170 pour l'affichage.
- `vendor/occt` : [occt-import-js](https://github.com/kovacsv/occt-import-js) (OpenCascade compilé en WebAssembly) pour lire les STEP et IGES, dans un Web Worker.

Pour le lancer en local, servez le dossier avec un serveur statique, par exemple `python -m http.server`, puis ouvrez l'adresse affichée.
