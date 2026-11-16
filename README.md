# Viewer 3D

[![English](https://img.shields.io/badge/lang-English-blue)](README.en.md)

Visualiseur 3D qui fonctionne entièrement dans le navigateur : on charge un fichier 3D, on choisit le point de vue et on enregistre un JPEG de la vue. Pratique comme référence de position pour la génération d'images par IA.

**👉 Ouvrir l'outil : https://bagareal.github.io/viewer-3D/**

## Confidentialité
Les fichiers sont lus et convertis localement, par votre navigateur. Rien n'est envoyé sur GitHub ni sur aucun serveur, et le fichier disparaît à la fermeture de l'onglet. Seul le code de la page est public.

## Formats acceptés
STEP / STP, IGES, GLB / GLTF, OBJ, STL.

**STEP : jusqu'à ~100 Mo environ.** Au-delà, le navigateur manque de mémoire pour lire le fichier (la page prévient avant d'essayer). Convertissez d'abord le STEP en **GLB** avec un autre logiciel ou une IA, en gardant les pièces séparées : le GLB s'ouvre tout de suite, même lourd, et garde la liste des éléments et la vue éclatée.

## Utilisation
1. **Charger** un fichier (bouton ou glisser-déposer dans la fenêtre).
2. **Se déplacer** : clic gauche maintenu pour tourner, molette pour zoomer, molette enfoncée (ou clic droit) maintenue pour déplacer la vue.
3. **Cadrer** : **Rotation** libre ou bloquée sur un seul axe (X, Y ou Z, avec Réinitialiser), vues rapides (face, 3/4, profil, plongée…), focales de 24 à 105 mm, boutons **Orientation** pour redresser un produit qui arrive couché.
4. **Choisir les éléments** : la liste **Éléments** reprend l'arborescence du fichier. Décocher pour masquer une pièce, **Seul** pour l'isoler, **Tout afficher** pour revenir ; au survol d'un nom, la pièce s'allume en orange.
5. **Vue éclatée** : le curseur écarte les pièces du centre du produit. **Tous les éléments** éclate tout, **Éléments choisis** n'éclate que les pièces ou groupes marqués ✦ dans la liste.
6. **Enregistrer le JPEG de cette vue** : l'image telle qu'à l'écran, 3000 px sur le côté long. Option fond blanc et sol masquable.

L'onglet **Mode d'emploi** de la page reprend ces étapes. L'interface est en français, avec un bouton **EN** pour passer en anglais.

## Licences et usage commercial
Les deux bibliothèques utilisées autorisent l'usage commercial : three.js (licence MIT) et occt-import-js / OpenCascade (licence LGPL-2.1, utilisées sans modification, textes de licence inclus dans ce dépôt). Les images enregistrées avec l'outil ne sont pas concernées par ces licences.

## Technique
- [three.js](https://threejs.org) pour l'affichage.
- [occt-import-js](https://github.com/kovacsv/occt-import-js) (OpenCascade compilé en WebAssembly) pour lire les STEP et IGES, dans un Web Worker. Licences : `license.occt-import-js.txt` et `license.occt.txt`.
