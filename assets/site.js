/* Maison Bartheau Café · comportements communes à toutes les pages
   (thème clair/sombre mémorisé, menu mobile, coordonnées, retour en haut). */
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
