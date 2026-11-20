<?php
// Maison Bartheau Café · notifications Stripe (à déclarer dans Stripe > Développeurs > Webhooks).
// Événements : checkout.session.completed, checkout.session.async_payment_succeeded,
//              invoice.paid, customer.subscription.deleted
// Chaque notification est vérifiée (signature) et n'est traitée qu'une seule fois.
require_once __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') bc_json(['error' => 'Méthode non autorisée'], 405);
$secret = trim((string)(bc_conf()['webhook_secret'] ?? ''));
$key = bc_secret();
$payload = file_get_contents('php://input') ?: '';
if (!bc_verify_signature($payload, $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '', $secret)) bc_json(['error' => 'Signature invalide'], 400);
$event = json_decode($payload, true);
if (!is_array($event) || empty($event['id'])) bc_json(['error' => 'Notification illisible'], 400);
if (!bc_once($event['id'])) bc_json(['ok' => true, 'deja' => true]);

$site = bc_site();
$info = $site['info'];
$origin = 'https://www.maisonbartheau.com';
$host = preg_replace('~[^A-Za-z0-9.-]~', '', $_SERVER['HTTP_HOST'] ?? '');
if ($host && !preg_match('~^(localhost|127\.)~', $host)) $origin = 'https://' . $host;
$o = $event['data']['object'] ?? [];

function eur_c($c) { return number_format(((int)$c) / 100, 2, ',', ' ') . ' €'; }
function adresse_txt($a) {
  if (!is_array($a)) return '';
  return trim(implode("\n", array_filter([$a['line1'] ?? '', $a['line2'] ?? '', trim(($a['postal_code'] ?? '') . ' ' . ($a['city'] ?? '')), ($a['country'] ?? '') !== 'FR' ? ($a['country'] ?? '') : ''])));
}
function champ_perso($session, $key) {
  foreach (($session['custom_fields'] ?? []) as $f) if (($f['key'] ?? '') === $key) return trim((string)($f['text']['value'] ?? ''));
  return '';
}
function fin_engagement(array $meta, int $start): int {
  $n = (int)($meta['livraisons'] ?? 0);
  if ($n <= 0) return 0;
  $d = (new DateTimeImmutable('@' . $start))->setTimezone(new DateTimeZone('Europe/Paris'));
  $end = (int)($meta['rythme'] ?? 1) === 2 ? $d->modify('+' . (14 * $n) . ' days') : $d->modify('+' . $n . ' months');
  return $end->getTimestamp() - 3600; // juste avant l'échéance qui suivrait la dernière livraison
}

