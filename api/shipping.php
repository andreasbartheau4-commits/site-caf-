<?php
// GET : indique au site si le paiement en ligne est actif, la grille d'envoi et le lien du portail client.
require_once __DIR__ . '/lib.php';
$site = bc_site();
$liv = $site['livraison'];
$portal = trim((string)(bc_conf()['portal_url'] ?? ''));
bc_json([
  'ok' => true,
  'paiement' => bc_secret() !== '',
  'livraison' => [
    'grille' => array_values(is_array($liv['grille'] ?? null) ? $liv['grille'] : []),
    'maxSachets' => (int)($liv['maxSachets'] ?? 7),
    'retrait' => ($liv['retrait'] ?? true) !== false,
  ],
  'portail' => preg_match('~^https://billing\.stripe\.com/~', $portal) ? $portal : '',
]);
