import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('es de tipo "button" por defecto para no enviar formularios por accidente', () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button');
  });

  it('ejecuta onClick y respeta el estado deshabilitado', async () => {
    const onClick = jest.fn();
    const { rerender } = render(<Button onClick={onClick}>Agregar</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Agregar
      </Button>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
