// GET/POST /api/admin/stock : lecture et mise à jour du stock depuis la page privée gestion.html.
import { json, loadSite, readStock, updateStock, adminOk, store } from "./lib/shared.mjs";

export default async (req) => {
  const ok = adminOk(req);
  if (ok === null) return json({ error: "Ajoutez la variable ADMIN_PASSWORD (10 caractères minimum) dans Netlify." }, 503);
  if (!ok) { await new Promise((r) => setTimeout(r, 800)); return json({ error: "Mot de passe incorrect." }, 401); }

  const { produits } = loadSite();
  const ids = new Set(produits.map((p) => p.id));

  if (req.method === "POST") {
    let body; try { body = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }
    const set = body && body.stock && typeof body.stock === "object" ? body.stock : {};
    await updateStock((st) => {
      for (const id of Object.keys(set)) {
        const n = Math.floor(Number(set[id]));
        if (ids.has(id) && n >= 0 && n <= 100000) st[id] = n;
      }
      return st;
    });
  } else if (req.method !== "GET") return json({ error: "Méthode non autorisée" }, 405);

  const { stock } = await readStock();
  // paniers en cours de paiement (stock réservé pendant 30 minutes)
  const reserved = {};
  try {
    const { blobs } = await store().list({ prefix: "resa/" });
    for (const b of blobs.slice(0, 200)) {
      const r = await store().get(b.key, { type: "json" });
      if (r && r.items) for (const id of Object.keys(r.items)) reserved[id] = (reserved[id] || 0) + r.items[id];
    }
  } catch {}
  return json({
    ok: true,
    produits: produits.map((p) => ({ id: p.id, nom: p.nom, disponible: !!p.disponible, prix: p.prix, stock: Number(stock[p.id]) || 0, reserve: reserved[p.id] || 0 })),
  });
};

export const config = { path: "/api/admin/stock" };
