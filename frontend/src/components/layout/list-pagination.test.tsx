import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListPagination } from './list-pagination';

describe('ListPagination', () => {
  it('no se muestra con una sola página', () => {
    render(<ListPagination page={1} totalPages={1} onPageChange={jest.fn()} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('marca la página actual y cambia de página sin navegar', async () => {
    const onPageChange = jest.fn();
    render(<ListPagination page={4} totalPages={10} onPageChange={onPageChange} />);

    expect(screen.getByRole('button', { name: 'Página 4' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('button', { name: 'Página 7' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Página 10' }));
    expect(onPageChange.mock.calls).toEqual([[5], [3], [10]]);
  });

  it('deshabilita anterior en la primera página y siguiente en la última', () => {
    const { rerender } = render(
      <ListPagination page={1} totalPages={3} onPageChange={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    rerender(<ListPagination page={3} totalPages={3} onPageChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });
});
