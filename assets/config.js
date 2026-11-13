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
   PAIEMENT SÉCURISÉ
   Le site ne voit jamais la carte bancaire : le client paie sur la page
   sécurisée de Stripe ou PayPal (HTTPS, 3-D Secure). Remplissez au moins
   un moyen ; ceux laissés vides n'apparaissent pas.
   ===================================================================== */
var PAIEMENT = {
  /* Stripe : créez un « Lien de paiement » avec l'option
     « Laisser le client choisir le montant », puis collez-le ici.
     Ex. "https://buy.stripe.com/xxxxxxxx" */
  stripe: "",

  /* PayPal : votre lien PayPal.Me, ex. "https://paypal.me/maisonbartheau" */
  paypal: "",

  /* Virement bancaire (facultatif) */
  virement: { titulaire: "", iban: "", bic: "" },

  /* Frais d'envoi d'un colis, en euros TTC, ex. 6.90.
     Laissez null si vous préférez les calculer avec chaque client :
     le client paie alors après votre confirmation. */
  fraisEnvoi: null,

  /* Livraison offerte à partir de ce montant (ex. 45), ou null */
  livraisonOfferteDes: null
};
