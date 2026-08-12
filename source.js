/* ============================================================================
 * « Calc Accuracy » — bookmarklet pour https://calc.pokemonshowdown.com
 * ----------------------------------------------------------------------------
 * PROBLÈME : le calculateur affiche « 60% chance to 2HKO » en supposant que
 * l'attaque touche toujours. Or Stone Edge n'a que 80 % de précision.
 * Ce script affiche la probabilité de KO RÉELLE, précision incluse :
 *     proba affichée × (précision / 100) ^ (nombre de tests de précision)
 * (pour un 2HKO il faut toucher 2 fois, donc la précision compte 2 fois ;
 * les moves qui testent la précision à chaque coup — Triple Kick, Triple Axel,
 * Population Bomb — comptent un test par coup, mais seulement jusqu'au coup
 * qui met KO, et un seul test par utilisation avec un Loaded Dice).
 *
 * SÉCURITÉ / AUDIT — ce que fait ce code, en entier :
 *   - il LIT les résultats déjà calculés par la page (variable `damageResults`
 *     du calculateur, méthode publique kochance() du moteur @smogon/calc) ;
 *   - il AJOUTE de petits éléments de texte à côté des résultats existants ;
 *   - il observe la page (MutationObserver) pour se mettre à jour quand on
 *     change de move, de Pokémon, d'EVs, de météo, etc.
 *   - AUCUNE requête réseau, AUCUN cookie, AUCUNE donnée collectée ou envoyée,
 *     AUCUNE modification des calculs de la page. Tout est local et visuel.
 *   - Réversible : window.__calcAccuracy.off() retire tout proprement.
 *
 * La table PRECISION ci-dessous vient des données officielles de Pokémon
 * Showdown (play.pokemonshowdown.com/data/moves.json, valeurs génération 9) :
 * uniquement les moves offensifs dont la précision est inférieure à 100.
 * Tout move absent de la table est considéré comme ne pouvant pas rater.
 * ========================================================================= */
