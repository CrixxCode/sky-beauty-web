import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './modal';

describe('Modal', () => {
  it('no se renderiza si isOpen es false', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()} title="Título del modal">
        <p>Contenido</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('se renderiza correctamente cuando isOpen es true', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Título del modal" description="Descripción de prueba">
        <p>Contenido visible</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Título del modal')).toBeInTheDocument();
    expect(screen.getByText('Descripción de prueba')).toBeInTheDocument();
    expect(screen.getByText('Contenido visible')).toBeInTheDocument();
  });

  it('llama a onClose al hacer clic en el botón de cerrar', async () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Cerrar modal">
        <p>Contenido</p>
      </Modal>,
    );
    const closeBtn = screen.getByRole('button', { name: 'Cerrar' });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

