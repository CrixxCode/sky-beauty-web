import { render, screen } from '@testing-library/react';
import { Select } from './select';

describe('Select', () => {
  it('pone el nombre accesible en el control visible, no en el select oculto', () => {
    render(
      <Select aria-label="Filtrar por estado" value="" onChange={jest.fn()}>
        <option value="">Todos los estados</option>
        <option value="ACTIVE">Activo</option>
      </Select>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Filtrar por estado' });
    expect(trigger).toBeVisible();
    expect(trigger.tagName).toBe('BUTTON');
  });
});
