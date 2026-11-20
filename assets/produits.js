/* =====================================================================
   MAISON BARTHEAU CAFÉ · VOS PRODUITS
   Chaque bloc { ... } est un produit affiché dans « Nos cafés ».

   Pour ajouter une photo :
     1. Déposez l'image dans le dossier assets/img/produits/
        (format carré ou portrait, 1200 px de large suffit, JPG ou WEBP).
     2. Écrivez son chemin dans « image », ex. "assets/img/produits/maison.jpg".
     Tant que « image » est vide, une belle vignette à votre logo s'affiche.

   Champs :
     nom ........... nom du café
     accroche ...... courte phrase sous le nom
     description ... texte de présentation (fiche détaillée)
     origine, torrefaction, notes (liste), intensite (1 à 5) : facultatifs,
                     n'apparaissent que s'ils sont remplis
     prix .......... prix TTC du sachet, en euros (chiffre, ex. 11.90)
     poids ......... ex. "250 g"
     formats ....... les formules proposées pour ce café (sachet, duo, kilo) :
                     nom affiché, nombre de sachets de 250 g, prix TTC.
     disponible .... true = commandable ; false = affiché « Bientôt disponible »
                     (mettez false quand un café est épuisé)
     badge ......... petite étiquette facultative, ex. "Nouveau", "Édition limitée"

   Pour supprimer un produit : effacez tout son bloc, de { jusqu'à },
   Pour en ajouter un : copiez un bloc entier et modifiez-le.
   ===================================================================== */
var PRODUITS = [
  {
    id: "maison",
    nom: "Le café de la Maison",
    accroche: "La recette de famille",
    description: "L'assemblage qui a donné son nom à la Maison. Une recette transmise, que nous gardons telle qu'elle est, torréfiée en petits lots numérotés par un artisan torréfacteur. En grains, ou moulu pour votre machine.",
    image: "",
    origine: "",
    torrefaction: "",
    notes: [],
    intensite: 0,
    prix: 11.90,
    poids: "250 g",
    formats: [
      { id: "sachet", nom: "Le sachet · 250 g",   sachets: 1, prix: 11.90 },
      { id: "duo",    nom: "Le duo · 2 × 250 g",  sachets: 2, prix: 22 },
      { id: "kilo",   nom: "Le kilo · 4 × 250 g", sachets: 4, prix: 39 }
    ],
    disponible: true,
    badge: "La signature"
  },
  {
    id: "cafe-2",
    nom: "Nouveau café",
    accroche: "Bientôt à la Maison",
    description: "",
    image: "",
    origine: "",
    torrefaction: "",
    notes: [],
    intensite: 0,
    prix: 11.90,
    poids: "250 g",
    formats: [
      { id: "sachet", nom: "Le sachet · 250 g",   sachets: 1, prix: 11.90 },
      { id: "duo",    nom: "Le duo · 2 × 250 g",  sachets: 2, prix: 22 },
      { id: "kilo",   nom: "Le kilo · 4 × 250 g", sachets: 4, prix: 39 }
    ],
    disponible: false,
    badge: ""
  },
  {
    id: "cafe-3",
    nom: "Édition de saison",
    accroche: "Bientôt à la Maison",
    description: "",
    image: "",
    origine: "",
    torrefaction: "",
    notes: [],
    intensite: 0,
    prix: 11.90,
    poids: "250 g",
    formats: [
      { id: "sachet", nom: "Le sachet · 250 g",   sachets: 1, prix: 11.90 },
      { id: "duo",    nom: "Le duo · 2 × 250 g",  sachets: 2, prix: 22 },
      { id: "kilo",   nom: "Le kilo · 4 × 250 g", sachets: 4, prix: 39 }
    ],
    disponible: false,
    badge: ""
  }
];
