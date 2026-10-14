import { toCsv } from './csv';

describe('toCsv', () => {
  it('usa punto y coma, BOM y comillas cuando hace falta', () => {
    const csv = toCsv(
      ['Producto', 'Unidades'],
      [
        ['Labial "rojo"; mate', 3],
        ['Base', 10],
        ['Margen', 55.56],
      ],
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Producto;Unidades',
      '"Labial ""rojo""; mate";3',
      'Base;10',
      'Margen;55,56',
    ]);
  });
});
