<?php
// Maison Bartheau Café · outils du paiement (hébergement IONOS, PHP 8).
// Les prix et la livraison sont lus dans assets/produits.js et assets/config.js :
// ce sont les mêmes fichiers que le site, il n'y a qu'un seul endroit à modifier.
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'lib.php') { http_response_code(403); exit; }

function bc_root(): string { return dirname(__DIR__); }

// Extrait « var NOM = ... ; » d'un fichier JavaScript de réglages et le convertit en tableau PHP.
// Les textes entre guillemets sont mis de côté avant toute conversion : une apostrophe
// dans une description (« L'assemblage ») ne peut donc rien casser.
function bc_js_var(string $file, string $name) {
  $src = @file_get_contents($file);
  if ($src === false) return null;
  $strings = []; $out = ''; $n = strlen($src);
  for ($i = 0; $i < $n; $i++) {
    $c = $src[$i];
    if ($c === '"' || $c === "'") {                     // texte : on le garde intact
      $j = $i + 1; $buf = '';
      while ($j < $n && $src[$j] !== $c) {
        if ($src[$j] === '\\' && $j + 1 < $n) { $buf .= $src[$j] . $src[$j + 1]; $j += 2; continue; }
        $buf .= $src[$j]; $j++;
      }
      $val = $c === '"' ? json_decode('"' . $buf . '"') : stripcslashes($buf);
      $strings[] = json_encode((string)$val, JSON_UNESCAPED_UNICODE);
      $out .= "\x01" . (count($strings) - 1) . "\x02";
      $i = $j; continue;
    }
    if ($c === '/' && ($src[$i + 1] ?? '') === '*') { $e = strpos($src, '*/', $i + 2); $i = $e === false ? $n : $e + 1; continue; }
    if ($c === '/' && ($src[$i + 1] ?? '') === '/') { $e = strpos($src, "\n", $i); $i = $e === false ? $n : $e - 1; continue; }
    $out .= $c;
  }
  if (!preg_match('~\bvar\s+' . preg_quote($name, '~') . '\s*=\s*~', $out, $m, PREG_OFFSET_CAPTURE)) return null;
  $i = $m[0][1] + strlen($m[0][0]);
  $open = $out[$i] ?? '';
  if ($open === '[' || $open === '{') {
    $depth = 0; $n = strlen($out);
    for ($j = $i; $j < $n; $j++) {
      if ($out[$j] === '[' || $out[$j] === '{') $depth++;
      if ($out[$j] === ']' || $out[$j] === '}') { $depth--; if ($depth === 0) break; }
    }
    $lit = substr($out, $i, $j - $i + 1);
  } else {
    $e = strpos($out, ';', $i); $lit = trim(substr($out, $i, ($e === false ? strlen($out) : $e) - $i));
  }
  $lit = preg_replace('~([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:~', '$1"$2":', $lit);  // clés
  $lit = preg_replace('~,(\s*[\]}])~', '$1', $lit);                                  // virgules finales
  $lit = preg_replace_callback("~\x01(\d+)\x02~", fn($x) => $strings[(int)$x[1]], $lit);
  return json_decode($lit, true);
}

function bc_site(): array {
  $root = bc_root();
  $prod = bc_js_var($root . '/assets/produits.js', 'PRODUITS');
  $liv = bc_js_var($root . '/assets/config.js', 'LIVRAISON');
  $info = bc_js_var($root . '/assets/config.js', 'INFO');
  $prod = is_array($prod) ? array_values(array_filter($prod, fn($p) => is_array($p) && !empty($p['id']) && !empty($p['nom']))) : [];
  return ['produits' => $prod, 'livraison' => is_array($liv) ? $liv : [], 'info' => is_array($info) ? $info : []];
}

// Formats d'un café (même règle que window.BCOffres dans assets/site.js).
function bc_offres(array $p): array {
  $L = [];
  foreach (($p['formats'] ?? []) as $o) {
    if (is_array($o) && !empty($o['id']) && is_numeric($o['prix'] ?? null) && $o['prix'] > 0) $L[] = $o;
  }
  if (!$L) $L = [['id' => 'sachet', 'nom' => 'Le sachet · ' . ($p['poids'] ?? '250 g'), 'sachets' => 1, 'prix' => $p['prix'] ?? 0]];
  return array_map(fn($o) => ['id' => (string)$o['id'], 'nom' => $o['nom'] ?? (string)$o['id'], 'sachets' => max(1, (int)($o['sachets'] ?? 1)), 'prix' => (float)$o['prix']], $L);
}

// Configuration secrète (api/config.php, jamais publié). Repli sur l'ancien cle-stripe.php.
function bc_conf(): array {
  static $c = null;
  if ($c !== null) return $c;
  $c = [];
  foreach (['config.php', 'cle-stripe.php'] as $f) {
    if (is_file(__DIR__ . '/' . $f)) { $x = include __DIR__ . '/' . $f; if (is_array($x)) { $c = $x; break; } }
  }
  return $c;
}
function bc_secret(): string {
  $k = trim((string)(bc_conf()['secret_key'] ?? ''));
  return preg_match('~^(sk|rk)_(test|live)_[A-Za-z0-9]+$~', $k) ? $k : '';
}

/* ---------- Livraison (grille de assets/config.js) ----------
   Renvoie ['ok'=>bool, 'cents'=>int, 'label'=>string, 'erreur'=>string] */
