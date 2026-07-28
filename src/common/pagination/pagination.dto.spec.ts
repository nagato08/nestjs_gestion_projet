import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  resolvePagination,
} from './pagination.dto';

/**
 * Bornes de pagination.
 *
 * Le plafond est le point sensible : c'est lui qui empêche un client de
 * réclamer la collection entière et de rétablir la situation que la
 * pagination corrige. Une régression y serait invisible tant que personne
 * n'en abuse.
 */
describe('Bornes de pagination', () => {
  it('applique une taille de page par défaut en l’absence de paramètre', () => {
    expect(resolvePagination()).toEqual({ skip: 0, take: DEFAULT_PAGE_SIZE });
  });

  it('respecte une taille demandée en deçà du plafond', () => {
    expect(resolvePagination({ take: 10 })).toEqual({ skip: 0, take: 10 });
  });

  it('plafonne une taille excessive', () => {
    expect(resolvePagination({ take: 1_000_000 }).take).toBe(MAX_PAGE_SIZE);
  });

  it('refuse un décalage négatif', () => {
    // Prisma rejetterait un skip négatif : on le neutralise en amont.
    expect(resolvePagination({ skip: -50 }).skip).toBe(0);
  });

  it('conserve un décalage valide', () => {
    expect(resolvePagination({ skip: 120, take: 20 })).toEqual({
      skip: 120,
      take: 20,
    });
  });

  it('garde un plafond strictement inférieur à une collection réelle', () => {
    // Garde-fou de conception : un plafond démesuré viderait la pagination
    // de son sens sans qu'aucun test ne le signale.
    expect(MAX_PAGE_SIZE).toBeLessThanOrEqual(200);
    expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });
});
