/* =====================================================================
   MAISON BARTHEAU CAFÉ · RÉGLAGES DU SITE
   C'est le SEUL fichier à modifier pour vos coordonnées et votre prix.
   Tant qu'un champ est vide (""), le site affiche « à compléter ».
   ===================================================================== */
var INFO = {
  nom:           "",                               /* Prénom NOM de l'entrepreneur */
  siret:         "",                               /* 14 chiffres */
  adresse:       "Pays de la Loire",               /* Adresse postale complète (mentions légales) */
  email:         "maisonbartheau.cafe@gmail.com",      /* Contact affiché sur le site */
  emailCommande: "maisonbartheau.cafe@gmail.com",      /* Où arrivent les commandes */
  tel:           "",                               /* Ex. 06 12 34 56 78 */
  instagram:     "",                               /* Ex. https://instagram.com/maisonbartheau */
  hebergeur:     "",                               /* Nom, adresse et téléphone de l'hébergeur */
  mediateur:     ""                                /* Nom et site du médiateur de la consommation */
};

/* Prix de secours du sachet (le vrai prix de chaque café se règle dans assets/produits.js). */
var PRICE = 12;

/* =====================================================================
   LIVRAISON (utilisé par le site ET par le paiement en ligne)
   Le paiement par carte, Apple Pay et Google Pay passe par Stripe :
   voir LISEZ-MOI.txt pour l'activer. Aucune clé secrète ne va dans ce fichier.
   ===================================================================== */
var LIVRAISON = {
  /* Frais d'envoi d'un colis en France, en euros TTC, ex. 6.90.
     OBLIGATOIRE pour vendre en livraison (laissé à null : seul le retrait est payable). */
  fraisEnvoi: null,

  /* Livraison offerte à partir de ce montant d'achat (ex. 45), ou null */
  offerteDes: null,

  /* true = le client peut choisir « Retrait en main propre » (sans frais) */
  retrait: true
};
