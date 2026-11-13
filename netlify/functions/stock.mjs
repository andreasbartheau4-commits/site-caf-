// GET /api/stock : stock disponible de chaque café (public, sans donnée sensible).
import { json, loadSite, readStock } from "./lib/shared.mjs";

export default async () => {
  try {
    const { produits, livraison } = loadSite();
    const { stock } = await readStock();
    const out = {};
    for (const p of produits) out[p.id] = Math.max(0, Number(stock[p.id]) || 0);
    return json({
      ok: true,
      paiement: !!process.env.STRIPE_SECRET_KEY,
      stock: out,
      livraison: {
        frais: typeof livraison.fraisEnvoi === "number" ? livraison.fraisEnvoi : null,
        offerteDes: typeof livraison.offerteDes === "number" ? livraison.offerteDes : null,
        retrait: livraison.retrait !== false,
      },
    });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Stock indisponible" }, 500);
  }
};

export const config = { path: "/api/stock" };
