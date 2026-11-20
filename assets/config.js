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
  tel:           "06 13 91 54 97",                               /* Ex. 06 12 34 56 78 */
  instagram:     "",                               /* Ex. https://instagram.com/maisonbartheau */
  hebergeur:     "IONOS SARL, 7 place de la Gare, 57200 Sarreguemines, France · 09 70 80 89 11",                               /* Nom, adresse et téléphone de l'hébergeur */
  mediateur:     ""                                /* Nom et site du médiateur de la consommation */
};

/* Prix de secours du sachet (le vrai prix de chaque café se règle dans assets/produits.js). */
var PRICE = 11.90;

/* =====================================================================
   LIVRAISON · lu par le site ET par le paiement en ligne (api/checkout.php)
   Les frais dépendent du nombre de sachets de 250 g du colis (un duo = 2,
   un kilo = 4). Tarifs transporteurs publics 2026, en euros TTC :
   ajustez-les après avoir pesé vos vrais colis.
   ===================================================================== */
var LIVRAISON = {
  grille: [
    /* jusqu'à N sachets   point relais Mondial Relay   domicile Colissimo */
    { jusqua: 1,           relais: 4.15,                domicile: 7.59 },  /* moins de 500 g */
    { jusqua: 3,           relais: 5.99,                domicile: 9.59 },  /* moins de 1 kg  */
    { jusqua: 7,           relais: 0,                   domicile: 3.20 }   /* moins de 2 kg : point relais offert */
  ],
  /* Au-delà de ce nombre de sachets : commande par e-mail, sans paiement en ligne */
  maxSachets: 7,
  /* true = le client peut choisir le retrait en main propre, gratuit */
  retrait: true
};
