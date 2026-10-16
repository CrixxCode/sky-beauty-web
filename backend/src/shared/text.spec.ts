import { compareSpanish, escapeLike, sortByName } from './text';

describe('compareSpanish y sortByName', () => {
  it('ordena alfabéticamente en español, con tildes y sin distinguir mayúsculas', () => {
    const names = [
      'Cundinamarca',
      'Córdoba',
      'Chocó',
      'Bogotá, D.C.',
      'Atlántico',
      'Ñame',
      'Nariño',
    ];
    expect(sortByName(names.map((name) => ({ name }))).map((d) => d.name)).toEqual([
      'Atlántico',
      'Bogotá, D.C.',
      'Chocó',
      'Córdoba',
      'Cundinamarca',
      'Nariño',
      'Ñame',
    ]);
    expect(compareSpanish('córdoba', 'Córdoba')).toBe(0);
  });
});

describe('escapeLike', () => {
  it('escapa los comodines para buscarlos como texto', () => {
    expect(escapeLike('%')).toBe('\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('c:\\ruta')).toBe('c:\\\\ruta');
    expect(escapeLike("' OR 1=1 --")).toBe("' OR 1=1 --");
  });
});
