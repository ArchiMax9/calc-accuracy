/* ============================================================================
 * build.js — construit bookmarklet.txt à partir de source.js
 * ----------------------------------------------------------------------------
 * Usage : node build.js
 *
 * La transformation est volontairement minimale et vérifiable à l'œil nu,
 * pour que n'importe qui puisse comparer source.js et bookmarklet.txt :
 *   1. on retire les lignes de commentaires (le code n'en a jamais en fin de
 *      ligne de code, uniquement des lignes entières) ;
 *   2. on met tout sur une seule ligne (le code met des point-virgules
 *      partout, donc c'est sans risque) ;
 *   3. on encode le caractère % en %25 (obligatoire dans une URL javascript:,
 *      sinon le navigateur essaierait de décoder « % de KO » comme un
 *      échappement d'URL) ;
 *   4. on préfixe par « javascript: ».
 * Aucun renommage, aucune minification : le code du bookmarklet reste
 * identique au source, identifiants et chaînes compris.
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'source.js'), 'utf8');

const lignesGardees = [];
let dansCommentaireBloc = false;
for (const ligne of source.split('\n')) {
  const l = ligne.trim();
  if (dansCommentaireBloc) {
    if (l.includes('*/')) { dansCommentaireBloc = false; }
    continue;
  }
  if (l.startsWith('/*')) {
    if (!l.includes('*/')) { dansCommentaireBloc = true; }
    continue;
  }
  if (l.startsWith('//') || l === '') { continue; }
  lignesGardees.push(l);
}

const uneLigne = lignesGardees.join(' ');
const payload = uneLigne.replace(/%/g, '%25');
const bookmarklet = 'javascript:' + payload;

fs.writeFileSync(path.join(__dirname, 'bookmarklet.txt'), bookmarklet + '\n');

/* Auto-vérification : décoder le bookmarklet comme le fera le navigateur
   doit redonner exactement le code une-ligne. */
const decode = decodeURIComponent(bookmarklet.slice('javascript:'.length));
if (decode !== uneLigne) {
  console.error('ERREUR : le décodage ne redonne pas le code source !');
  process.exit(1);
}
/* la ligne unique doit rester du JavaScript syntaxiquement valide : si une
   future édition mêlait commentaire et code sur une même ligne, on le verrait ici */
new Function(uneLigne);
console.log('bookmarklet.txt écrit (' + bookmarklet.length + ' caractères), décodage vérifié.');

/* ---------------------------------------------------------------------------
 * installer.html — page d'installation par glisser-déposer.
 * On échappe le bookmarklet pour l'HTML (attribut href + contenu du textarea) ;
 * le navigateur restituera exactement la chaîne d'origine.
 * ------------------------------------------------------------------------- */
function echapperHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const paye = echapperHTML(bookmarklet);
/* capture d'écran d'exemple, intégrée à la page pour qu'elle reste un fichier unique */
const apercuB64 = fs.readFileSync(path.join(__dirname, 'apercu-installer.jpg')).toString('base64');
const installeur = `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Calc Accuracy — installation</title>
<style>
  body { font: 16px/1.55 system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; color: #1c2430; background: #f7f8fa; }
  h1 { font-size: 1.35rem; }
  .etape { margin: 1.2em 0; }
  .bouton-glisser { display: inline-block; padding: 12px 22px; background: rgb(13,148,136); color: #fff; font-weight: bold; border-radius: 10px; text-decoration: none; cursor: grab; box-shadow: 0 2px 8px rgba(0,0,0,.18); }
  .cadre { border: 2px dashed #9aa4b2; border-radius: 12px; padding: 22px; text-align: center; background: #fff; }
  .astuce { color: #5b6672; font-size: .92em; }
  textarea { width: 100%; height: 90px; font: 12px/1.4 monospace; margin-top: 8px; }
  button { padding: 8px 14px; border: 1px solid #9aa4b2; background: #fff; border-radius: 8px; cursor: pointer; }
  .ok { color: rgb(13,148,136); font-weight: bold; }
  code { background: #eceff3; padding: 1px 5px; border-radius: 4px; }
  h2 { font-size: 1.1rem; margin-top: 1.7em; }
  .apercu { width: 100%; border: 1px solid #d5dae1; border-radius: 10px; display: block; }
  summary { cursor: pointer; background: #fff; border: 1px solid #9aa4b2; border-radius: 8px; padding: 10px 14px; font-weight: 600; }
  summary:hover { background: #eef1f5; }
  details { margin: 1.1em 0; }
  details[open] summary { margin-bottom: .7em; }
  ul li { margin: .5em 0; }
</style>
<h1>🎯 Calc Accuracy — la vraie proba de KO, précision incluse</h1>
<p>Ajoute au <a href="https://calc.pokemonshowdown.com">calculateur de dégâts Showdown</a> la probabilité de KO réelle, précision des attaques incluse. Fonctionne sur les onglets <strong>One vs One</strong> et <strong>Champions</strong>.</p>
<h2>À quoi ça ressemble</h2>
<p class="astuce">Ce qui est en vert-bleu est ajouté par le bookmarklet : ici le calculateur annonce « guaranteed OHKO », mais Stone Edge ne touche que 80 % du temps — la vraie probabilité est donc 80 %.</p>
<img class="apercu" src="data:image/jpeg;base64,${apercuB64}" alt="Aperçu : sous le résultat « guaranteed OHKO » du calculateur, le bookmarklet ajoute « Avec la précision (80 %) : 80 % de OHKO »">
<h2>Installation</h2>
<div class="etape"><strong>1.</strong> Affiche la barre de favoris : <code>Ctrl + Shift + B</code> (Windows) ou <code>⌘ + Shift + B</code> (Mac).</div>
<div class="etape"><strong>2.</strong> Glisse ce bouton dans la barre de favoris :</div>
<div class="cadre">
  <a class="bouton-glisser" href="${paye}">Calc Accuracy</a>
  <p class="astuce">(à glisser-déposer — un simple clic ici ne l'installe pas)</p>
</div>
<div class="etape"><strong>3.</strong> Ouvre <a href="https://calc.pokemonshowdown.com">calc.pokemonshowdown.com</a> puis clique sur le favori : le message « ✓ Calc Accuracy activé » confirme.</div>
<details>
  <summary>🔧 Le glisser-déposer ne marche pas ? Cliquer ici pour l'installation manuelle</summary>
  <p>Copie l'URL ci-dessous (bouton), puis crée un favori (clic droit sur la barre de favoris → « Ajouter une page… ») et colle-la dans le champ URL :</p>
  <button id="copier">Copier l'URL du bookmarklet</button> <span id="copie-ok"></span>
  <textarea id="zone" readonly>${paye}</textarea>
</details>
<h2>Et niveau sécurité ?</h2>
<ul>
  <li><strong>Rien ne s'installe sur l'ordinateur.</strong> Un bookmarklet est un simple favori de navigateur : il n'agit que sur la page du calculateur, au moment où on clique dessus, et se supprime comme n'importe quel favori.</li>
  <li><strong>Tout le code est visible.</strong> L'URL du favori contient l'intégralité du programme (dans « installation manuelle » ci-dessus, tu peux le lire en entier). Aucune requête réseau, aucune donnée collectée ou envoyée, aucun accès à tes comptes.</li>
  <li><strong>Un doute ? Vérifie par toi-même.</strong> Copie l'URL du bookmarklet et colle-la à Claude ou ChatGPT avec la question « Que fait ce code ? Est-il sûr ? » — ou fais-la relire à quelqu'un qui code. Le programme est court, la réponse prend trente secondes.</li>
</ul>
<script>
  (function () {
    var zone = document.getElementById('zone');
    document.getElementById('copier').addEventListener('click', function () {
      var fini = function () {
        var ok = document.getElementById('copie-ok');
        ok.textContent = '✓ copié';
        ok.className = 'ok';
      };
      var secours = function () { zone.select(); document.execCommand('copy'); fini(); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(zone.value).then(fini, secours);
      } else { secours(); }
    });
  })();
</script>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'index.html'), installeur);
console.log('index.html écrit (' + installeur.length + ' caractères).');
