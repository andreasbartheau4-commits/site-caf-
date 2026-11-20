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

function bc_secret(): string {
  $f = __DIR__ . '/cle-stripe.php';
  if (!is_file($f)) return '';
  $c = include $f;
  $k = is_array($c) ? trim((string)($c['secret_key'] ?? '')) : '';
  return preg_match('~^(sk|rk)_(test|live)_[A-Za-z0-9]+$~', $k) ? $k : '';
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
