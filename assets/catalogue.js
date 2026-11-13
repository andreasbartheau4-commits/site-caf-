/* Maison Bartheau Café · catalogue « Nos cafés » (cartes et fiches détaillées).
   Les produits se règlent dans assets/produits.js ; le stock vient de la page Gestion. */
(function(){
  var $ = function(i){ return document.getElementById(i); };
  var LIST = (window.PRODUITS || []).filter(function(p){ return p && p.nom; });
  function eur(n){ return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €"; }
  function eurS(n){ return (n % 1 ? n.toFixed(2).replace(".", ",") : String(n)) + " €"; }
  function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }
  function grams(p){ var m = String(p.poids || "250 g").match(/([\d.,]+)\s*(k?g)/i); if(!m) return 250; var v = parseFloat(m[1].replace(",", ".")); return /kg/i.test(m[2]) ? v * 1000 : v; }
  function left(p){ return window.BCShop ? BCShop.stockOf(p.id) : Infinity; }
  function buyable(p){ return p.disponible && left(p) > 0; }
  function perKilo(p){ return eurS(Math.round(p.prix / grams(p) * 1000 * 100) / 100); }

  /* ---------- Visuel : photo, ou vignette au monogramme en attendant ---------- */
  function visual(p, big){
    var w = el("div", "pv" + (big ? " big" : ""));
    if(p.image){
      var img = el("img"); img.src = p.image; img.alt = p.nom; img.loading = "lazy"; img.decoding = "async";
      img.onerror = function(){ img.remove(); w.appendChild(placeholder(p)); };
      w.appendChild(img);
    } else w.appendChild(placeholder(p));
    var out = p.disponible && left(p) <= 0;
    var label = !p.disponible ? "Bientôt disponible" : out ? "Épuisé" : (left(p) <= 5 ? "Plus que " + left(p) : p.badge);
    if(label) w.appendChild(el("span", "pbadge" + (!p.disponible || out ? " soon" : left(p) <= 5 ? " low" : ""), label));
    return w;
  }
  function placeholder(p){
    var d = el("div", "ph"); d.setAttribute("aria-hidden", "true");
    d.appendChild(el("span", "mark"));
    d.appendChild(el("span", "phn", p.nom));
    d.appendChild(el("span", "phs", "Maison Bartheau · " + (p.poids || "250 g")));
    return d;
  }

  /* ---------- Cartes produit ---------- */
  function card(p){
    var a = el("article", "pcard" + (p.disponible ? "" : " off"));
    var vb = el("button", "pvbtn"); vb.type = "button"; vb.setAttribute("aria-label", "Voir la fiche : " + p.nom);
    vb.appendChild(visual(p)); vb.addEventListener("click", function(){ openDlg(p); });
    a.appendChild(vb);
    var b = el("div", "pbody");
    if(p.accroche) b.appendChild(el("span", "k", p.accroche));
    b.appendChild(el("h3", null, p.nom));
    var d = p.description || (p.disponible ? "" : "Un nouveau café se prépare à la Maison. Laissez-nous votre e-mail pour être prévenu de sa sortie.");
    if(d) b.appendChild(el("p", "pdesc", d));
    var f = el("div", "pfoot");
    var pr = el("span", "pprice"); pr.appendChild(el("b", null, eurS(p.prix))); pr.appendChild(document.createTextNode(" · " + (p.poids || "250 g")));
    f.appendChild(pr);
    var acts = el("span", "pacts");
    var more = el("button", "btn small", "Découvrir"); more.type = "button"; more.addEventListener("click", function(){ openDlg(p); });
    acts.appendChild(more); acts.appendChild(orderBtn(p, true));
    f.appendChild(acts); b.appendChild(f); a.appendChild(b);
    return a;
  }
  function orderBtn(p, small){
    var x;
    if(buyable(p)){
      x = el("a", "btn solid" + (small ? " small" : ""), "Commander"); x.href = "#boutique";
      x.addEventListener("click", function(){ if(window.BCShop) BCShop.pick(p.id); closeDlg(); });
    } else {
      x = el("a", "btn" + (small ? " small" : ""), "Me prévenir");
      var to = (window.INFO && INFO.email) || "";
      x.href = to ? "mailto:" + to + "?subject=" + encodeURIComponent("Prévenez-moi : " + p.nom) + "&body=" + encodeURIComponent("Bonjour,\n\nPouvez-vous me prévenir dès que « " + p.nom + " » sera " + (p.disponible ? "de nouveau en stock" : "disponible") + " ?\n\nMerci !") : "#contact";
    }
    return x;
  }
  function drawGrids(){
    [["prodGrid", 0], ["prodGridHome", 3]].forEach(function(g){
      var host = $(g[0]); if(!host) return;
      host.textContent = "";
      var L = g[1] ? LIST.slice(0, g[1]) : LIST;
      L.forEach(function(p){ host.appendChild(card(p)); });
      host.classList.toggle("n1", L.length === 1); host.classList.toggle("n2", L.length === 2);
    });
  }

  /* ---------- Fiche détaillée ---------- */
  var dlg = $("pDlg");
  function openDlg(p){
    if(!dlg) return;
    var v = $("dVis"); v.textContent = ""; v.appendChild(visual(p, true));
    $("dAcc").textContent = p.accroche || "Nos cafés";
    $("dName").textContent = p.nom;
    $("dDesc").textContent = p.description || (p.disponible ? "" : "Ce café arrive bientôt. Sa fiche complète sera publiée à sa sortie.");
    var dl = $("dSpecs"); dl.textContent = "";
    [["Origine", p.origine], ["Torréfaction", p.torrefaction], ["Format", (p.poids || "250 g") + ", en grains ou moulu"], ["Prix au kilo", perKilo(p)]].forEach(function(r){
      if(!r[1]) return; dl.appendChild(el("dt", null, r[0])); dl.appendChild(el("dd", null, r[1]));
    });
    if(p.intensite > 0){
      dl.appendChild(el("dt", null, "Intensité"));
      var dd = el("dd", "dots"); dd.setAttribute("aria-label", p.intensite + " sur 5");
      for(var i = 1; i <= 5; i++) dd.appendChild(el("i", i <= p.intensite ? "on" : ""));
      dl.appendChild(dd);
    }
    var n = $("dNotes"); n.textContent = "";
    (p.notes || []).filter(Boolean).forEach(function(t){ n.appendChild(el("span", null, t)); });
    $("dPrice").textContent = eurS(p.prix);
    var c = $("dCta"); c.textContent = ""; c.appendChild(orderBtn(p, false));
    if(dlg.showModal){ dlg.showModal(); } else dlg.setAttribute("open", "");
    document.body.classList.add("dlgopen");
  }
  function closeDlg(){ if(dlg && dlg.open){ dlg.close ? dlg.close() : dlg.removeAttribute("open"); } }
  if(dlg){
    $("dClose").addEventListener("click", closeDlg);
    dlg.addEventListener("click", function(e){ if(e.target === dlg) closeDlg(); });
    dlg.addEventListener("close", function(){ document.body.classList.remove("dlgopen"); });
  }

  drawGrids();
  if(window.BCShop) BCShop.onStock(drawGrids);
})();
