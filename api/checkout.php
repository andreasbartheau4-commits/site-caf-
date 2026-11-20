<?php
// Maison Bartheau Café · ouverture du paiement Stripe (carte, Apple Pay, Google Pay).
// GET  : indique au site si le paiement en ligne est actif et les règles de livraison.
// POST : vérifie le panier, RECALCULE les prix à partir de assets/produits.js
//        (le navigateur ne fixe aucun prix) et renvoie l'adresse de la page de paiement Stripe.
require_once __DIR__ . '/lib.php';

$site = bc_site();
$liv = $site['livraison'];
$key = bc_secret();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') { require __DIR__ . '/shipping.php'; exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') bc_json(['error' => 'Méthode non autorisée'], 405);
if ($key === '') bc_json(['error' => "Le paiement en ligne n'est pas encore activé."], 503);

$body = json_decode(file_get_contents('php://input', false, null, 0, 20000) ?: '', true);
if (!is_array($body)) bc_json(['error' => 'Requête invalide'], 400);

$byId = [];
foreach ($site['produits'] as $p) $byId[(string)$p['id']] = $p;

// ---- Panier ----
$items = [];
foreach (array_slice(is_array($body['items'] ?? null) ? $body['items'] : [], 0, 20) as $it) {
  if (!is_array($it)) bc_json(['error' => 'Requête invalide'], 400);
  $p = $byId[(string)($it['id'] ?? '')] ?? null;
  $qty = (int)($it['qty'] ?? 0);
  if (!$p || empty($p['disponible'])) bc_json(['error' => "Un café de votre panier n'est plus disponible."], 400);
  if ($qty < 1 || $qty > 30) bc_json(['error' => 'Quantité invalide.'], 400);
  $offres = bc_offres($p);
  $o = $offres[0];
  foreach ($offres as $x) if ($x['id'] === (string)($it['offre'] ?? '')) $o = $x;
  if ($o['prix'] <= 0) bc_json(['error' => 'Prix non configuré pour ' . $p['nom']], 500);
  $moulu = ($it['format'] ?? '') === 'moulu';
  $items[] = ['p' => $p, 'o' => $o, 'qty' => $qty, 'moulu' => $moulu,
    'mouture' => $moulu ? bc_clip($it['mouture'] ?? '', 80) : '', 'machine' => $moulu ? bc_clip($it['machine'] ?? '', 100) : ''];
}
if (!$items) bc_json(['error' => 'Votre panier est vide.'], 400);
$sachets = array_sum(array_map(fn($i) => $i['qty'] * $i['o']['sachets'], $items));


// ---- Formule ----
$abo = ($body['mode'] ?? '') === 'abo';
$rythme = (int)($body['rythme'] ?? 1) === 2 ? 2 : 1;
$engagement = in_array((int)($body['engagement'] ?? 0), [0, 3, 6, 12], true) ? (int)$body['engagement'] : 0;
$disc = $abo ? bc_discount($engagement) : 0;

// ---- Réception : point relais, domicile ou retrait (frais selon le nombre de sachets) ----
$mode = in_array($body['reception'] ?? '', ['relais', 'domicile', 'retrait'], true) ? $body['reception'] : 'relais';
$S = bc_ship($sachets, $mode, $liv);
if (!$S['ok']) bc_json(['error' => $S['erreur']], 400);
$retrait = $mode === 'retrait';
$ship = $S['cents'];
$email = filter_var($body['email'] ?? '', FILTER_VALIDATE_EMAIL) ? substr((string)$body['email'], 0, 200) : '';

// ---- Session de paiement Stripe ----
$origin = bc_origin();
$alpha = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; $r = '';
for ($k = 0; $k < 5; $k++) $r .= $alpha[random_int(0, strlen($alpha) - 1)];
$reference = 'BC-' . date('dm') . '-' . $r;
$recurring = $abo ? ($rythme === 2 ? ['interval' => 'week', 'interval_count' => 2] : ['interval' => 'month', 'interval_count' => 1]) : null;
$formule = $abo ? 'abonnement ' . ($rythme === 2 ? 'toutes les 2 semaines' : 'mensuel') . ', engagement ' . ($engagement ? $engagement . ' mois' : 'aucun') . ", remise $disc %" : 'achat unique';
$detail = mb_substr(implode(' | ', array_map(fn($i) => $i['qty'] . ' x ' . $i['p']['nom'] . ' ' . $i['o']['nom'] . ' (' . ($i['moulu'] ? 'moulu' . ($i['mouture'] ? ' ' . $i['mouture'] : '') . ($i['machine'] ? ', ' . $i['machine'] : '') : 'grains') . ')', $items)), 0, 490);

