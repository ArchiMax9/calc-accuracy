# Calc Accuracy — la vraie proba de KO sur le calculateur Showdown

Le [calculateur de dégâts de Pokémon Showdown](https://calc.pokemonshowdown.com) affiche
des probabilités de KO en supposant que l'attaque touche **toujours**. Or Stone Edge ne
touche que 80 % du temps. Calc Accuracy est un bookmarklet (un favori de navigateur)
qui affiche, à côté de chaque résultat, la probabilité de KO **réelle**, précision incluse.
Fonctionne sur les onglets **One vs One** et **Champions** du calculateur.

Exemples réels : le calculateur annonce « *79.3% chance to 2HKO* » pour Stone
Edge → Calc Accuracy ajoute en couleur : **« ➜ Avec la précision (80 % × 2 accuracy
checks) : 50,8 % de 2HKO »**. Capture `demo.jpg` : le calculateur donne Stone Edge
« guaranteed OHKO » sur Volcarona → la vraie probabilité est 80 %.

---

## Installation (30 secondes)

**Par la page d'installation** (recommandé) : ouvrir
https://archimax9.github.io/calc-accuracy/ — afficher la barre de favoris
(`Ctrl + Shift + B` Windows / `⌘ + Shift + B` Mac) et **glisser le bouton
« Calc Accuracy »** dans la barre. C'est tout : le favori se crée avec le bon
nom et la bonne URL. (La même page existe en fichier : `index.html`.)

**Méthode manuelle** (strictement équivalente) : créer un favori (clic droit sur
la barre → « Ajouter une page… »), nom libre, et coller **tout** le contenu de
`bookmarklet.txt` dans le champ URL. La page d'installation propose aussi un
bouton « Copier l'URL » pour cette méthode.

Ensuite, ouvrir https://calc.pokemonshowdown.com et cliquer sur le favori :
le message « ✓ Calc Accuracy activé » confirme l'activation.

> Astuce : certains navigateurs retirent le préfixe `javascript:` quand on colle
> à la main. Si rien ne se passe au clic, vérifier que l'URL du favori commence
> bien par `javascript:` (le glisser-déposer depuis la page évite ce piège).

## Utilisation

- **À côté de chaque move** (4 par Pokémon, les deux colonnes) : `➜ 50,8% de 2HKO`
  = la probabilité de KO réelle de ce move. Rien ne s'affiche si le move ne peut pas
  rater, ne fait pas de dégâts, ou si le calculateur ne donne pas de probabilité
  chiffrable (« possible 7HKO »). Une infobulle (survol) détaille le calcul.
- **Sous le résultat principal** : la ligne en couleur détaille le calcul du move
  sélectionné ; si le move ne peut pas rater, une ligne grise « ✓ précision
  100 % — rien à ajuster » le confirme.
- Tout se **met à jour automatiquement** quand on change de move, d'EVs, de
  Pokémon, de météo, d'objet… (au plus tard en ~300 ms).
- **Chaque changement de page du site recharge tout** — y compris passer de
  One vs One à Champions (et inversement), changer de génération, ou F5 →
  il faut **recliquer le favori**. C'est le cycle de vie normal d'un bookmarklet.
- Pour désactiver sans recharger : console → `window.__calcAccuracy.off()`.

## Ce qui est calculé exactement

`proba affichée par le calculateur × (précision effective / 100) ^ t`, où `t` est
le nombre d'**accuracy checks** à réussir. Pour un move normal, `t` = le
nombre de coups du « nHKO » : pour un 2HKO il faut toucher 2 fois, la précision
compte donc deux fois. Pour un OHKO c'est exactement `proba × précision`.

**Cas spécial — Triple Kick, Triple Axel et Population Bomb** : ces trois moves
(les seuls du jeu) testent la précision **à chaque coup**, et un raté interrompt
la séquence. Pour eux :
- chaque coup de chaque utilisation compte un accuracy check (ex. 2HKO à 3 hits
  = jusqu'à 6 checks) ;
- mais la précision ne compte que **jusqu'au coup fatal** : si le premier coup
  de Triple Axel suffit à tuer (rolls minimaux), on affiche 90 %, pas 90 %³.
  Le moteur de la page fournit les dégâts de chaque coup, le coup fatal est
  déterminé sur les rolls minimaux (prudent) et les PV actuels de la cible ;
- le **nombre de hits choisi** dans le sélecteur de la page est respecté ;
- avec un **Loaded Dice** (ou le talent Skill Link), le jeu ne fait qu'un check
  par utilisation — c'est pris en compte (et on voit enfin pourquoi Maushold
  joue Wide Lens : un 4HKO à 40 accuracy checks passe de 1,4 % à 62 % de
  réussite réelle avec le Lens).

La **précision effective** part de la précision officielle du move (données
Pokémon Showdown, génération 9) puis applique les cas qui la modifient en jeu :

| Contexte | Effet |
|---|---|
| Move absent de la table (précision 100 ou « — ») | ne rate jamais, rien à ajuster |
| Blizzard sous grêle/neige ; Thunder & Hurricane sous pluie | ne rate jamais |
| Bleakwind / Wildbolt / Sandsear Storm sous pluie (pas Springtide) | ne rate jamais |
| Thunder & Hurricane sous soleil | précision 50 % |
| No Guard (attaquant **ou** défenseur) | ne rate jamais |
| Cloud Nine · Air Lock (l'un ou l'autre côté) | annulent les effets météo ci-dessus |
| Compound Eyes ×1,3 · Victory Star ×1,1 · Hustle ×0,8 (physique) | attaquant |
| Wide Lens ×1,1 | objet attaquant |
| Sand Veil (sable) · Snow Cloak (neige/grêle) ×0,8 | défenseur — annulés par Mold Breaker/Teravolt/Turboblaze |
| Bright Powder · Lax Incense ×0,9 | objet défenseur |
| Gravité ×5/3 | terrain |

## Note de sécurité (pour qui veut vérifier avant d'installer)

Tout le code est dans `source.js`, lisible et commenté (~370 lignes dont la table
des précisions). Ce qu'il fait, en totalité :

- **lit** les résultats déjà calculés par la page (variable `damageResults` du
  calculateur et sa méthode publique `kochance()`) — il ne refait ni ne modifie
  aucun calcul de la page ;
- **ajoute** de petits éléments de texte (marqués d'une classe `ko-precision`) à
  côté des résultats existants ;
- **surveille** les recalculs de la page pour se mettre à jour (un
  `MutationObserver` + une comparaison de référence toutes les 300 ms).

Il n'y a **aucune requête réseau, aucun cookie, aucune donnée lue en dehors de la
page, rien d'envoyé nulle part**, et c'est réversible (`window.__calcAccuracy.off()`
retire tout). Vérifiable : chercher `fetch`, `XMLHttpRequest`, `cookie`, `storage`
ou `src=` dans `bookmarklet.txt` (le code exactement exécuté par le favori) :
aucune occurrence. Dans `source.js`, seuls les commentaires mentionnent ces mots —
précisément pour dire qu'ils sont absents.

`bookmarklet.txt` est produit mécaniquement depuis `source.js` par `build.js`
(suppression des commentaires, mise sur une ligne, encodage des `%` en `%25`,
préfixe `javascript:` — **aucun renommage ni minification**). Pour vérifier la
correspondance : `node build.js` régénère les fichiers à l'identique.

## Limites connues (v1.1)

- Précisions de la **génération 9** : sur les onglets des anciennes générations,
  quelques moves historiques diffèrent (ex. Blizzard 90 % en RBY).
- Pour Triple Kick/Triple Axel/Population Bomb, le coup fatal est estimé sur les
  rolls **minimaux** et les PV actuels (hazards/résidus non déduits dans cette
  estimation, utilisations précédentes supposées complètes) : estimation
  légèrement prudente dans les cas limites.
- Les **moves OHKO** (Fissure, Sheer Cold…) sont affichés avec leur 30 % de
  base : la vraie règle (niveau, immunités, modificateurs sans effet) n'est pas
  modélisée — ils sont bannis en VGC de toute façon.
- Non gérés : les stades d'esquive/précision (le calculateur ne les propose
  pas), Zoom Lens, Micle Berry, Toxic lancé par un type Poison.
- Conçu et testé pour **One vs One** et **Champions** ; sur les autres modes du
  site, l'affichage n'est pas garanti.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | la page d'installation (hébergée, ou à ouvrir en local) |
| `bookmarklet.txt` | l'URL du favori (une ligne) pour l'installation manuelle |
| `source.js` | le même code, lisible et commenté — à lire pour auditer |
| `build.js` | reconstruit `bookmarklet.txt` et `index.html` depuis `source.js` (`node build.js`) |
| `demo.jpg` | capture d'écran du résultat sur le calculateur |
| `apercu-focus-blast.jpg`, `apercu-triple-axel.jpg` | les captures d'exemple intégrées dans la page d'installation par `build.js` |
