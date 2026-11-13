// POST /api/checkout : vérifie le panier, réserve le stock et ouvre le paiement Stripe.
// Les prix sont TOUJOURS recalculés ici à partir de assets/produits.js : le navigateur ne fixe aucun prix.
import { json, loadSite, stripe, store, cents, discountFor, updateStock, sumByProduct, releaseReservation, originOf } from "./lib/shared.mjs";

const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ref() {
  const d = new Date(), z = (x) => String(x).padStart(2, "0"), a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let r = ""; for (let i = 0; i < 5; i++) r += a[Math.floor(Math.random() * a.length)];
  return "BC-" + z(d.getDate()) + z(d.getMonth() + 1) + "-" + r;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const sk = stripe();
  if (!sk) return json({ error: "Le paiement en ligne n'est pas encore activé." }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }

  const { produits, livraison } = loadSite();
  const byId = Object.fromEntries(produits.map((p) => [p.id, p]));

  // ---- Panier ----
  const raw = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
  const items = [];
  for (const it of raw) {
    const p = byId[it && it.id];
    const qty = Math.floor(Number(it && it.qty));
    if (!p || !p.disponible) return json({ error: "Un café de votre panier n'est plus disponible." }, 400);
    if (!(qty >= 1 && qty <= 30)) return json({ error: "Quantité invalide." }, 400);
    if (typeof p.prix !== "number" || !(p.prix > 0)) return json({ error: "Prix non configuré pour " + p.nom }, 500);
    const moulu = it.format === "moulu";
    items.push({ p, qty, moulu, mouture: moulu ? clip(it.mouture, 80) : "", machine: moulu ? clip(it.machine, 100) : "" });
  }
  if (!items.length) return json({ error: "Votre panier est vide." }, 400);
  const need = sumByProduct(items.map((i) => ({ id: i.p.id, qty: i.qty })));
  if (Object.values(need).reduce((a, b) => a + b, 0) > 60) return json({ error: "Pour plus de 60 sachets, contactez-nous directement." }, 400);

  // ---- Formule ----
  const abo = body.mode === "abo";
  const rythme = Number(body.rythme) === 2 ? 2 : 1;
  const engagement = [0, 3, 6, 12].includes(Number(body.engagement)) ? Number(body.engagement) : 0;
  const disc = abo ? discountFor(engagement) : 0;

  // ---- Réception ----
  const retrait = body.reception === "retrait";
  if (retrait && livraison.retrait === false) return json({ error: "Le retrait n'est pas proposé." }, 400);
  let shipCents = 0;
  const goods = items.reduce((s, i) => s + cents(i.p.prix * (1 - disc / 100)) * i.qty, 0);
  if (!retrait) {
    if (typeof livraison.fraisEnvoi !== "number") return json({ error: "La livraison n'est pas encore configurée. Choisissez le retrait ou contactez-nous." }, 503);
    const free = typeof livraison.offerteDes === "number" && goods >= cents(livraison.offerteDes);
    shipCents = free ? 0 : cents(livraison.fraisEnvoi);
  }
  const email = EMAIL.test(String(body.email || "")) ? String(body.email).slice(0, 200) : undefined;

  // ---- Réservation du stock ----
  try {
    await updateStock((st) => {
      for (const id of Object.keys(need)) {
        const have = Number(st[id]) || 0;
        if (have < need[id]) {
          const e = new Error(have > 0 ? `Il ne reste que ${have} sachet${have > 1 ? "s" : ""} de « ${byId[id].nom} ».` : `« ${byId[id].nom} » est en rupture de stock.`);
          e.code = "STOCK"; e.stock = { [id]: Math.max(0, have) }; throw e;
        }
      }
      for (const id of Object.keys(need)) st[id] = (Number(st[id]) || 0) - need[id];
      return st;
    });
  } catch (e) {
    if (e.code === "STOCK") return json({ error: e.message, stock: e.stock }, 409);
    console.error(e); return json({ error: "Stock momentanément indisponible, réessayez." }, 503);
  }

  // ---- Session de paiement Stripe ----
  const origin = originOf(req);
  const reference = ref();
  const recurring = abo ? (rythme === 2 ? { interval: "week", interval_count: 2 } : { interval: "month", interval_count: 1 }) : undefined;
  const detail = items.map((i) => `${i.qty} x ${i.p.nom} (${i.moulu ? "moulu" + (i.mouture ? " " + i.mouture : "") + (i.machine ? ", " + i.machine : "") : "grains"})`).join(" | ").slice(0, 490);
  const line_items = items.map((i) => {
    const img = i.p.image && /^https:/.test(origin) ? [origin + "/" + String(i.p.image).replace(/^\/+/, "")] : undefined;
    return {
      quantity: i.qty,
      price_data: {
        currency: "eur",
        unit_amount: cents(i.p.prix * (1 - disc / 100)),
        ...(recurring ? { recurring } : {}),
        product_data: {
          name: `${i.p.nom} · ${i.p.poids || "250 g"}`,
          description: i.moulu ? `Moulu${i.mouture ? " : " + i.mouture : ""}${i.machine ? " · machine " + i.machine : ""}` : "En grains",
          ...(img ? { images: img } : {}),
          metadata: { produit: i.p.id },
        },
      },
    };
  });
  if (abo && shipCents > 0) {
    line_items.push({ quantity: 1, price_data: { currency: "eur", unit_amount: shipCents, recurring, product_data: { name: "Livraison · colis suivi" } } });
  }
  const meta = {
    reference,
    formule: abo ? `abonnement ${rythme === 2 ? "toutes les 2 semaines" : "mensuel"}, engagement ${engagement || "aucun"}${engagement ? " mois" : ""}, remise ${disc} %` : "achat unique",
    reception: retrait ? "retrait en main propre" : "livraison",
    detail,
    stock: JSON.stringify(need).slice(0, 490),
  };

  let session;
  try {
    session = await sk.checkout.sessions.create({
      mode: abo ? "subscription" : "payment",
      line_items,
      locale: "fr",
      client_reference_id: reference,
      customer_email: email,
      ...(abo ? {} : { customer_creation: "if_required" }),
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      ...(retrait ? {} : { shipping_address_collection: { allowed_countries: ["FR"] } }),
      ...(!abo && !retrait ? { shipping_options: [{ shipping_rate_data: { type: "fixed_amount", display_name: shipCents ? "Colis suivi" : "Livraison offerte", fixed_amount: { amount: shipCents, currency: "eur" } } }] } : {}),
      custom_fields: [{ key: "precision", label: { type: "custom", custom: retrait ? "Créneau souhaité pour le retrait" : "Précision pour la livraison" }, type: "text", optional: true, text: { maximum_length: 200 } }],
      custom_text: { submit: { message: abo ? `Abonnement : ${meta.formule}. Vous êtes prélevé à chaque livraison, jamais d'avance.` : "Paiement sécurisé par Stripe. Vous recevez un reçu par e-mail." } },
      metadata: meta,
      ...(abo ? { subscription_data: { metadata: meta, description: `Maison Bartheau Café · ${meta.formule}` } } : { payment_intent_data: { metadata: meta, description: `Commande ${reference}` } }),
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${origin}/index.html?session_id={CHECKOUT_SESSION_ID}#merci`,
      cancel_url: `${origin}/index.html?annule={CHECKOUT_SESSION_ID}#boutique`,
    });
  } catch (e) {
    console.error(e);
    // rend le stock réservé
    await updateStock((st) => { for (const id of Object.keys(need)) st[id] = (Number(st[id]) || 0) + need[id]; return st; }).catch(() => {});
    return json({ error: "Le paiement n'a pas pu être préparé. Réessayez dans un instant." }, 502);
  }

  try {
    await store().setJSON("resa/" + session.id, { items: need, at: Date.now(), reference });
  } catch (e) {
    console.error(e);
    await sk.checkout.sessions.expire(session.id).catch(() => {});
    await updateStock((st) => { for (const id of Object.keys(need)) st[id] = (Number(st[id]) || 0) + need[id]; return st; }).catch(() => {});
    return json({ error: "Stock momentanément indisponible, réessayez." }, 503);
  }
  return json({ url: session.url, reference, id: session.id });
};

export const config = { path: "/api/checkout" };
