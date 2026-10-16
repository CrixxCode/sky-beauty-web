import { isUuid } from './utils';

describe('isUuid', () => {
  it('acepta ids de la API y descarta valores alterados', () => {
    expect(isUuid('2cf5f5ec-2fc2-4e1f-829f-a2ef432ad82b')).toBe(true);
    expect(isUuid('2CF5F5EC-2FC2-4E1F-829F-A2EF432AD82B')).toBe(true);
    for (const value of ['x', '', 'abc', '<script>', 1, null, undefined, {}]) {
      expect(isUuid(value)).toBe(false);
    }
  });
});
