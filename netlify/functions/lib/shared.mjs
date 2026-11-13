// Maison Bartheau Café · outils communs aux fonctions serveur (Netlify Functions).
// Le catalogue et les réglages sont lus dans assets/produits.js et assets/config.js :
// ce sont les mêmes fichiers que le site, il n'y a donc qu'un seul endroit à modifier.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function findFile(rel) {
  const tries = [
    path.resolve(process.cwd(), rel),
    path.resolve(HERE, "../../..", rel),
    path.resolve(HERE, "../..", rel),
    path.resolve(HERE, "..", rel),
    process.env.LAMBDA_TASK_ROOT ? path.resolve(process.env.LAMBDA_TASK_ROOT, rel) : null,
  ].filter(Boolean);
  for (const t of tries) if (fs.existsSync(t)) return t;
  throw new Error("Fichier introuvable : " + rel);
}

// Exécute les fichiers de réglages du site dans un bac à sable et récupère leurs variables.
export function loadSite() {
  const ctx = { console };
  vm.createContext(ctx);
  for (const rel of ["assets/config.js", "assets/produits.js"]) {
    vm.runInContext(fs.readFileSync(findFile(rel), "utf8") + "\n;globalThis.__x = { INFO: typeof INFO !== 'undefined' ? INFO : null, PRODUITS: typeof PRODUITS !== 'undefined' ? PRODUITS : null, LIVRAISON: typeof LIVRAISON !== 'undefined' ? LIVRAISON : null };", ctx, { timeout: 1000 });
  }
  const x = ctx.__x || {};
  const produits = Array.isArray(x.PRODUITS) ? x.PRODUITS.filter((p) => p && p.id && p.nom) : [];
  return { info: x.INFO || {}, produits, livraison: x.LIVRAISON || {} };
}

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { maxNetworkRetries: 2 });
}

export const store = () => getStore({ name: "boutique", consistency: "strong" });

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export const cents = (euros) => Math.round(Number(euros) * 100);

export function discountFor(months) {
  return months >= 12 ? 15 : months >= 6 ? 10 : months >= 3 ? 5 : 0;
}

/* ---------- Stock ----------
   Un seul document « stock » : { idProduit: quantité }. Chaque modification relit le document
   et n'écrit que s'il n'a pas changé entre-temps (etag), pour éviter les ventes en double. */
export async function readStock() {
  const r = await store().getWithMetadata("stock", { type: "json" });
  return { stock: (r && r.data) || {}, etag: r ? r.etag : undefined };
}

export async function updateStock(mutator) {
  const s = store();
  for (let i = 0; i < 8; i++) {
    const r = await s.getWithMetadata("stock", { type: "json" });
    const current = { ...((r && r.data) || {}) };
    const next = mutator(current); // peut lever une erreur (ex. stock insuffisant)
    const res = r
      ? await s.setJSON("stock", next, { onlyIfMatch: r.etag })
      : await s.setJSON("stock", next, { onlyIfNew: true });
    if (!res || res.modified !== false) return next;
    await new Promise((ok) => setTimeout(ok, 40 + Math.random() * 120));
  }
  throw new Error("Le stock est très sollicité, réessayez dans un instant.");
}

export function sumByProduct(items) {
  const m = {};
  for (const it of items) m[it.id] = (m[it.id] || 0) + it.qty;
  return m;
}

export async function releaseReservation(sessionId) {
  const s = store();
  const key = "resa/" + sessionId;
  const resa = await s.get(key, { type: "json" });
  if (!resa) return false;
  await s.delete(key); // supprimée d'abord : une seconde notification ne rendra pas le stock deux fois
  const add = resa.items || {};
  await updateStock((st) => {
    for (const id of Object.keys(add)) st[id] = (Number(st[id]) || 0) + add[id];
    return st;
  });
  return true;
}

/* ---------- Mot de passe de la page « Gestion » ---------- */
export function adminOk(req) {
  const want = process.env.ADMIN_PASSWORD || "";
  const got = req.headers.get("x-admin-password") || "";
  if (want.length < 10) return null; // pas configuré
  const a = crypto.createHash("sha256").update(want).digest();
  const b = crypto.createHash("sha256").update(got).digest();
  return crypto.timingSafeEqual(a, b);
}

export function originOf(req) {
  if (process.env.URL && /^https:\/\//.test(process.env.URL) && process.env.CONTEXT === "production") return process.env.URL.replace(/\/+$/, "");
  const u = new URL(req.url);
  return u.origin;
}
