import { render, screen } from '@testing-library/react';
import { parseRichText, RichText } from './rich-text';

describe('parseRichText', () => {
  it('reconoce títulos, párrafos y listas', () => {
    const blocks = parseRichText(
      [
        '# Título',
        '',
        'Primera línea',
        'segunda línea del mismo párrafo.',
        '',
        '## Subtítulo',
        '- uno',
        '* dos',
        '1. primero',
        '2) segundo',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'Título' },
      { kind: 'paragraph', text: 'Primera línea segunda línea del mismo párrafo.' },
      { kind: 'heading', level: 2, text: 'Subtítulo' },
      { kind: 'list', ordered: false, items: ['uno', 'dos'] },
      { kind: 'list', ordered: true, items: ['primero', 'segundo'] },
    ]);
  });

  it('acepta saltos de línea de Windows', () => {
    expect(parseRichText('Uno\r\n\r\nDos')).toEqual([
      { kind: 'paragraph', text: 'Uno' },
      { kind: 'paragraph', text: 'Dos' },
    ]);
  });
});

describe('RichText', () => {
  it('muestra negritas y no interpreta HTML', () => {
    const { container } = render(
      <RichText source={'Texto con **negrita** y <script>alert(1)</script> <b>etiqueta</b>'} />,
    );
    expect(screen.getByText('negrita').tagName).toBe('STRONG');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('usa encabezados semánticos', () => {
    render(<RichText source={'# Política\n\n## Alcance'} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Política' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Alcance' })).toBeInTheDocument();
  });
});
