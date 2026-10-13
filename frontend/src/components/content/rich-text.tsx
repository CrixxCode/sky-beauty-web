import type { ReactNode } from 'react';
import { serifClass } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

/**
 * Bloques de un texto de la tienda escrito en el panel. Se admite un formato mínimo y seguro, sin
 * HTML: `#`, `##` y `###` para títulos, `-` o `*` para listas, `1.` para listas numeradas,
 * `**texto**` para negrita y una línea en blanco entre párrafos.
 */
export type RichBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: 'list', ...list });
    list = null;
  };

  for (const rawLine of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);

    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Negritas con **texto**; todo lo demás es texto plano (React lo escapa). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={index} className="font-semibold text-[#493a45]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export function RichText({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn('text-xs leading-[2] text-[#6a5e66]', className)}>
      {parseRichText(source).map((block, index) => {
        if (block.kind === 'heading') {
          const Tag = (['h2', 'h3', 'h4'] as const)[block.level - 1];
          return (
            <Tag
              key={index}
              className={cn(
                'text-[#3f333c]',
                block.level === 1
                  ? cn(serifClass, 'mb-3 mt-8 text-[27px] leading-tight first:mt-0')
                  : block.level === 2
                    ? 'mb-2 mt-6 text-sm font-semibold'
                    : 'mb-1.5 mt-4 text-xs font-semibold',
              )}
            >
              {inline(block.text)}
            </Tag>
          );
        }
        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={index}
              className={cn('my-3 space-y-1 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={index} className="my-3">
            {inline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
