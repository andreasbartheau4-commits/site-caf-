// POST /api/stripe-webhook : notifications de Stripe (paiement réussi, abandon, renouvellement d'abonnement).
import { json, stripe, store, releaseReservation, updateStock } from "./lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const sk = stripe(), secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sk || !secret) return json({ error: "Non configuré" }, 503);
  const raw = await req.text();
  let event;
  try {
    event = sk.webhooks.constructEvent(raw, req.headers.get("stripe-signature") || "", secret);
  } catch (e) {
    return json({ error: "Signature invalide" }, 400);
  }

  // Chaque notification n'est traitée qu'une fois, même si Stripe la renvoie.
  const s = store();
  const first = await s.setJSON("evt/" + event.id, { t: Date.now(), type: event.type }, { onlyIfNew: true });
  if (first && first.modified === false) return json({ ok: true, deja: true });

  try {
    const o = event.data.object;
    if (event.type === "checkout.session.completed") {
      // Payé : le stock réservé est définitivement vendu.
      await s.delete("resa/" + o.id);
      await s.setJSON("vente/" + o.id, { reference: o.client_reference_id, total: o.amount_total, at: Date.now(), detail: o.metadata && o.metadata.detail });
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      await releaseReservation(o.id);
    } else if (event.type === "invoice.paid") {
      // Renouvellement d'abonnement : on retire les sachets de la nouvelle livraison.
      const reason = o.billing_reason;
      const md = (o.parent && o.parent.subscription_details && o.parent.subscription_details.metadata) || (o.subscription_details && o.subscription_details.metadata) || {};
      if (reason === "subscription_cycle" && md.stock) {
        let need = {}; try { need = JSON.parse(md.stock); } catch {}
        await updateStock((st) => { for (const id of Object.keys(need)) st[id] = (Number(st[id]) || 0) - Number(need[id] || 0); return st; });
      }
    }
  } catch (e) {
    console.error(e);
    await s.delete("evt/" + event.id).catch(() => {}); // Stripe réessaiera
    return json({ error: "Erreur de traitement" }, 500);
  }
  return json({ ok: true });
};

export const config = { path: "/api/stripe-webhook" };
