/* Maison Bartheau Café · mini-panier dans la barre du haut (toutes les pages).
   Lit et modifie le même panier que la page « Commander » (stockage local « bc-cart »). */
(function(){
  if(document.body.hasAttribute("data-nocart")) return;
  var tools = document.querySelector(".barwrap .tools");
  if(!tools) return;
  var KEY = "bc-cart";
  var onIndex = !!document.getElementById("composer");
  var LIST = (window.PRODUITS || []).filter(function(p){ return p && p.id; });
  var byId = {}; LIST.forEach(function(p){ byId[p.id] = p; });

  function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }
  function eur(n){ return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €"; }
  function read(){ try{ var c = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(c) ? c.filter(function(l){ return l && byId[l.id] && l.qty > 0; }) : []; }catch(e){ return []; } }
  function write(c){ try{ localStorage.setItem(KEY, JSON.stringify(c)); }catch(e){} window.dispatchEvent(new Event("bc-cart-ext")); render(); }
  function detail(l){ return l.format === "moulu" ? "Moulu" + (l.mouture ? " · " + l.mouture : "") + (l.machine ? " · " + l.machine : "") : "Grains" + (l.machine ? " · pour " + l.machine : ""); }
  function stockOf(id){ return window.BCShop ? BCShop.stockOf(id) : Infinity; }
  var BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>';

  /* ---------- Bouton dans la barre ---------- */
  var btn = el("button", "iconbtn cartbtn"); btn.type = "button"; btn.id = "cartBtn";
  btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-controls", "miniCart");
  btn.innerHTML = BAG + '<span class="cbadge" id="cartBadge" hidden></span>';
  var acct = tools.querySelector(".acctbtn, #burger");
  tools.insertBefore(btn, acct || null);

  /* ---------- Volet ---------- */
  var ov = el("div", "mc-ov"); ov.hidden = true;
  var dr = el("aside", "minicart"); dr.id = "miniCart"; dr.hidden = true;
  dr.setAttribute("role", "dialog"); dr.setAttribute("aria-modal", "true"); dr.setAttribute("aria-labelledby", "mcTitle");
  dr.innerHTML =
    '<div class="mc-head"><h3 id="mcTitle">Votre panier</h3><span class="cartcount" id="mcCount"></span>' +
    '<button class="iconbtn" type="button" id="mcClose" aria-label="Fermer le panier"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="mc-body"><ul class="cart" id="mcList"></ul>' +
    '<div class="mc-empty" id="mcEmpty"><span class="mc-bag">' + BAG + '</span><p>Votre panier est vide.</p><a class="btn solid" href="' + (onIndex ? "#produits" : "index.html#produits") + '" data-mc-close>Découvrir nos cafés</a></div></div>' +
    '<div class="mc-foot" id="mcFoot"><p class="freeship" id="mcFree" hidden></p><dl><dt>Sous-total</dt><dd id="mcSub"></dd></dl>' +
    '<p class="note">Livraison, remise abonnement et code promo à l\'étape suivante.</p>' +
    '<a class="btn solid" id="mcGo" href="' + (onIndex ? "#boutique" : "index.html#boutique") + '">Voir mon panier et payer <span class="arr" aria-hidden="true">→</span></a>' +
    '<button class="btn" type="button" data-mc-close>Continuer mes achats</button>' +
    '<p class="paymarks"><span>Apple Pay</span><span>Google Pay</span><span>CB</span><span>Visa</span><span>Mastercard</span></p></div>';
  document.body.appendChild(ov); document.body.appendChild(dr);
  var $ = function(i){ return document.getElementById(i); };

  var lastFocus = null;
  function open(){
    render(); lastFocus = document.activeElement;
    ov.hidden = false; dr.hidden = false;
    requestAnimationFrame(function(){ ov.classList.add("on"); dr.classList.add("on"); });
    document.body.classList.add("mcopen"); btn.setAttribute("aria-expanded", "true");
    setTimeout(function(){ $("mcClose").focus(); }, 60);
  }
  function close(){
    ov.classList.remove("on"); dr.classList.remove("on");
    document.body.classList.remove("mcopen"); btn.setAttribute("aria-expanded", "false");
    setTimeout(function(){ ov.hidden = true; dr.hidden = true; }, 300);
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }
  btn.addEventListener("click", open);
  ov.addEventListener("click", close);
  $("mcClose").addEventListener("click", close);
  dr.addEventListener("click", function(e){ if(e.target.closest("[data-mc-close]")) close(); });
  document.addEventListener("keydown", function(e){
    if(dr.hidden) return;
    if(e.key === "Escape") close();
    if(e.key === "Tab"){ // garde le focus dans le volet
      var f = dr.querySelectorAll("a[href],button:not([disabled])"); if(!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });
  $("mcGo").addEventListener("click", function(e){
    if(!onIndex) return;
    e.preventDefault(); close();
    if(location.hash !== "#boutique") location.hash = "boutique";
    setTimeout(function(){ var s = $("slip"); if(s) s.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"start"}); }, 120);
  });

  /* ---------- Affichage ---------- */
  var lastN = null;
  function render(){
    var cart = read(), list = $("mcList"), n = 0, sub = 0;
    list.textContent = "";
    cart.forEach(function(l, i){
      var p = byId[l.id], of = BCOffre(p, l.offre); n += l.qty * of.sachets; sub += of.prix * l.qty;
      var li = el("li", "cline");
      var im = el("img"); im.src = p.image || "logo.jpg"; im.alt = ""; im.width = 56; im.height = 56; li.appendChild(im);
      var mid = el("div", "cmid"); mid.appendChild(el("b", null, p.nom)); mid.appendChild(el("span", null, of.nom + " · " + detail(l)));
      var q = el("div", "qty mini");
      var bm = el("button", null, "–"); bm.type = "button"; bm.setAttribute("aria-label", "Retirer un sachet de " + p.nom);
      var o = el("output", null, String(l.qty));
      var bp = el("button", null, "+"); bp.type = "button"; bp.setAttribute("aria-label", "Ajouter un sachet de " + p.nom);
      bm.addEventListener("click", function(){ var c = read(); if(c[i].qty > 1) c[i].qty--; else c.splice(i, 1); write(c); });
      bp.addEventListener("click", function(){
        var c = read(), same = c.filter(function(x){ return x.id === l.id; }).reduce(function(s, x){ return s + x.qty * BCOffre(byId[x.id], x.offre).sachets; }, 0);
        if(c[i].qty < 30 && same + of.sachets <= stockOf(l.id)){ c[i].qty++; write(c); } else { bp.disabled = true; bp.title = "Stock maximum atteint"; }
      });
      q.appendChild(bm); q.appendChild(o); q.appendChild(bp); mid.appendChild(q); li.appendChild(mid);
      var right = el("div", "cright"); right.appendChild(el("b", null, eur(of.prix * l.qty)));
      var rm = el("button", "toggle", "Retirer"); rm.type = "button"; rm.addEventListener("click", function(){ var c = read(); c.splice(i, 1); write(c); });
      right.appendChild(rm); li.appendChild(right); list.appendChild(li);
    });
    $("mcEmpty").hidden = cart.length > 0; $("mcFoot").hidden = cart.length === 0; list.hidden = cart.length === 0;
    $("mcCount").textContent = n ? n + (n > 1 ? " sachets" : " sachet") : "";
    $("mcSub").textContent = eur(sub);
    var L = window.LIVRAISON || {}, fr = $("mcFree");
    if(typeof L.offerteDes === "number" && typeof L.fraisEnvoi === "number"){
      fr.hidden = false; fr.textContent = "";
      if(sub >= L.offerteDes){ fr.className = "freeship ok"; fr.textContent = "Livraison offerte ✓"; }
      else { fr.className = "freeship"; fr.appendChild(document.createTextNode("Plus que ")); fr.appendChild(el("b", null, eur(L.offerteDes - sub))); fr.appendChild(document.createTextNode(" pour la livraison offerte")); var bar = el("i"); bar.style.setProperty("--p", Math.round(sub / L.offerteDes * 100) + "%"); fr.appendChild(bar); }
    } else fr.hidden = true;
    var b = $("cartBadge"); b.hidden = n === 0; b.textContent = n > 99 ? "99+" : String(n);
    btn.setAttribute("aria-label", n ? "Mon panier : " + n + (n > 1 ? " sachets" : " sachet") + ", " + eur(sub) : "Mon panier (vide)");
    if(lastN !== null && n > lastN){ btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump"); }
    lastN = n;
  }
  window.addEventListener("bc-cart", render);
  window.addEventListener("storage", function(e){ if(e.key === KEY){ render(); window.dispatchEvent(new Event("bc-cart-ext")); } });
  window.BCMini = { open: open, close: close, render: render };
  render();
})();