$livraisons = $abo && $engagement ? $engagement * $rythme : 0;
$line = [];
foreach ($items as $i) {
  $pd = [
    'name' => $i['p']['nom'] . ' · ' . $i['o']['nom'],
    'description' => $i['moulu'] ? 'Moulu' . ($i['mouture'] ? ' : ' . $i['mouture'] : '') . ($i['machine'] ? ' · machine ' . $i['machine'] : '') : 'En grains',
    'metadata' => ['produit' => (string)$i['p']['id'], 'format' => $i['o']['id'], 'sachets' => (string)$i['o']['sachets']],
  ];
  if (!empty($i['p']['image']) && str_starts_with($origin, 'https://')) $pd['images'] = [$origin . '/' . ltrim((string)$i['p']['image'], '/')];
  $pdata = ['currency' => 'eur', 'unit_amount' => bc_cents($i['o']['prix'] * (1 - $disc / 100)), 'product_data' => $pd];
  if ($recurring) $pdata['recurring'] = $recurring;
  $line[] = ['quantity' => $i['qty'], 'price_data' => $pdata];
}
if ($abo && $ship > 0) $line[] = ['quantity' => 1, 'price_data' => ['currency' => 'eur', 'unit_amount' => $ship, 'recurring' => $recurring, 'product_data' => ['name' => 'Envoi · ' . $S['label']]]];

$meta = ['reference' => $reference, 'formule' => $formule, 'reception' => $S['label'], 'mode_envoi' => $mode, 'detail' => $detail,
  'sachets' => (string)$sachets, 'envoi_centimes' => (string)$ship,
  'rythme' => (string)$rythme, 'engagement_mois' => (string)$engagement, 'livraisons' => (string)$livraisons];
$champ = $mode === 'relais'
  ? ['key' => 'relais', 'label' => 'Point relais Mondial Relay souhaité (nom, ville)', 'optional' => 'true']
  : ($retrait ? ['key' => 'precision', 'label' => 'Créneau souhaité pour le retrait', 'optional' => 'true']
              : ['key' => 'precision', 'label' => 'Précision pour la livraison', 'optional' => 'true']);
$params = [
  'mode' => $abo ? 'subscription' : 'payment',
  'line_items' => $line,
  'locale' => 'fr',
  'client_reference_id' => $reference,
  'phone_number_collection' => ['enabled' => 'true'],
  'allow_promotion_codes' => 'true',
  'billing_address_collection' => 'auto',
  'custom_fields' => [['key' => $champ['key'], 'label' => ['type' => 'custom', 'custom' => mb_substr($champ['label'], 0, 50)], 'type' => 'text', 'optional' => $champ['optional'], 'text' => ['maximum_length' => 200]]],
  'custom_text' => ['submit' => ['message' => $abo
      ? "Abonnement : $formule" . ($livraisons ? ", $livraisons livraisons puis arrêt automatique" : '') . ". Prélevé à chaque livraison, jamais d'avance. Résiliable en ligne à tout moment."
      : ($mode === 'relais' ? "Point relais : indiquez celui que vous préférez, sinon nous choisissons le plus proche de votre adresse." : 'Paiement sécurisé par Stripe. Vous recevez un reçu par e-mail.')]],
  'metadata' => $meta,
  'expires_at' => time() + 31 * 60,
  'success_url' => $origin . '/merci.html?session_id={CHECKOUT_SESSION_ID}',
  'cancel_url' => $origin . '/index.html?annule=1#boutique',
];
if ($email) $params['customer_email'] = $email;
if (!$retrait) $params['shipping_address_collection'] = ['allowed_countries' => ['FR']];
if ($abo) {
  $params['subscription_data'] = ['metadata' => $meta, 'description' => 'Maison Bartheau Café · ' . $formule];
} else {
  $params['customer_creation'] = 'if_required';
  $params['payment_intent_data'] = ['metadata' => $meta, 'description' => 'Commande ' . $reference];
  if (!$retrait) $params['shipping_options'] = [['shipping_rate_data' => ['type' => 'fixed_amount', 'display_name' => $S['label'], 'fixed_amount' => ['amount' => $ship, 'currency' => 'eur']]]];
}

if ($retrait) $params['billing_address_collection'] = 'required';
$res = bc_stripe($key, 'POST', 'checkout/sessions', $params);
if ($res['status'] !== 200 || empty($res['data']['url'])) {
  error_log('Stripe checkout: ' . $res['status'] . ' ' . json_encode($res['data']['error'] ?? $res['error']));
  bc_json(['error' => "Le paiement n'a pas pu être préparé. Réessayez dans un instant."], 502);
}
bc_json(['url' => $res['data']['url'], 'reference' => $reference, 'id' => $res['data']['id']]);