(function () {
  'use strict';

  /* --- 0. Réglages d'affichage (libellés faciles à modifier) -------------- */
  var COULEUR = 'rgb(13,148,136)';
  var PREFIXE_LIGNE = 'Avec la précision';

  /* --- 1. Si déjà installé : simple rafraîchissement ----------------------- */
  if (window.__calcAccuracy) {
    window.__calcAccuracy.update();
    window.__calcAccuracy.toast('Calc Accuracy : déjà actif, rafraîchi');
    return;
  }

  /* --- 2. Garde-fou : est-on bien sur le calculateur (mode 1 vs 1) ? ------- */
  if (!window.damageResults || !document.getElementById('mainResult') ||
      !document.querySelector('.main-result-group')) {
    toast('Calc Accuracy fonctionne sur calc.pokemonshowdown.com — si la page vient de charger, recliquez.');
    return;
  }

  /* --- 3. Table id de move -> précision (voir en-tête pour la source) ------ */
  var PRECISION = {aeroblast:95,aircutter:95,airslash:95,aquatail:90,axekick:90,baddybad:95,barrage:85,belch:90,bind:85,blastburn:90,blazekick:90,bleakwindstorm:80,blizzard:70,blueflare:85,boltstrike:85,boneclub:85,bonemerang:90,bonerush:90,bounce:85,ceaselessedge:90,chargebeam:90,chloroblast:95,circlethrow:90,clamp:85,cometpunch:85,crabhammer:90,crosschop:80,crushclaw:95,cut:95,diamondstorm:95,doublehit:90,doubleslap:85,dracometeor:90,dragonrush:75,dragontail:90,drillrun:95,dualchop:90,dualwingbeat:90,dynamicpunch:50,eggbomb:75,electroweb:95,eternabeam:90,fireblast:85,firefang:95,firespin:85,fissure:30,fleurcannon:90,floatyfall:95,fly:95,flyingpress:95,focusblast:70,freezeshock:90,freezyfrost:90,frenzyplant:90,frostbreath:90,furyattack:85,furycutter:95,furyswipes:80,geargrind:85,gigaimpact:90,glaciate:95,glitzyglow:95,guillotine:30,gunkshot:80,hammerarm:90,headsmash:80,heatwave:90,highhorsepower:95,highjumpkick:90,horndrill:30,hurricane:70,hydrocannon:90,hydropump:80,hyperbeam:90,hyperfang:90,iceball:90,iceburn:90,icefang:95,icehammer:90,iciclecrash:90,icywind:95,inferno:50,irontail:75,jumpkick:95,leafstorm:90,leaftornado:90,lightofruin:90,magmastorm:75,matchagotcha:90,megahorn:85,megakick:75,megapunch:85,metalclaw:95,meteorbeam:90,meteormash:90,mirrorshot:85,mountaingale:85,mudbomb:85,muddywater:85,mudshot:95,mysticalpower:90,naturesmadness:90,nightdaze:95,octazooka:85,originpulse:85,overheat:90,pinmissile:95,playrough:90,poltergeist:90,populationbomb:90,powerwhip:85,precipiceblades:85,present:90,psychoboost:90,psyshieldbash:90,pyroball:90,razorleaf:95,razorshell:95,roaroftime:90,rockblast:90,rockclimb:85,rockslide:90,rockthrow:90,rocktomb:95,rockwrecker:90,rollingkick:85,rollout:90,ruination:90,sacredfire:95,sandsearstorm:80,sandtomb:85,sappyseed:90,scaleshot:90,seedflare:85,sheercold:30,skittersmack:90,skyattack:90,skyuppercut:90,slam:75,smog:70,snarl:95,sonicboom:90,spacialrend:95,sparklyswirl:85,springtidestorm:80,steameruption:95,steelbeam:95,steelwing:90,stoneaxe:90,stoneedge:80,strangesteam:95,submission:80,supercellslam:95,superfang:90,syrupbomb:85,tailslap:85,takedown:85,thunder:70,thundercage:90,thunderfang:95,tripleaxel:90,tripledive:95,triplekick:90,vcreate:95,whirlpool:85,wildboltstorm:80,wrap:90,zapcannon:50,zenheadbutt:90};

  /* --- 4. Précision effective d'un move dans le contexte du calcul --------- */
  /* `res` est un objet Result du moteur @smogon/calc : il contient le move,
     l'attaquant, le défenseur et l'état du terrain (res.field). On couvre les
     cas les plus courants qui changent la précision réelle en jeu. */
  function idOf(nom) {
    return String(nom || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function precisionEffective(res) {
    var move = res.move;
    var field = res.field || {};
    var att = res.attacker || {};
    var def = res.defender || {};
    var id = idOf(move.name);
    var acc = Object.prototype.hasOwnProperty.call(PRECISION, id) ? PRECISION[id] : 100;
    var meteo = String(field.weather || '');
    /* Cloud Nine / Air Lock (chez l'un ou l'autre) annulent les effets de la météo */
    if (att.ability === 'Cloud Nine' || att.ability === 'Air Lock' ||
        def.ability === 'Cloud Nine' || def.ability === 'Air Lock') {
      meteo = '';
    }
    /* Blizzard ne rate jamais sous grêle / neige */
    if (id === 'blizzard' && (meteo === 'Hail' || meteo === 'Snow')) {
      return 100;
    }
    /* Thunder et Hurricane : jamais de raté sous pluie, 50 % sous soleil */
    if (id === 'thunder' || id === 'hurricane') {
      if (meteo === 'Rain' || meteo === 'Heavy Rain') {
        return 100;
      }
      if (meteo === 'Sun' || meteo === 'Harsh Sunshine') {
        acc = 50;
      }
    }
    /* Les tempêtes des génies (pas Springtide Storm) ne ratent jamais sous la pluie */
    if ((id === 'bleakwindstorm' || id === 'wildboltstorm' || id === 'sandsearstorm') &&
        (meteo === 'Rain' || meteo === 'Heavy Rain')) {
      return 100;
    }
    /* No Guard (chez l'un ou l'autre) : aucune attaque ne rate */
    if (att.ability === 'No Guard' || def.ability === 'No Guard') {
      return 100;
    }
    /* Modificateurs de précision courants */
    var mod = 1;
    if (att.ability === 'Compound Eyes') { mod = mod * 1.3; }
    if (att.ability === 'Victory Star') { mod = mod * 1.1; }
    if (att.ability === 'Hustle' && move.category === 'Physical') { mod = mod * 0.8; }
    if (att.item === 'Wide Lens') { mod = mod * 1.1; }
    /* esquive du défenseur — annulée par Mold Breaker et ses variantes */
    var casseEsquive = (att.ability === 'Mold Breaker' || att.ability === 'Teravolt' || att.ability === 'Turboblaze');
    if (!casseEsquive) {
      if (def.ability === 'Sand Veil' && meteo === 'Sand') { mod = mod * 0.8; }
      if (def.ability === 'Snow Cloak' && (meteo === 'Hail' || meteo === 'Snow')) { mod = mod * 0.8; }
    }
    if (def.item === 'Bright Powder' || def.item === 'Lax Incense') { mod = mod * 0.9; }
    if (field.isGravity) { mod = mod * 5 / 3; }
    acc = acc * mod;
    if (acc > 100) { acc = 100; }
    return acc;
  }

  /* --- 5. Moves qui testent la précision À CHAQUE COUP ---------------------- */
  /* Triple Kick, Triple Axel et Population Bomb font un test de précision par
     coup, et un raté interrompt la séquence (flag « multiaccuracy » des données
     Showdown). Deux règles s'appliquent :
     - avec un Loaded Dice, le jeu ne fait qu'UN test pour toute l'utilisation ;
     - la précision ne compte que jusqu'au COUP FATAL : un Garchomp niveau 1
       meurt au premier coup de Triple Axel, la vraie proba est donc 90 %,
       pas 90 % ^ 3. Le moteur de la page fournit les dégâts de chaque coup
       (res.damage = un tableau de rolls PAR COUP, dans l'ordre du jeu), on
       compte donc combien de coups suffisent, aux rolls minimaux (prudent).
     Le nombre de coups choisi dans le sélecteur de la page est respecté :
     il détermine la forme de res.damage. */
  var TESTE_CHAQUE_COUP = { triplekick: true, tripleaxel: true, populationbomb: true };

  function minDe(rolls) {
    var m = rolls[0];
    for (var i = 1; i < rolls.length; i++) { if (rolls[i] < m) { m = rolls[i]; } }
    return m;
  }
  /* dégâts minimaux de chaque coup ; [total] si le move n'a qu'un coup */
  function minParCoup(res) {
    var d = res.damage;
    if (typeof d === 'number') { return [d]; }
    if (!Array.isArray(d) || d.length === 0) { return [0]; }
    if (!Array.isArray(d[0])) { return [minDe(d)]; }
    var mins = [];
    for (var i = 0; i < d.length; i++) { mins.push(minDe(d[i])); }
    return mins;
  }
  /* nombre de tests de précision à réussir pour obtenir le KO décrit par ko */
  function nbTests(res, ko) {
    var id = idOf(res.move.name);
    if (!TESTE_CHAQUE_COUP[id]) { return ko.n; }
    var attaquant = res.attacker || {};
    if (String(attaquant.item || '') === 'Loaded Dice' || attaquant.ability === 'Skill Link') { return ko.n; }
    var mins = minParCoup(res);
    var coups = mins.length;
    var totalMin = 0;
    for (var i = 0; i < coups; i++) { totalMin += mins[i]; }
    var pv = 0;
    try { pv = res.defender.curHP(); } catch (e) { pv = 0; }
    if (pv <= 0 || totalMin <= 0) { return coups * ko.n; }
    /* PV restants avant la dernière utilisation (rolls minimaux : prudent) */
    var restant = pv - (ko.n - 1) * totalMin;
    var cumul = 0;
    var fatal = coups;
    for (var j = 0; j < coups; j++) {
      cumul = cumul + mins[j];
      if (cumul >= restant) { fatal = j + 1; break; }
    }
    return coups * (ko.n - 1) + fatal;
  }

  /* --- 6. Probabilité de KO ajustée pour un résultat ----------------------- */
  /* kochance() est la méthode du moteur qui produit le texte affiché par la
     page (« 60.2% chance to 2HKO ») : chance (0..1) et n (nombre
     d'utilisations). Elle lève une erreur pour les moves qui ne font pas de
     dégâts : dans ce cas on ne montre rien. Pour « possible 7HKO » chance
     n'existe pas. La précision est élevée à la puissance du nombre de tests
     de précision nécessaires (= n, sauf moves à test par coup, voir plus haut). */
  function koAvecPrecision(res) {
    var ko;
    try {
      ko = res.kochance();
    } catch (e) {
      return null;
    }
    if (!ko || !ko.n) {
      return null;
    }
    var acc = precisionEffective(res);
    var tests = nbTests(res, ko);
    var chanceConnue = (typeof ko.chance === 'number' && ko.chance > 0);
    return {
      ko: ko,
      acc: acc,
      tests: tests,
      pct: chanceConnue ? 100 * ko.chance * Math.pow(acc / 100, tests) : null
    };
  }

  /* --- 7. Petits utilitaires d'affichage ----------------------------------- */
  function fmtPct(x) {
    if (x >= 99.95) { return '100'; }
    if (x > 0 && x < 0.05) { return '<0,1'; }
    return x.toFixed(1).replace('.', ',').replace(/,0$/, '');
  }
  function nhko(n) {
    return n === 1 ? 'OHKO' : String(n) + 'HKO';
  }
  function ecrire(el, txt) {
    if (el.textContent !== txt) { el.textContent = txt; }
  }
  function titre(el, txt) {
    if (el.getAttribute('title') !== txt) { el.setAttribute('title', txt); }
  }

  /* --- 8. Annotations à côté des 4 moves de chaque Pokémon ------------------ */
  /* La page a des <span id="resultDamageL1..4 / R1..4"> avec « 50.4 - 59.8% » ;
     on ajoute juste après chacun notre propre <span class="ko-precision">. */
  function tagApres(span, id, taille) {
    var t = document.getElementById(id);
    if (!t) {
      t = document.createElement('span');
      t.id = id;
      t.className = 'ko-precision';
      t.style.cssText = 'color:' + COULEUR + ';font-weight:bold;font-size:' + taille + ';margin-left:5px;white-space:nowrap;';
      span.insertAdjacentElement('afterend', t);
    }
    return t;
  }
  function majParMove() {
    var dr = window.damageResults;
    var cotes = ['L', 'R'];
    for (var s = 0; s < 2; s++) {
      for (var i = 1; i <= 4; i++) {
        var span = document.getElementById('resultDamage' + cotes[s] + i);
        if (!span) { continue; }
        var t = tagApres(span, 'koPrec' + cotes[s] + i, '0.85em');
        var res = (dr && dr[s]) ? dr[s][i - 1] : null;
        var info = res ? koAvecPrecision(res) : null;
        if (info && info.pct !== null && info.acc < 99.995) {
          ecrire(t, '➜ ' + fmtPct(info.pct) + '% de ' + nhko(info.ko.n));
          titre(t, 'KO réel, précision incluse : « ' + info.ko.text + ' » × ' + fmtPct(info.acc) + '% de précision (' + info.tests + ' accuracy check' + (info.tests > 1 ? 's' : '') + ')');
        } else {
          ecrire(t, '');
          titre(t, '');
        }
      }
    }
  }

  /* --- 9. Ligne détaillée sous le résultat principal ------------------------ */
  function resultatSelectionne() {
    var radio = document.querySelector('input.result-move:checked');
    var m = radio ? radio.id.match(/^resultMove([LR])([1-4])$/) : null;
    if (!m || !window.damageResults) { return null; }
    var liste = window.damageResults[m[1] === 'L' ? 0 : 1];
    return liste ? liste[Number(m[2]) - 1] : null;
  }
  function majPrincipal() {
    var groupe = document.querySelector('.main-result-group');
    var grand = groupe ? groupe.querySelector('.big-text') : null;
    if (!grand) { return; }
    var ligne = document.getElementById('koPrecMain');
    if (!ligne) {
      ligne = document.createElement('div');
      ligne.id = 'koPrecMain';
      ligne.className = 'ko-precision';
      ligne.style.margin = '2px 0 0';
      grand.insertAdjacentElement('afterend', ligne);
    }
    var res = resultatSelectionne();
    var info = res ? koAvecPrecision(res) : null;
    if (!info) {
      /* move de statut / 0 dégât : rien à afficher */
      ecrire(ligne, '');
      titre(ligne, '');
      return;
    }
    if (info.acc >= 99.995) {
      /* le move ne peut pas rater : on le dit discrètement */
      ligne.style.cssText = 'margin:2px 0 0;color:rgb(125,125,135);font-size:0.9em;';
      ecrire(ligne, '✓ précision 100 % — rien à ajuster');
      titre(ligne, '');
      return;
    }
    ligne.style.cssText = 'margin:2px 0 0;color:' + COULEUR + ';font-weight:bold;';
    if (info.pct === null) {
      /* cas « possible 7HKO » : pas de % exploitable, on rappelle juste la précision */
      ecrire(ligne, '➜ ' + PREFIXE_LIGNE + ' : ' + fmtPct(info.acc) + ' % de précision par attaque (' + info.ko.text + ')');
      titre(ligne, '');
      return;
    }
    var detail = fmtPct(info.acc) + ' %' + (info.tests > 1 ? ' × ' + info.tests + ' accuracy checks' : '');
    ecrire(ligne, '➜ ' + PREFIXE_LIGNE + ' (' + detail + ') : ' + fmtPct(info.pct) + ' % de ' + nhko(info.ko.n));
    titre(ligne, 'Calcul : ' + fmtPct(100 * info.ko.chance) + '% (chance affichée) × (' + fmtPct(info.acc) + '% de précision)^' + info.tests);
  }

  /* dernierRendu : référence du tableau damageResults déjà affiché ; sert à
     détecter qu'un nouveau calcul a eu lieu (la page RÉASSIGNE damageResults
     à chaque recalcul, vérifié sur place). */
  var dernierRendu = null;
  function majTout() {
    try {
      dernierRendu = window.damageResults;
      majParMove();
      majPrincipal();
    } catch (e) {
      /* on n'interrompt jamais la page pour un souci d'affichage */
      console.warn('[ko-precision]', e);
    }
  }

  /* --- 10. Mise à jour automatique ------------------------------------------- */
  /* Deux mécanismes complémentaires, tous deux sans effet sur la page :
     a) un MutationObserver : la page réécrit les textes de résultat à chaque
        recalcul (move, EVs, Pokémon...) ; on se met à jour dans la foulée.
        Les mutations provoquées par nos propres éléments sont ignorées, et on
        n'écrit que si le texte change : aucune boucle possible.
     b) une vérification toutes les 300 ms : certains réglages changent la
        précision SANS changer un seul texte affiché (ex : activer la pluie
        pour Hurricane, la Gravité, donner un Wide Lens) — et le recalcul de
        la page est différé, donc impossible à attraper au vol de façon fiable.
        Comparer la référence de damageResults à celle du dernier affichage
        est un test quasi gratuit qui rattrape tous ces cas. */
  var minuterie = null;
  function planifier() {
    if (minuterie !== null) { return; }
    minuterie = window.setTimeout(function () {
      minuterie = null;
      majTout();
    }, 80);
  }
  var observateur = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var cible = mutations[i].target;
      var el = (cible.nodeType === 1) ? cible : cible.parentElement;
      if (!el || !el.closest('.ko-precision')) {
        planifier();
        return;
      }
    }
  });
  observateur.observe(document.querySelector('.wrapper') || document.body,
    { subtree: true, childList: true, characterData: true });
  var verificateur = window.setInterval(function () {
    if (window.damageResults !== dernierRendu) { majTout(); }
  }, 300);

  /* --- 11. Toast de confirmation (non bloquant) ----------------------------- */
  function toast(message) {
    var t = document.createElement('div');
    t.textContent = message;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:rgb(40,40,48);color:rgb(255,255,255);padding:8px 16px;border-radius:8px;font:14px/1.4 sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.35);transition:opacity 0.4s;pointer-events:none;';
    document.body.appendChild(t);
    window.setTimeout(function () { t.style.opacity = '0'; }, 2200);
    window.setTimeout(function () { t.remove(); }, 2700);
  }

  /* --- 12. Désinstallation propre + petite API ------------------------------ */
  function desinstaller() {
    observateur.disconnect();
    window.clearInterval(verificateur);
    var restes = document.querySelectorAll('.ko-precision');
    for (var i = 0; i < restes.length; i++) { restes[i].remove(); }
    delete window.__calcAccuracy;
    toast('Calc Accuracy : désactivé');
  }
  window.__calcAccuracy = {
    version: '1.1',
    update: majTout,
    off: desinstaller,
    toast: toast
  };

  majTout();
  toast('✓ Calc Accuracy activé');
})();