try {
  switch ($event['type'] ?? '') {

    /* ---- Commande payée (ou abonnement souscrit) ---- */
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (($o['payment_status'] ?? '') === 'unpaid') break; // paiement différé : on attend async_payment_succeeded
      $m = $o['metadata'] ?? [];
      $cd = $o['customer_details'] ?? [];
      $ship = $o['collected_information']['shipping_details'] ?? ($o['shipping_details'] ?? null);
      $adr = adresse_txt($ship['address'] ?? null) ?: adresse_txt($cd['address'] ?? null);
      $nom = $ship['name'] ?? ($cd['name'] ?? '');
      $relais = champ_perso($o, 'relais');
      $precision = champ_perso($o, 'precision');
      $abo = ($o['mode'] ?? '') === 'subscription';
      $fin = '';
      if ($abo && !empty($o['subscription']) && $key) {
        $sub = bc_stripe($key, 'GET', 'subscriptions/' . rawurlencode($o['subscription']));
        $start = (int)($sub['data']['start_date'] ?? time());
        $cancelAt = fin_engagement($m, $start);
        if ($cancelAt > time()) {
          $r = bc_stripe($key, 'POST', 'subscriptions/' . rawurlencode($o['subscription']), ['cancel_at' => $cancelAt]);
          if ($r['status'] !== 200) throw new RuntimeException('cancel_at refusé : ' . json_encode($r['data']['error'] ?? $r['error']));
          $fin = (new DateTimeImmutable('@' . $cancelAt))->setTimezone(new DateTimeZone('Europe/Paris'))->format('d/m/Y');
        }
      }
      $lignes = str_replace(' | ', "\n  • ", $m['detail'] ?? '');
      $total = eur_c($o['amount_total'] ?? 0);
      $envoi = (int)($m['envoi_centimes'] ?? 0);

      // à la Maison
      $txt = ($abo ? "NOUVEL ABONNEMENT" : "NOUVELLE COMMANDE PAYÉE") . " · " . ($m['reference'] ?? $o['client_reference_id'] ?? '') . "\n\n"
        . "À PRÉPARER\n  • $lignes\n  Sachets : " . ($m['sachets'] ?? '?') . "\n\n"
        . "ENVOI : " . ($m['reception'] ?? '') . " (" . ($envoi ? eur_c($envoi) : 'offert') . ")\n"
        . ($relais ? "Point relais souhaité : $relais\n" : (($m['mode_envoi'] ?? '') === 'relais' ? "Point relais : non précisé, choisir le plus proche de l'adresse\n" : ''))
        . ($precision ? "Précision du client : $precision\n" : '')
        . "\nCLIENT\n$nom\n" . ($cd['email'] ?? '') . "\n" . ($cd['phone'] ?? '') . "\n" . ($adr ? "$adr\n" : '')
        . "\nPAYÉ : $total" . ($abo ? " (1re livraison)\nFormule : " . ($m['formule'] ?? '') . ($fin ? "\nFin automatique de l'abonnement : $fin" : "\nSans engagement") : '')
        . "\n\nDétail et remboursement : tableau de bord Stripe.";
      bc_mail(bc_admin_email(), ($abo ? 'Nouvel abonnement ' : 'Commande payée ') . ($m['reference'] ?? '') . ' · ' . ($m['sachets'] ?? '?') . ' sachet(s)', $txt, $cd['email'] ?? '');

      // au client
      if (!empty($cd['email'])) {
        $c = "Bonjour" . ($nom ? ' ' . preg_replace('~\s.*$~', '', $nom) : '') . ",\n\n"
          . "Merci pour votre " . ($abo ? 'abonnement' : 'commande') . " ! Votre paiement est bien reçu.\n\n"
          . "Référence : " . ($m['reference'] ?? '') . "\n  • $lignes\n"
          . "Réception : " . ($m['reception'] ?? '') . ($relais ? " ($relais)" : '') . "\n"
          . "Total payé : $total\n\n"
          . ($abo ? "Votre formule : " . ($m['formule'] ?? '') . ".\nVous êtes prélevé à chaque livraison, jamais d'avance." . ($fin ? " L'abonnement s'arrête automatiquement le $fin." : '') . "\n"
              . "Résilier ou gérer votre abonnement à tout moment : $origin/resilier.html\n\n" : '')
          . "Nous préparons votre café et vous prévenons dès son envoi.\n\n"
          . "Maison Bartheau Café\n" . ($info['email'] ?? '') . (!empty($info['tel']) ? ' · ' . $info['tel'] : '') . "\n$origin";
        bc_mail($cd['email'], 'Votre ' . ($abo ? 'abonnement' : 'commande') . ' Maison Bartheau Café · ' . ($m['reference'] ?? ''), $c);
      }
      break;

    /* ---- Renouvellement d'abonnement : livraison à préparer ---- */
    case 'invoice.paid':
      if (($o['billing_reason'] ?? '') !== 'subscription_cycle') break;
      $m = $o['parent']['subscription_details']['metadata'] ?? ($o['subscription_details']['metadata'] ?? []);
      $adr = adresse_txt($o['customer_shipping']['address'] ?? null) ?: adresse_txt($o['customer_address'] ?? null);
      $txt = "LIVRAISON D'ABONNEMENT À PRÉPARER · " . ($m['reference'] ?? '') . "\n\n"
        . "  • " . str_replace(' | ', "\n  • ", $m['detail'] ?? '') . "\n  Sachets : " . ($m['sachets'] ?? '?') . "\n\n"
        . "ENVOI : " . ($m['reception'] ?? '') . "\n\n"
        . "CLIENT\n" . ($o['customer_shipping']['name'] ?? ($o['customer_name'] ?? '')) . "\n" . ($o['customer_email'] ?? '') . "\n" . ($o['customer_phone'] ?? '') . "\n" . ($adr ? "$adr\n" : '')
        . "\nPAYÉ : " . eur_c($o['amount_paid'] ?? 0) . "\nFormule : " . ($m['formule'] ?? '');
      bc_mail(bc_admin_email(), "Livraison d'abonnement à préparer · " . ($m['reference'] ?? ''), $txt, $o['customer_email'] ?? '');
      break;

    /* ---- Fin d'un abonnement (résiliation ou fin d'engagement) ---- */
    case 'customer.subscription.deleted':
      $m = $o['metadata'] ?? [];
      $email = ''; $nom = '';
      if (!empty($o['customer']) && $key) {
        $cu = bc_stripe($key, 'GET', 'customers/' . rawurlencode($o['customer']));
        $email = $cu['data']['email'] ?? ''; $nom = $cu['data']['name'] ?? '';
      }
      $raison = ($o['cancellation_details']['reason'] ?? '') === 'cancellation_requested' ? 'résilié par le client' : "arrivé à son terme";
      bc_mail(bc_admin_email(), 'Abonnement terminé · ' . ($m['reference'] ?? ''), "ABONNEMENT TERMINÉ ($raison) · " . ($m['reference'] ?? '') . "\n\nClient : $nom $email\nFormule : " . ($m['formule'] ?? '') . "\nDétail : " . ($m['detail'] ?? '') . "\n\nPlus aucune livraison ni prélèvement pour cet abonnement.");
      if ($email) bc_mail($email, 'Fin de votre abonnement Maison Bartheau Café', "Bonjour" . ($nom ? ' ' . preg_replace('~\s.*$~', '', $nom) : '') . ",\n\nVotre abonnement Maison Bartheau Café (" . ($m['reference'] ?? '') . ") est terminé : vous ne serez plus prélevé et aucune nouvelle livraison n'est prévue.\n\nMerci de nous avoir fait confiance. Vous pouvez recommander ou vous réabonner à tout moment sur $origin\n\nMaison Bartheau Café\n" . ($info['email'] ?? ''));
      break;
  }
} catch (Throwable $e) {
  error_log('Webhook Maison Bartheau : ' . $e->getMessage());
  bc_forget($event['id']);           // Stripe renverra la notification
  bc_json(['error' => 'Erreur de traitement'], 500);
}
bc_json(['ok' => true]);
