import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, apiFetch } from '@/lib/api';
import { LoginForm } from './login-form';

const replace = jest.fn();
const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: jest.fn() };
});
const apiFetchMock = jest.mocked(apiFetch);

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('Correo'), email);
  if (password) await userEvent.type(screen.getByLabelText('Contraseña'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('muestra errores de validación sin llamar a la API', async () => {
    render(<LoginForm />);
    await fillAndSubmit('no-es-correo', '');

    expect(await screen.findByText('Ingresa un correo válido.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa la contraseña.')).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('inicia sesión y entra al panel', async () => {
    apiFetchMock.mockResolvedValue({ id: '1', email: 'a@b.co', name: 'A', role: 'ADMIN' });
    render(<LoginForm />);
    await fillAndSubmit('duena@ejemplo.com', 'clave-segura-123');

    expect(apiFetchMock).toHaveBeenCalledWith('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'duena@ejemplo.com', password: 'clave-segura-123' }),
    });
    expect(replace).toHaveBeenCalledWith('/admin');
  });

  it('muestra el mensaje del servidor si las credenciales son incorrectas', async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(401, {
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Correo o contraseña incorrectos.',
        path: '/api/v1/admin/auth/login',
        timestamp: '',
      }),
    );
    render(<LoginForm />);
    await fillAndSubmit('duena@ejemplo.com', 'incorrecta-123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(replace).not.toHaveBeenCalled();
  });

  it('el botón de ojo alterna la visibilidad de la contraseña', async () => {
    render(<LoginForm />);
    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
