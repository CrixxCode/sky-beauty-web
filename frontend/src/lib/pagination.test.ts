import { fetchAllPages, pageCount, pageList } from './pagination';

describe('pageList', () => {
  it('muestra la primera, la última y las vecinas de la actual, con saltos', () => {
    expect(pageList(1, 1)).toEqual([1]);
    expect(pageList(1, 8)).toEqual([1, 2, 'gap', 8]);
    expect(pageList(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageList(10, 10)).toEqual([1, 'gap', 9, 10]);
    expect(pageList(2, 3)).toEqual([1, 2, 3]);
  });
});

describe('pageCount', () => {
  it('calcula las páginas y nunca devuelve menos de una', () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
    expect(pageCount(189, 20)).toBe(10);
  });
});

describe('fetchAllPages', () => {
  it('reúne todas las páginas hasta completar el total', async () => {
    const all = Array.from({ length: 230 }, (_, i) => i);
    const fetchPage = jest.fn(async (page: number, limit: number) => ({
      items: all.slice((page - 1) * limit, page * limit),
      total: all.length,
    }));
    await expect(fetchAllPages(fetchPage)).resolves.toEqual(all);
    expect(fetchPage.mock.calls).toEqual([
      [1, 100],
      [2, 100],
      [3, 100],
    ]);
  });

  it('se detiene si una página llega vacía', async () => {
    const fetchPage = jest.fn(async () => ({ items: [], total: 50 }));
    await expect(fetchAllPages(fetchPage)).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
