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

  // Adresse technique qui EXPÉDIE les e-mails automatiques de la boutique.
  // Elle doit être de votre domaine (Gmail refuse les mails envoyés « en son nom »
  // depuis un autre serveur). Les clients ne la voient presque pas : toutes leurs
  // RÉPONSES arrivent sur maisonbartheau.cafe@gmail.com.
  // Chez IONOS : Menu > E-mail > créez une « redirection » boutique@maisonbartheau.com
  // vers maisonbartheau.cafe@gmail.com (aucune boîte à consulter en plus).
  'mail_from' => 'boutique@maisonbartheau.com',

  // Adresse qui REÇOIT les commandes, renouvellements et fins d'abonnement
  'mail_admin' => 'maisonbartheau.cafe@gmail.com',
];
