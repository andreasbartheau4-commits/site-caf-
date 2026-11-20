/* Maison Bartheau Café · comportements communes à toutes les pages
   (thème clair/sombre mémorisé, menu mobile, coordonnées, retour en haut). */
/* Formats d'un café (sachet, duo, kilo…), voir assets/produits.js */
window.BCOffres = function(p){
  if(!p) return [];
  var L = Array.isArray(p.formats) ? p.formats.filter(function(o){ return o && o.id && typeof o.prix === "number" && o.prix > 0; }) : [];
  if(!L.length) L = [{id:"sachet", nom:"Le sachet · " + (p.poids || "250 g"), sachets:1, prix:p.prix}];
  return L.map(function(o){ return {id:String(o.id), nom:o.nom || o.id, sachets:Math.max(1, Math.floor(Number(o.sachets) || 1)), prix:o.prix}; });
};
/* Frais d'envoi selon la grille de assets/config.js (même règle que api/lib.php · bc_ship).
   n = nombre de sachets de 250 g, mode = "relais" | "domicile" | "retrait". */
window.BCShip = function(n, mode, L){
  L = L || window.LIVRAISON || {};
  var max = typeof L.maxSachets === "number" ? L.maxSachets : 7;
  if(n > max) return {ok:false, trop:true, max:max};
  if(mode === "retrait") return {ok:L.retrait !== false, prix:0, label:"Retrait en main propre"};
  var g = (L.grille || []).slice().sort(function(a, b){ return a.jusqua - b.jusqua; });
  for(var i = 0; i < g.length; i++){
    if(n <= g[i].jusqua && typeof g[i][mode] === "number") return {ok:true, prix:g[i][mode], label: mode === "relais" ? "Point relais Mondial Relay" : "Colissimo à domicile"};
  }
  return {ok:false};
};
/* Nombre de sachets à partir duquel le point relais est offert (ou null) */
window.BCRelaisOffert = function(L){
  L = L || window.LIVRAISON || {};
  var g = (L.grille || []).slice().sort(function(a, b){ return a.jusqua - b.jusqua; }), prev = 0;
  for(var i = 0; i < g.length; i++){ if(g[i].relais === 0) return prev + 1; prev = g[i].jusqua; }
  return null;
};
window.BCOffre = function(p, id){ var L = window.BCOffres(p); return L.filter(function(o){ return o.id === id; })[0] || L[0]; };
(function(){
  var root = document.documentElement;
  var $ = function(i){ return document.getElementById(i); };

  /* ---- Thème ---- */
  var tb = $("themeBtn");
  if(tb){
    tb.addEventListener("click", function(){
      var cur = root.getAttribute("data-theme");
      var dark = cur ? cur === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try{ localStorage.setItem("bc-theme", next); }catch(e){}
    });
  }

  /* ---- Menu mobile ---- */
  var burger = $("burger"), nav = $("nav");
  function closeNav(){ if(!nav) return; nav.classList.remove("open"); document.body.classList.remove("navopen"); if(burger) burger.setAttribute("aria-expanded", "false"); }
  if(burger && nav){
    burger.addEventListener("click", function(){
      var open = !nav.classList.contains("open");
      nav.classList.toggle("open", open); document.body.classList.toggle("navopen", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function(e){ if(e.target.closest("a")) closeNav(); });
    document.addEventListener("keydown", function(e){ if(e.key === "Escape") closeNav(); });
    window.addEventListener("hashchange", closeNav);
    window.matchMedia("(min-width: 901px)").addEventListener && window.matchMedia("(min-width: 901px)").addEventListener("change", closeNav);
  }

  /* ---- Coordonnées (assets/config.js) ---- */
  if(typeof INFO === "object"){
    document.querySelectorAll(".fill").forEach(function(el){
      var v = INFO[el.getAttribute("data-k")];
      el.textContent = v ? v : "à compléter";
      el.classList.toggle("todo", !v);
    });
    document.querySelectorAll("[data-mailto]").forEach(function(a){
      if(INFO.email){ a.href = "mailto:" + INFO.email; if(!a.textContent.trim()) a.textContent = INFO.email; }
    });
    document.querySelectorAll("[data-tel]").forEach(function(a){
      if(INFO.tel){ a.href = "tel:" + INFO.tel.replace(/[^\d+]/g, ""); a.textContent = INFO.tel; }
      else { var o = a.closest("[data-optional]"); if(o) o.hidden = true; }
    });
    document.querySelectorAll("[data-insta]").forEach(function(a){
      if(INFO.instagram){ a.href = INFO.instagram; } else { (a.closest("li") || a).hidden = true; }
    });
  }
  document.querySelectorAll("[data-year]").forEach(function(el){ el.textContent = new Date().getFullYear(); });

  /* ---- Retour en haut ---- */
  var top = $("toTop");
  if(top){
    var tick = false;
    window.addEventListener("scroll", function(){
      if(tick) return; tick = true;
      requestAnimationFrame(function(){ tick = false; top.classList.toggle("show", (window.scrollY || 0) > 900); });
    }, {passive:true});
    top.addEventListener("click", function(){ window.scrollTo({top:0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); });
  }
})();
