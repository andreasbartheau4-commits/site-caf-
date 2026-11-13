// POST /api/cancel : le client a quitté la page de paiement → on libère tout de suite son stock réservé.
import { json, stripe, releaseReservation } from "./lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const sk = stripe(); if (!sk) return json({ ok: false }, 503);
  let id = "";
  try { id = String((await req.json()).id || ""); } catch {}
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return json({ ok: false }, 400);
  try {
    const s = await sk.checkout.sessions.retrieve(id);
    if (s.status === "open") await sk.checkout.sessions.expire(id);
    if (s.status !== "complete") await releaseReservation(id);
    return json({ ok: true });
  } catch (e) {
    console.error(e); return json({ ok: false }, 500);
  }
};

export const config = { path: "/api/cancel" };
