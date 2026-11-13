/* Maison Bartheau Café · catalogue « Nos cafés » et page de paiement sécurisé.
   Les produits se règlent dans assets/produits.js, le paiement dans assets/config.js. */
(function(){
  var $ = function(i){ return document.getElementById(i); };
  var LIST = (window.PRODUITS || []).filter(function(p){ return p && p.nom; });
  var PAY = window.PAIEMENT || {};
  function eur(n){ return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €"; }
  function eurS(n){ return (n % 1 ? n.toFixed(2).replace(".", ",") : String(n)) + " €"; }
  function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }
  function grams(p){ var m = String(p.poids || "250 g").match(/([\d.,]+)\s*(k?g)/i); if(!m) return 250; var v = parseFloat(m[1].replace(",", ".")); return /kg/i.test(m[2]) ? v * 1000 : v; }
  function perKilo(p){ return eurS(Math.round(p.prix / grams(p) * 1000 * 100) / 100); }

  /* ---------- Visuel : photo, ou vignette au monogramme en attendant ---------- */
  function visual(p, big){
    var w = el("div", "pv" + (big ? " big" : ""));
    if(p.image){
      var img = el("img"); img.src = p.image; img.alt = p.nom; img.loading = "lazy"; img.decoding = "async";
      img.onerror = function(){ img.remove(); w.appendChild(placeholder(p)); };
      w.appendChild(img);
    } else w.appendChild(placeholder(p));
    if(p.badge || !p.disponible) w.appendChild(el("span", "pbadge" + (p.disponible ? "" : " soon"), p.disponible ? p.badge : "Bientôt disponible"));
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
    if(p.disponible){
      x = el("a", "btn solid" + (small ? " small" : ""), "Commander"); x.href = "#boutique";
      x.addEventListener("click", function(){ pick(p.id); closeDlg(); });
    } else {
      x = el("a", "btn" + (small ? " small" : ""), "Me prévenir");
      var to = (window.INFO && INFO.email) || "";
      x.href = to ? "mailto:" + to + "?subject=" + encodeURIComponent("Prévenez-moi : " + p.nom) + "&body=" + encodeURIComponent("Bonjour,\n\nPouvez-vous me prévenir dès que « " + p.nom + " » sera disponible ?\n\nMerci !") : "#contact";
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

  /* ---------- Sélecteur de café dans la commande ---------- */
  var sel = $("prod");
  function avail(){ return LIST.filter(function(p){ return p.disponible; }); }
  function applyProd(){
    var p = avail().filter(function(x){ return x.id === sel.value; })[0] || avail()[0];
    if(!p) return;
    window.PRICE = p.prix;
    $("pName").textContent = p.nom;
    $("pSub").textContent = p.accroche || "Torréfaction artisanale";
    $("pImg").src = p.image || "logo.jpg";
    var pp = $("pPrice"); pp.textContent = eurS(p.prix);
    pp.appendChild(el("small", null, "le sachet de " + (p.poids || "250 g") + " · " + perKilo(p) + " le kilo"));
    if(typeof window.render === "function") window.render();
  }
  function pick(id){ if(!sel) return; sel.value = id; applyProd(); }
  if(sel){
    avail().forEach(function(p){ var o = el("option", null, p.nom + " · " + eurS(p.prix)); o.value = p.id; sel.appendChild(o); });
    $("prodField").hidden = avail().length < 2;
    sel.addEventListener("change", applyProd);
    applyProd();
  }

  /* ---------- Paiement ---------- */
  var hasStripe = /^https:\/\//.test(PAY.stripe || ""), hasPaypal = /^https:\/\//.test(PAY.paypal || "");
  var V = PAY.virement || {}, hasIban = !!(V.iban && V.titulaire);
  var anyPay = hasStripe || hasPaypal || hasIban;
  function means(){ var m = []; if(hasStripe) m.push("Carte bancaire"); if(hasPaypal) m.push("PayPal"); if(hasIban) m.push("Virement"); return m; }

  /* Bloc « Paiement sécurisé » dans la commande */
  function shop(){
    var O = window.BC_ORDER; if(!O || !$("payBox")) return;
    var btn = $("payNow"), note = $("payNote");
    $("payMeans").textContent = anyPay ? "Moyens acceptés : " + means().join(" · ") : "";
    if(!anyPay){ btn.hidden = true; note.textContent = "Après confirmation de votre commande, nous vous envoyons un lien de paiement sécurisé. Rien n'est prélevé avant."; return; }
    if(O.abo){ btn.hidden = true; note.textContent = "Chaque livraison se règle séparément, sur notre page de paiement sécurisée, après notre confirmation. Jamais d'avance."; return; }
    if(!O.known){ btn.hidden = true; note.textContent = "Envoyez votre commande : dès que nous vous confirmons les frais d'envoi, vous la réglez en ligne sur notre page de paiement sécurisée."; return; }
    btn.hidden = false; $("payNowAmt").textContent = eur(O.total);
    note.textContent = "Réglez maintenant sur la page sécurisée de notre prestataire (connexion chiffrée, 3-D Secure). Vos données bancaires ne passent jamais par notre site.";
  }
  window.BCPay = {shop: shop};
  if($("payNow")) $("payNow").addEventListener("click", function(){
    var O = window.BC_ORDER;
    if(typeof machineOk === "function" && (!machineOk() || !custOk())){ $("status").scrollIntoView({block:"center"}); return; }
    if(typeof recordOrder === "function") recordOrder();
    O = window.BC_ORDER;
    try{ sessionStorage.setItem("bc-pay", JSON.stringify(O)); }catch(e){}
    location.hash = "paiement?ref=" + encodeURIComponent(O.ref) + "&m=" + O.total.toFixed(2);
  });
  shop();

  /* Page « Paiement » */
  function parseAmt(v){ var n = parseFloat(String(v || "").replace(/\s|€/g, "").replace(",", ".")); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; }
  function cleanRef(v){ return String(v || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 60); }
  function params(){ var q = (location.hash.split("?")[1] || ""), o = {}; q.split("&").forEach(function(kv){ var a = kv.split("="); if(a[0]) o[a[0]] = decodeURIComponent(a[1] || ""); }); return o; }
  function copyBtn(text, label){
    var b = el("button", "btn small", label || "Copier"); b.type = "button";
    b.addEventListener("click", function(){ try{ navigator.clipboard.writeText(text()).then(function(){ b.textContent = "Copié"; setTimeout(function(){ b.textContent = label || "Copier"; }, 1600); }); }catch(e){} });
    return b;
  }
  function payState(){ return {ref: cleanRef($("payRef").value), amt: parseAmt($("payAmt").value)}; }
  function check(){
    var s = payState(), st = $("payStatus");
    if(!s.ref || !s.amt){ st.className = "status err"; st.textContent = "Indiquez la référence de votre commande et le montant à régler."; $("payRef").focus(); return null; }
    st.className = "status"; st.textContent = ""; return s;
  }
  function drawPay(){
    var host = $("payOpts"); if(!host) return;
    host.textContent = ""; $("payNone").hidden = anyPay;
    var s = payState(), amt = s.amt ? eur(s.amt) : "";
    if(hasStripe){
      var o = el("div", "payopt");
      var h = el("div", "payopt-h"); h.appendChild(el("b", null, "Carte bancaire")); h.appendChild(el("span", "cards", "CB · Visa · Mastercard"));
      o.appendChild(h);
      o.appendChild(el("p", "note", "Page sécurisée Stripe. Saisissez le montant exact" + (amt ? " : " + amt : "") + ", la référence est transmise automatiquement."));
      var b = el("button", "btn solid", "Payer " + (amt || "") + " par carte"); b.type = "button";
      b.addEventListener("click", function(){
        var x = check(); if(!x) return;
        var O = window.BC_ORDER || {}, url = PAY.stripe + (PAY.stripe.indexOf("?") >= 0 ? "&" : "?") + "client_reference_id=" + encodeURIComponent(x.ref);
        if(O.mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(O.mail)) url += "&prefilled_email=" + encodeURIComponent(O.mail);
        window.open(url, "_blank", "noopener");
      });
      var row = el("div", "cta"); row.appendChild(b); if(s.amt) row.appendChild(copyBtn(function(){ return payState().amt.toFixed(2).replace(".", ","); }, "Copier le montant"));
      o.appendChild(row); host.appendChild(o);
    }
    if(hasPaypal){
      var o2 = el("div", "payopt");
      var h2 = el("div", "payopt-h"); h2.appendChild(el("b", null, "PayPal")); h2.appendChild(el("span", "cards", "Compte PayPal ou carte"));
      o2.appendChild(h2);
      o2.appendChild(el("p", "note", "Le montant est prérempli. Indiquez la référence " + (s.ref || "de commande") + " dans le message."));
      var b2 = el("button", hasStripe ? "btn" : "btn solid", "Payer " + (amt || "") + " avec PayPal"); b2.type = "button";
      b2.addEventListener("click", function(){ var x = check(); if(!x) return; window.open(PAY.paypal.replace(/\/+$/, "") + "/" + x.amt.toFixed(2) + "EUR", "_blank", "noopener"); });
      var r2 = el("div", "cta"); r2.appendChild(b2); o2.appendChild(r2); host.appendChild(o2);
    }
    if(hasIban){
      var o3 = el("div", "payopt");
      var h3 = el("div", "payopt-h"); h3.appendChild(el("b", null, "Virement bancaire")); h3.appendChild(el("span", "cards", "Expédition à réception"));
      o3.appendChild(h3);
      var dl = el("dl", "ibanl");
      [["Titulaire", V.titulaire], ["IBAN", V.iban], ["BIC", V.bic], ["Montant", amt], ["Référence", s.ref]].forEach(function(r){ if(!r[1]) return; dl.appendChild(el("dt", null, r[0])); var dd = el("dd"); dd.appendChild(el("code", null, r[1])); dl.appendChild(dd); });
      o3.appendChild(dl);
      var r3 = el("div", "cta"); r3.appendChild(copyBtn(function(){ return V.iban.replace(/\s/g, ""); }, "Copier l'IBAN")); o3.appendChild(r3);
      o3.appendChild(el("p", "note", "Indiquez bien la référence dans le libellé du virement : votre colis part dès réception."));
      host.appendChild(o3);
    }
  }
  function initPay(){
    if(!$("payRef")) return;
    var q = params(), O = null;
    try{ O = JSON.parse(sessionStorage.getItem("bc-pay") || "null"); }catch(e){}
    if(q.ref) $("payRef").value = cleanRef(q.ref);
    if(q.m) $("payAmt").value = parseAmt(q.m) ? parseAmt(q.m).toFixed(2).replace(".", ",") : "";
    var mine = O && O.ref && cleanRef(O.ref) === cleanRef($("payRef").value);
    $("payOrder").hidden = !mine;
    if(mine){ window.BC_ORDER = O; $("payRecap").textContent = O.txt; $("payMail").href = O.href || "#contact"; }
    drawPay();
  }
  ["payRef", "payAmt"].forEach(function(id){ var e = $(id); if(e) e.addEventListener("input", drawPay); });
  window.addEventListener("bc-page", function(){ if((location.hash || "").indexOf("#paiement") === 0) initPay(); });

  drawGrids();
  initPay();
})();
