<?php
/* =====================================================================
   MAISON BARTHEAU CAFÉ · CONFIGURATION SECRÈTE DU PAIEMENT
   1. Copiez ce fichier sous le nom  config.php  (dans le même dossier api/).
   2. Remplissez les valeurs ci-dessous dans config.php.
   ⚠ config.php ne s'affiche jamais aux visiteurs (le .htaccess du dossier le bloque)
     et n'est pas enregistré sur GitHub. Ne l'envoyez à personne.
   ===================================================================== */
return [
  // Stripe > Développeurs > Clés API > « Clé secrète » (sk_test_... pour essayer, sk_live_... en réel)
  'secret_key' => '',

  // Stripe > Développeurs > Webhooks > votre destination > « Secret de signature » (whsec_...)
  'webhook_secret' => '',

  // Stripe > Paramètres > Billing > Portail client > « Lien de connexion » (https://billing.stripe.com/p/login/...)
  'portal_url' => '',

  // Adresse qui ENVOIE les e-mails de la boutique : de préférence une boîte de votre domaine
  // créée chez IONOS (ex. commandes@maisonbartheau.com), sinon les mails risquent les spams.
  'mail_from' => '',

  // Adresse qui REÇOIT les commandes (vide = l'e-mail de commande de assets/config.js)
  'mail_admin' => '',
];
