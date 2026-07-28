/**
 * Substitut CommonJS de `@paralleldrive/cuid2` pour les tests.
 *
 * Le paquet réel est publié en ESM pur et Jest, qui exécute ici du CommonJS,
 * ne sait pas le charger. Seule compte la génération d'un identifiant unique :
 * la mécanique interne du vrai paquet n'est jamais l'objet des tests.
 */
let compteur = 0;

exports.createId = () => `cuid-test-${++compteur}`;
exports.init = () => exports.createId;
exports.isCuid = (value) => typeof value === 'string' && value.length > 0;
exports.getConstants = () => ({});
