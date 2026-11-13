/* Maison Bartheau Café · panier, stock en direct et paiement Stripe.
   Le prix payé est toujours recalculé par le serveur (netlify/functions/checkout.mjs).
   Si le paiement en ligne n'est pas encore activé, le panier se transforme en
   commande à envoyer par e-mail, comme avant. */
(function(){
  var $ = function(i){ return document.getElementById(i); };
  if(!$("composer")) return;
  var LIST = (window.PRODUITS || []).filter(function(p){ return p && p.id && p.nom; });
  var byId = {}; LIST.forEach(function(p){ byId[p.id] = p; });
  var CART_KEY = "bc-cart", PEND_KEY = "bc-pending";
  var API = null, stockCbs = [];
  var qty = 1;

  function eur(n){ return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €"; }
  function eurS(n){ return (n % 1 ? n.toFixed(2).replace(".", ",") : String(n)) + " €"; }
  function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }
  function lsGet(k, d){ try{ var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; }catch(e){ return d; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function grams(p){ var m = String(p.poids || "250 g").match(/([\d.,]+)\s*(k?g)/i); if(!m) return 250; var v = parseFloat(m[1].replace(",", ".")); return /kg/i.test(m[2]) ? v * 1000 : v; }
  function avail(){ return LIST.filter(function(p){ return p.disponible; }); }
  function live(){ return !!(API && API.ok && API.paiement); }
  function stockOf(id){ return live() ? Math.max(0, Number(API.stock[id]) || 0) : Infinity; }
  function inCart(id){ return cart.filter(function(l){ return l.id === id; }).reduce(function(s, l){ return s + l.qty; }, 0); }
  function ship(){ var L = live() ? API.livraison : (window.LIVRAISON || {}); return { frais: typeof L.frais === "number" ? L.frais : (typeof L.fraisEnvoi === "number" ? L.fraisEnvoi : null), offerteDes: typeof L.offerteDes === "number" ? L.offerteDes : null, retrait: L.retrait !== false }; }

  /* ---------- Panier (gardé sur l'appareil) ---------- */
  var cart = lsGet(CART_KEY, []).filter(function(l){ return l && byId[l.id] && byId[l.id].disponible && l.qty > 0; });
  function saveCart(){ lsSet(CART_KEY, cart); }

  /* ---------- Composer une ligne ---------- */
  var sel = $("prod"), fmt = $("fmt");
  var finder = typeof makeFinder === "function" ? makeFinder($("finderS"), "fs", function(){}) : null;
  function cur(){ return byId[sel.value] || avail()[0]; }
  function fillProducts(){
    var keep = sel.value; sel.textContent = "";
    avail().forEach(function(p){
      var s = stockOf(p.id), o = el("option", null, p.nom + " · " + eurS(p.prix) + (s <= 0 ? " (épuisé)" : ""));
      o.value = p.id; o.disabled = s <= 0; sel.appendChild(o);
    });
    if(keep && byId[keep]) sel.value = keep;
    if(sel.selectedOptions[0] && sel.selectedOptions[0].disabled){ var firstOk = avail().filter(function(p){ return stockOf(p.id) > 0; })[0]; if(firstOk) sel.value = firstOk.id; }
    $("prodField").hidden = avail().length < 2;
  }
  function drawComposer(){
    var p = cur(); if(!p){ $("addBtn").disabled = true; return; }
    window.PRICE = p.prix;
    $("pName").textContent = p.nom;
    $("pSub").textContent = p.accroche || "Torréfaction artisanale";
    $("pImg").src = p.image || "logo.jpg";
    var pp = $("pPrice"); pp.textContent = eurS(p.prix);
    pp.appendChild(el("small", null, "le sachet de " + (p.poids || "250 g") + " · " + eurS(Math.round(p.prix / grams(p) * 1000 * 100) / 100) + " le kilo"));
    var left = stockOf(p.id) - inCart(p.id), sl = $("pStock");
    if(live()){
      sl.hidden = false;
      sl.className = "stockline " + (left <= 0 ? "out" : left <= 5 ? "low" : "ok");
      sl.textContent = stockOf(p.id) <= 0 ? "Rupture de stock · revient bientôt" : left <= 0 ? "Tout le stock disponible est déjà dans votre panier" : left <= 5 ? "Plus que " + left + " en stock" : "En stock · expédié rapidement";
    } else sl.hidden = true;
    var max = Math.max(1, Math.min(30, left === Infinity ? 30 : left));
    if(qty > max) qty = max;
    $("qtyOut").textContent = qty;
    $("addBtn").disabled = left <= 0;
    $("finderS").hidden = fmt.value !== "moulu";
  }
  sel.addEventListener("change", function(){ qty = 1; drawComposer(); $("addStatus").textContent = ""; });
  fmt.addEventListener("change", drawComposer);
  $("plus").addEventListener("click", function(){ var p = cur(), left = stockOf(p.id) - inCart(p.id); if(qty < Math.min(30, left)){ qty++; drawComposer(); } });
  $("minus").addEventListener("click", function(){ if(qty > 1){ qty--; drawComposer(); } });

  function grindInfo(){
    if(fmt.value !== "moulu") return {ok:true, format:"grains", mouture:"", machine:""};
    var r = finder ? finder.get() : {complete:false};
    if(!r.complete) return {ok:false, msg:"Choisissez votre machine pour que nous moulions au bon format."};
    if(r.type === "dosette") return {ok:false, msg:"Nos cafés ne conviennent pas aux capsules et dosettes."};
    if(r.type === "grains") return {ok:true, format:"grains", mouture:"", machine:r.machine, note:"Votre machine a un broyeur : nous vous envoyons des grains."};
    return {ok:true, format:"moulu", mouture:(window.GR && GR[r.type] && GR[r.type].f) || r.grind, machine:r.machine};
  }
  $("addBtn").addEventListener("click", function(){
    var p = cur(), st = $("addStatus"), g = grindInfo();
    if(!g.ok){ st.className = "status err"; st.textContent = g.msg; return; }
    var left = stockOf(p.id) - inCart(p.id);
    if(left < qty){ st.className = "status err"; st.textContent = left > 0 ? "Il ne reste que " + left + " sachet" + (left > 1 ? "s" : "") + " disponible" + (left > 1 ? "s" : "") + "." : "Ce café est épuisé pour le moment."; return; }
    var same = cart.filter(function(l){ return l.id === p.id && l.format === g.format && l.mouture === g.mouture && l.machine === g.machine; })[0];
    if(same) same.qty = Math.min(30, same.qty + qty);
    else cart.push({id:p.id, qty:qty, format:g.format, mouture:g.mouture, machine:g.machine});
    saveCart();
    st.className = "status"; st.textContent = (g.note ? g.note + " " : "") + "Ajouté au panier ✓";
    qty = 1; drawComposer(); drawCart();
    if(window.innerWidth < 860) setTimeout(function(){ $("slip").scrollIntoView({behavior:"smooth", block:"start"}); }, 250);
  });

  /* ---------- Calcul du panier ---------- */
  function aboState(){
    var abo = $("mode").value === "abo", months = parseInt($("engage").value, 10) || 0, per = parseInt($("rhythm").value, 10) || 1;
    var disc = !abo ? 0 : months >= 12 ? 15 : months >= 6 ? 10 : months >= 3 ? 5 : 0;
    return {abo:abo, months:months, per:per, disc:disc, n: months ? months * per : 0};
  }
  function totals(){
    var A = aboState(), sub = 0, goods = 0, n = 0;
    cart.forEach(function(l){ var p = byId[l.id]; sub += p.prix * l.qty; goods += Math.round(p.prix * (1 - A.disc / 100) * 100) / 100 * l.qty; n += l.qty; });
    var S = ship(), retrait = $("cRec").value === "retrait", shipAmt = 0, shipTxt, shipKnown = true;
    if(retrait){ shipTxt = "offert (retrait)"; }
    else if(S.frais === null){ shipKnown = false; shipTxt = "à confirmer"; }
    else if(S.offerteDes !== null && goods >= S.offerteDes){ shipTxt = "offert"; }
    else { shipAmt = S.frais; shipTxt = eur(S.frais); }
    return {A:A, sub:sub, goods:goods, off:sub - goods, ship:shipAmt, shipTxt:shipTxt, shipKnown:shipKnown, total:goods + shipAmt, n:n, retrait:retrait};
  }
  function lineDetail(l){
    if(l.format === "moulu") return "Moulu" + (l.mouture ? " · " + l.mouture : "") + (l.machine ? " · " + l.machine : "");
    return "Grains" + (l.machine ? " · pour " + l.machine : "");
  }

  function drawCart(){
    var list = $("cartList"); list.textContent = "";
    var T = totals();
    $("cartEmpty").hidden = cart.length > 0; $("cartBody").hidden = cart.length === 0;
    $("cartCount").textContent = T.n ? T.n + (T.n > 1 ? " sachets" : " sachet") : "";
    cart.forEach(function(l, i){
      var p = byId[l.id], li = el("li", "cline");
      var im = el("img"); im.src = p.image || "logo.jpg"; im.alt = ""; im.width = 56; im.height = 56; li.appendChild(im);
      var mid = el("div", "cmid"); mid.appendChild(el("b", null, p.nom)); mid.appendChild(el("span", null, lineDetail(l)));
      var q = el("div", "qty mini");
      var bm = el("button", null, "–"); bm.type = "button"; bm.setAttribute("aria-label", "Retirer un sachet de " + p.nom);
      var o = el("output", null, String(l.qty));
      var bp = el("button", null, "+"); bp.type = "button"; bp.setAttribute("aria-label", "Ajouter un sachet de " + p.nom);
      bm.addEventListener("click", function(){ if(l.qty > 1){ l.qty--; } else { cart.splice(i, 1); } saveCart(); drawComposer(); drawCart(); });
      bp.addEventListener("click", function(){ if(l.qty < 30 && inCart(l.id) < stockOf(l.id)){ l.qty++; saveCart(); drawComposer(); drawCart(); } else { $("status").className = "status err"; $("status").textContent = "Stock maximum atteint pour " + p.nom + "."; } });
      q.appendChild(bm); q.appendChild(o); q.appendChild(bp); mid.appendChild(q);
      li.appendChild(mid);
      var right = el("div", "cright"); right.appendChild(el("b", null, eur(p.prix * l.qty)));
      var rm = el("button", "toggle", "Retirer"); rm.type = "button"; rm.addEventListener("click", function(){ cart.splice(i, 1); saveCart(); drawComposer(); drawCart(); });
      right.appendChild(rm); li.appendChild(right);
      list.appendChild(li);
    });
    if(!cart.length){ window.dispatchEvent(new Event("bc-cart")); return; }

    var A = T.A, every = A.per === 2 ? "toutes les 2 semaines" : "chaque mois";
    $("aboBox").hidden = !A.abo;
    $("subAmt").textContent = eur(T.sub);
    $("discLbl").hidden = $("discAmt").hidden = !(A.abo && A.disc);
    $("discLbl").textContent = "Remise abonnement −" + A.disc + " %";
    $("discAmt").textContent = "−" + eur(T.off);
    $("shipAmt").textContent = T.shipTxt;
    $("totLbl").textContent = (A.abo ? (A.per === 2 ? "Par livraison" : "Par mois") : "Total") + (T.shipKnown ? "" : " hors envoi");
    $("total").textContent = eur(T.total);
    $("gift").hidden = !(A.abo && A.months && A.disc);
    if(A.abo && A.months && A.disc){ $("engLbl").textContent = "Économisé sur " + (A.months === 12 ? "l'année" : A.months + " mois"); $("engAmt").textContent = eur(T.off * A.n) + " offerts par la Maison"; }
    $("aboNote").textContent = !A.abo ? "" : "Prélevé " + eur(T.total) + " " + every + ", au fil des livraisons : jamais d'avance." + (A.months ? " Engagement de " + A.months + " mois (" + A.n + " livraisons), prix garanti." : " Sans engagement : vous arrêtez quand vous voulez.");

    var S = ship(); $("cRec").querySelector('option[value="retrait"]').hidden = !S.retrait;
    if(!S.retrait && $("cRec").value === "retrait") $("cRec").value = "livraison";

    // Fidélité
    var fn = $("fidNote");
    if(window.BCFID && BCFID.hasAccount() && !A.abo){
      var s = BCFID.stats(), to = (window.INFO && INFO.email) || "";
      fn.hidden = false; fn.textContent = "";
      if(s.avail > 0){
        fn.appendChild(document.createTextNode("🎁 Vous avez " + s.avail + (s.avail > 1 ? " sachets offerts" : " sachet offert") + ". "));
        var a = el("a", null, "Demandez votre code cadeau"); a.href = to ? "mailto:" + to + "?subject=" + encodeURIComponent("Mon sachet offert (fidélité)") : "#contact";
        fn.appendChild(a); fn.appendChild(document.createTextNode(", à saisir au moment du paiement."));
      } else fn.textContent = "Carte de fidélité : " + s.toward + "/10. Cette commande ajoute " + T.n + (T.n > 1 ? " sachets" : " sachet") + ".";
    } else fn.hidden = true;

    // Paiement direct, ou commande par e-mail
    var direct = live() && T.shipKnown;
    $("payZone").hidden = !direct; $("fallback").hidden = direct;
    $("payLbl").textContent = A.abo ? "S'abonner · " + eur(T.total) + (A.per === 2 ? " / livraison" : " / mois") : "Payer " + eur(T.total);
    if(!direct) buildFallback(T);
    window.dispatchEvent(new Event("bc-cart"));
  }
  ["mode", "engage", "rhythm", "cRec"].forEach(function(id){ $(id).addEventListener("change", drawCart); });

  /* ---------- Commande par e-mail (si le paiement en ligne n'est pas actif) ---------- */
  var REF = (function(){ var d = new Date(), z = function(x){ return (x < 10 ? "0" : "") + x; }, a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", r = ""; for(var i = 0; i < 4; i++) r += a.charAt(Math.floor(Math.random() * a.length)); return "BC-" + z(d.getDate()) + z(d.getMonth() + 1) + "-" + r; })();
  function buildFallback(T){
    var A = T.A, lines = cart.map(function(l, i){ var p = byId[l.id]; return (i + 1) + ". " + l.qty + " × " + p.nom + " (" + (p.poids || "250 g") + "), " + lineDetail(l); });
    var txt = (A.abo ? "ABONNEMENT" : "COMMANDE") + " MAISON BARTHEAU CAFÉ, réf. " + REF + "\nDate : " + new Date().toLocaleDateString("fr-FR") + "\n\nÀ PRÉPARER" + (A.abo ? " (à chaque livraison)" : "") + "\n" + lines.join("\n") +
      (A.abo ? "\n\nABONNEMENT\nRythme : " + (A.per === 2 ? "toutes les 2 semaines" : "tous les mois") + "\nEngagement : " + (A.months ? A.months + " mois" : "sans") + "\nRemise : " + A.disc + " %" : "") +
      "\n\nTOTAL : " + eur(T.total) + " TTC" + (T.shipKnown ? " (envoi : " + T.shipTxt + ")" : " + envoi à confirmer") + "\nRéception : " + (T.retrait ? "retrait en main propre (à convenir)" : "livraison") +
      "\n\nMES COORDONNÉES\nNom :\nTéléphone :\nAdresse :\n\nMerci de me confirmer l'envoi et le paiement.";
    $("orderText").value = txt;
    var to = (window.INFO && (INFO.emailCommande || INFO.email)) || "";
    if(to) $("mailBtn").href = "mailto:" + to + "?subject=" + encodeURIComponent((A.abo ? "Abonnement " : "Commande ") + REF) + "&body=" + encodeURIComponent(txt);
  }
  $("copyBtn").addEventListener("click", function(){
    var t = $("orderText"), st = $("status");
    try{ navigator.clipboard.writeText(t.value).then(function(){ st.className = "status"; st.textContent = "Commande copiée. Collez-la dans un message ou un e-mail."; }, function(){ t.select(); }); }catch(e){ t.select(); }
  });

  /* ---------- Paiement Stripe ---------- */
  $("payBtn").addEventListener("click", function(){
    var b = $("payBtn"), st = $("status"), T = totals(), A = T.A;
    if(!cart.length || b.disabled) return;
    var acc = lsGet("bc-client", null);
    b.disabled = true; b.classList.add("loading"); $("payLbl").textContent = "Ouverture du paiement sécurisé…";
    st.className = "status"; st.textContent = "";
    fetch("/api/checkout", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({
      items: cart.map(function(l){ return {id:l.id, qty:l.qty, format:l.format, mouture:l.mouture, machine:l.machine}; }),
      mode: A.abo ? "abo" : "unique", rythme: A.per, engagement: A.months,
      reception: T.retrait ? "retrait" : "livraison",
      email: acc && acc.mail ? acc.mail : ""
    })}).then(function(r){ return r.json().then(function(j){ return {status:r.status, j:j}; }); }).then(function(res){
      if(res.j && res.j.url){
        lsSet(PEND_KEY, {id:res.j.id, ref:res.j.reference, n:T.n, abo:A.abo, at:Date.now()});
        location.href = res.j.url; return;
      }
      if(res.status === 409 && res.j.stock && API) Object.keys(res.j.stock).forEach(function(id){ API.stock[id] = res.j.stock[id]; });
      throw new Error((res.j && res.j.error) || "Le paiement n'a pas pu être ouvert.");
    }).catch(function(e){
      st.className = "status err"; st.textContent = e.message && e.message !== "Failed to fetch" ? e.message : "Connexion impossible. Vérifiez votre réseau et réessayez.";
      b.disabled = false; b.classList.remove("loading"); fillProducts(); drawComposer(); drawCart();
    });
  });

  /* ---------- Retour de Stripe ---------- */
  function cleanUrl(){ try{ history.replaceState(null, "", location.pathname + location.hash); }catch(e){} }
  var q = new URLSearchParams(location.search);
  if(q.get("annule")){
    fetch("/api/cancel", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({id:q.get("annule")})}).catch(function(){}).then(loadStock);
    try{ localStorage.removeItem(PEND_KEY); }catch(e){}
    $("status").className = "status"; $("status").textContent = "Paiement annulé : votre panier est toujours là.";
    cleanUrl();
  }
  if(q.get("session_id")){
    var pend = lsGet(PEND_KEY, null);
    if(pend && pend.id === q.get("session_id")){
      if(window.BCFID && BCFID.hasAccount() && !pend.abo) BCFID.record({ref:pend.ref, date:new Date().toLocaleDateString("fr-FR"), n:pend.n, fid:0});
      $("merciRef").textContent = "Référence de votre commande : " + pend.ref;
      cart = []; saveCart();
      try{ localStorage.removeItem(PEND_KEY); }catch(e){}
    }
    cleanUrl();
  }

  /* ---------- Stock en direct ---------- */
  function loadStock(){
    return fetch("/api/stock", {cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){ API = j; }).catch(function(){ API = null; }).then(function(){
      // retire du panier ce qui n'est plus en stock
      if(live()) cart.forEach(function(l){ var left = stockOf(l.id) - cart.filter(function(x){ return x !== l && x.id === l.id; }).reduce(function(s, x){ return s + x.qty; }, 0); if(l.qty > left) l.qty = Math.max(0, left); });
      cart = cart.filter(function(l){ return l.qty > 0; }); saveCart();
      fillProducts(); drawComposer(); drawCart();
      stockCbs.forEach(function(cb){ try{ cb(); }catch(e){} });
    });
  }
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState === "visible") loadStock(); });
  window.addEventListener("bc-account", drawCart);

  window.BCShop = {
    pick: function(id){ if(byId[id]){ sel.value = id; qty = 1; drawComposer(); } },
    stockOf: stockOf, live: live,
    onStock: function(cb){ stockCbs.push(cb); }
  };
  fillProducts(); drawComposer(); drawCart();
  loadStock();
})();
