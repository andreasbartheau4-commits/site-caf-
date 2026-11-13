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
     prix .......... prix TTC du sachet, en euros (chiffre, ex. 12 ou 13.5)
     poids ......... ex. "250 g"
     disponible .... true = commandable ; false = affiché « Bientôt disponible »
     badge ......... petite étiquette facultative, ex. "Nouveau", "Édition limitée"

   Pour supprimer un produit : effacez tout son bloc, de { jusqu'à },
   Pour en ajouter un : copiez un bloc entier et modifiez-le.
   ===================================================================== */
var PRODUITS = [
  {
    id: "maison",
    nom: "Le café de la Maison",
    accroche: "La recette de famille",
    description: "L'assemblage qui a donné son nom à la Maison. Une recette transmise, que nous gardons telle qu'elle est, torréfiée artisanalement en petits lots numérotés. En grains, ou moulu pour votre machine.",
    image: "",
    origine: "",
    torrefaction: "",
    notes: [],
    intensite: 0,
    prix: 12,
    poids: "250 g",
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
    prix: 12,
    poids: "250 g",
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
    prix: 12,
    poids: "250 g",
    disponible: false,
    badge: ""
  }
];