function bc_ship(int $sachets, string $mode, array $liv): array {
  $max = (int)($liv['maxSachets'] ?? 7);
  if ($sachets > $max) return ['ok' => false, 'erreur' => "Au-delà de $max sachets, commandez par e-mail : nous vous proposons le meilleur envoi."];
  if ($mode === 'retrait') {
    if (($liv['retrait'] ?? true) === false) return ['ok' => false, 'erreur' => "Le retrait n'est pas proposé."];
    return ['ok' => true, 'cents' => 0, 'label' => 'Retrait en main propre'];
  }
  if ($mode !== 'relais' && $mode !== 'domicile') return ['ok' => false, 'erreur' => 'Mode de livraison inconnu.'];
  $grille = is_array($liv['grille'] ?? null) ? $liv['grille'] : [];
  usort($grille, fn($a, $b) => ($a['jusqua'] ?? 0) <=> ($b['jusqua'] ?? 0));
  foreach ($grille as $t) {
    if ($sachets <= (int)($t['jusqua'] ?? 0) && is_numeric($t[$mode] ?? null)) {
      $c = bc_cents($t[$mode]);
      $name = $mode === 'relais' ? 'Point relais Mondial Relay' : 'Colissimo à domicile';
      return ['ok' => true, 'cents' => $c, 'label' => $c ? $name : $name . ' · offert'];
    }
  }
  return ['ok' => false, 'erreur' => "La livraison n'est pas encore configurée pour ce colis. Commandez par e-mail."];
}

/* ---------- E-mails ---------- */
function bc_mail(string $to, string $subject, string $text, string $replyTo = ''): bool {
  if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
  $info = bc_site()['info'];
  $from = trim((string)(bc_conf()['mail_from'] ?? ''));
  if (!filter_var($from, FILTER_VALIDATE_EMAIL)) $from = 'boutique@' . preg_replace('~^www\.~', '', preg_replace('~[^A-Za-z0-9.-]~', '', $_SERVER['HTTP_HOST'] ?? 'maisonbartheau.com'));
  $headers = [
    'From: ' . mb_encode_mimeheader('Maison Bartheau Café', 'UTF-8', 'Q') . ' <' . $from . '>',
    'Reply-To: ' . (filter_var($replyTo, FILTER_VALIDATE_EMAIL) ? $replyTo : ($info['email'] ?? $from)),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  return @mail($to, mb_encode_mimeheader($subject, 'UTF-8', 'Q'), $text, implode("\r\n", $headers), '-f' . $from);
}
function bc_admin_email(): string {
  $a = trim((string)(bc_conf()['mail_admin'] ?? ''));
  if (filter_var($a, FILTER_VALIDATE_EMAIL)) return $a;
  $i = bc_site()['info'];
  return (string)($i['emailCommande'] ?? $i['email'] ?? '');
}

/* ---------- Anti-doublon : chaque événement Stripe n'est traité qu'une fois ---------- */
function bc_once(string $id): bool {
  $dir = __DIR__ . '/data';
  if (!is_dir($dir)) @mkdir($dir, 0750, true);
  $f = $dir . '/evt_' . preg_replace('~[^A-Za-z0-9_]~', '', $id);
  $h = @fopen($f, 'x');              // échoue si le fichier existe déjà
  if ($h === false) return false;
  fwrite($h, date('c')); fclose($h);
  return true;
}
function bc_forget(string $id): void { @unlink(__DIR__ . '/data/evt_' . preg_replace('~[^A-Za-z0-9_]~', '', $id)); }

/* ---------- Signature des notifications Stripe ---------- */
function bc_verify_signature(string $payload, string $header, string $secret, int $tolerance = 300): bool {
  if ($secret === '' || $header === '') return false;
  $t = null; $sigs = [];
  foreach (explode(',', $header) as $part) {
    $kv = explode('=', trim($part), 2);
    if (count($kv) !== 2) continue;
    if ($kv[0] === 't') $t = (int)$kv[1];
    if ($kv[0] === 'v1') $sigs[] = $kv[1];
  }
  if (!$t || !$sigs || abs(time() - $t) > $tolerance) return false;
  $expected = hash_hmac('sha256', $t . '.' . $payload, $secret);
  foreach ($sigs as $s) if (hash_equals($expected, $s)) return true;
  return false;
}

function bc_json($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function bc_cents($euros): int { return (int)round(((float)$euros) * 100); }
function bc_discount(int $months): int { return $months >= 12 ? 15 : ($months >= 6 ? 10 : ($months >= 3 ? 5 : 0)); }
function bc_clip($v, int $n): string { $s = preg_replace('~[\x00-\x1F\x7F]~u', ' ', (string)($v ?? '')); return mb_substr(trim($s), 0, $n); }

function bc_origin(): string {
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') || (($_SERVER['SERVER_PORT'] ?? '') == 443);
  $host = preg_replace('~[^A-Za-z0-9.:-]~', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
  $dir = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/checkout.php'))), '/');
  return ($https ? 'https' : 'http') . '://' . $host . $dir;
}

// Appel à l'API Stripe (sans bibliothèque externe).
function bc_stripe(string $key, string $method, string $path, array $params = []): array {
  $base = getenv('BC_STRIPE_BASE') ?: 'https://api.stripe.com/v1/'; // variable réservée aux tests locaux
  $url = $base . ltrim($path, '/');
  $ch = curl_init();
  $opts = [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_USERPWD => $key . ':',
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => ['Idempotency-Key: ' . bin2hex(random_bytes(16))],
  ];
  if ($method === 'POST') { $opts[CURLOPT_POST] = true; $opts[CURLOPT_POSTFIELDS] = http_build_query($params, '', '&'); }
  curl_setopt_array($ch, $opts);
  $body = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  $data = is_string($body) ? json_decode($body, true) : null;
  return ['status' => $body === false ? 0 : $code, 'data' => is_array($data) ? $data : [], 'error' => $err];
}
