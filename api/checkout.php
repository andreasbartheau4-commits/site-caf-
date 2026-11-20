<?php
// Maison Bartheau Café · ouverture du paiement Stripe (carte, Apple Pay, Google Pay).
// GET  : indique au site si le paiement en ligne est actif et les règles de livraison.
// POST : vérifie le panier, RECALCULE les prix à partir de assets/produits.js
//        (le navigateur ne fixe aucun prix) et renvoie l'adresse de la page de paiement Stripe.
require __DIR__ . '/lib.php';

$site = bc_site();
$liv = $site['livraison'];
$key = bc_secret();
$frais = is_numeric($liv['fraisEnvoi'] ?? null) ? (float)$liv['fraisEnvoi'] : null;
$seuil = is_numeric($liv['offerteDes'] ?? null) ? (float)$liv['offerteDes'] : null;
$retraitOk = ($liv['retrait'] ?? true) !== false;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
  bc_json(['ok' => true, 'paiement' => $key !== '', 'livraison' => ['frais' => $frais, 'offerteDes' => $seuil, 'retrait' => $retraitOk]]);
}
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
if ($sachets > 60) bc_json(['error' => 'Pour plus de 60 sachets, contactez-nous directement.'], 400);

// ---- Formule ----
$abo = ($body['mode'] ?? '') === 'abo';
$rythme = (int)($body['rythme'] ?? 1) === 2 ? 2 : 1;
$engagement = in_array((int)($body['engagement'] ?? 0), [0, 3, 6, 12], true) ? (int)$body['engagement'] : 0;
$disc = $abo ? bc_discount($engagement) : 0;

// ---- Réception ----
$retrait = ($body['reception'] ?? '') === 'retrait';
if ($retrait && !$retraitOk) bc_json(['error' => "Le retrait n'est pas proposé."], 400);
$goods = 0;
foreach ($items as $i) $goods += bc_cents($i['o']['prix'] * (1 - $disc / 100)) * $i['qty'];
$ship = 0;
if (!$retrait) {
  if ($frais === null) bc_json(['error' => "La livraison n'est pas encore configurée. Choisissez le retrait ou contactez-nous."], 503);
  $ship = ($seuil !== null && $goods >= bc_cents($seuil)) ? 0 : bc_cents($frais);
}
$email = filter_var($body['email'] ?? '', FILTER_VALIDATE_EMAIL) ? substr((string)$body['email'], 0, 200) : '';

// ---- Session de paiement Stripe ----
$origin = bc_origin();
$alpha = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; $r = '';
for ($k = 0; $k < 5; $k++) $r .= $alpha[random_int(0, strlen($alpha) - 1)];
$reference = 'BC-' . date('dm') . '-' . $r;
$recurring = $abo ? ($rythme === 2 ? ['interval' => 'week', 'interval_count' => 2] : ['interval' => 'month', 'interval_count' => 1]) : null;
$formule = $abo ? 'abonnement ' . ($rythme === 2 ? 'toutes les 2 semaines' : 'mensuel') . ', engagement ' . ($engagement ? $engagement . ' mois' : 'aucun') . ", remise $disc %" : 'achat unique';
$detail = mb_substr(implode(' | ', array_map(fn($i) => $i['qty'] . ' x ' . $i['p']['nom'] . ' ' . $i['o']['nom'] . ' (' . ($i['moulu'] ? 'moulu' . ($i['mouture'] ? ' ' . $i['mouture'] : '') . ($i['machine'] ? ', ' . $i['machine'] : '') : 'grains') . ')', $items)), 0, 490);

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
if ($abo && $ship > 0) $line[] = ['quantity' => 1, 'price_data' => ['currency' => 'eur', 'unit_amount' => $ship, 'recurring' => $recurring, 'product_data' => ['name' => 'Livraison · colis suivi']]];

$meta = ['reference' => $reference, 'formule' => $formule, 'reception' => $retrait ? 'retrait en main propre' : 'livraison', 'detail' => $detail];
$params = [
  'mode' => $abo ? 'subscription' : 'payment',
  'line_items' => $line,
  'locale' => 'fr',
  'client_reference_id' => $reference,
  'phone_number_collection' => ['enabled' => 'true'],
  'allow_promotion_codes' => 'true',
  'billing_address_collection' => 'auto',
  'custom_fields' => [['key' => 'precision', 'label' => ['type' => 'custom', 'custom' => $retrait ? 'Créneau souhaité pour le retrait' : 'Précision pour la livraison'], 'type' => 'text', 'optional' => 'true', 'text' => ['maximum_length' => 200]]],
  'custom_text' => ['submit' => ['message' => $abo ? "Abonnement : $formule. Vous êtes prélevé à chaque livraison, jamais d'avance." : 'Paiement sécurisé par Stripe. Vous recevez un reçu par e-mail.']],
  'metadata' => $meta,
  'expires_at' => time() + 31 * 60,
  'success_url' => $origin . '/index.html?session_id={CHECKOUT_SESSION_ID}#merci',
  'cancel_url' => $origin . '/index.html?annule=1#boutique',
];
if ($email) $params['customer_email'] = $email;
if (!$retrait) $params['shipping_address_collection'] = ['allowed_countries' => ['FR']];
if ($abo) {
  $params['subscription_data'] = ['metadata' => $meta, 'description' => 'Maison Bartheau Café · ' . $formule];
} else {
  $params['customer_creation'] = 'if_required';
  $params['payment_intent_data'] = ['metadata' => $meta, 'description' => 'Commande ' . $reference];
  if (!$retrait) $params['shipping_options'] = [['shipping_rate_data' => ['type' => 'fixed_amount', 'display_name' => $ship ? 'Colis suivi' : 'Livraison offerte', 'fixed_amount' => ['amount' => $ship, 'currency' => 'eur']]]];
}

$res = bc_stripe($key, 'POST', 'checkout/sessions', $params);
if ($res['status'] !== 200 || empty($res['data']['url'])) {
  error_log('Stripe checkout: ' . $res['status'] . ' ' . json_encode($res['data']['error'] ?? $res['error']));
  bc_json(['error' => "Le paiement n'a pas pu être préparé. Réessayez dans un instant."], 502);
}
bc_json(['url' => $res['data']['url'], 'reference' => $reference, 'id' => $res['data']['id']]);
