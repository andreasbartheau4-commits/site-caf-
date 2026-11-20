/* =====================================================================
   MAISON BARTHEAU CAFÉ · RÉGLAGES DU SITE
   C'est le SEUL fichier à modifier pour vos coordonnées et votre prix.
   Tant qu'un champ est vide (""), le site affiche « à compléter ».
   ===================================================================== */
var INFO = {
  nom:           "Andréas Bartheau",                               /* Prénom NOM de l'entrepreneur */
  siret:         "133 098 566 00010",                               /* 14 chiffres */
  rcs:           "RCS Nantes 133 098 566",          /* Numéro d'immatriculation (extrait Kbis) */
  adresse:       "11 la Guilbaudière, 44650 Legé",               /* Adresse postale complète (mentions légales) */
  email:         "maisonbartheau.cafe@gmail.com",      /* Contact affiché sur le site */
  emailCommande: "maisonbartheau.cafe@gmail.com",      /* Où arrivent les commandes */
  tel:           "",                               /* Ex. 06 12 34 56 78 */
  instagram:     "",                               /* Ex. https://instagram.com/maisonbartheau */
  hebergeur:     "IONOS SARL, 7 place de la Gare, 57200 Sarreguemines, France · 09 70 80 89 11",                               /* Nom, adresse et téléphone de l'hébergeur */
  mediateur:     ""                                /* Nom et site du médiateur de la consommation */
};

/* Prix de secours du sachet (le vrai prix de chaque café se règle dans assets/produits.js). */
var PRICE = 11.90;

/* =====================================================================
   LIVRAISON (utilisé par le site ET par le paiement en ligne)
   Le paiement par carte, Apple Pay et Google Pay passe par Stripe :
   la clé secrète va dans api/cle-stripe.php (voir LISEZ-MOI.txt), jamais ici.
   ===================================================================== */
var LIVRAISON = {
  /* Frais d'envoi d'un colis en France, en euros TTC, ex. 6.90.
     OBLIGATOIRE pour vendre en livraison (laissé à null : seul le retrait est payable). */
  fraisEnvoi: null,

  /* Livraison offerte à partir de ce montant d'achat (ex. 45), ou null */
  offerteDes: 35,

  /* true = le client peut choisir « Retrait en main propre » (sans frais) */
  retrait: true
};
