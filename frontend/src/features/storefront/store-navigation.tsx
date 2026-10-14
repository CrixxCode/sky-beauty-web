'use client';

import { ArrowRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { whatsappUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicCategory } from '@/types/catalog';

const categoryHref = (id: string) => `/productos?categoria=${id}`;

const barLink = 'inline-flex min-h-9 shrink-0 items-center text-xs text-[#f1e4ef] hover:text-white';

/**
 * Barra de categorías de escritorio y tableta. Las categorías con subcategorías abren un submenú
 * con la categoría completa y cada subcategoría; las demás son enlaces directos.
 */
export function StoreCategoryNav({ categories }: { categories: PublicCategory[] }) {
  return (
    <NavigationMenu aria-label="Categorías" className="bg-mauve-dark max-[600px]:hidden">
      {/* Las categorías bajan a otra línea si no caben: así los submenús nunca quedan recortados. */}
      <NavigationMenuList className="flex-wrap justify-center gap-x-6.75 gap-y-0.5 px-4 py-1.25">
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link href="/productos" className={barLink}>
              Ver todo
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link href="/productos?ofertas=1" className={cn(barLink, 'font-semibold text-white')}>
              Ofertas
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        {categories.map((category) =>
          category.children.length > 0 ? (
            <NavigationMenuItem key={category.id}>
              <NavigationMenuTrigger className={barLink}>{category.name}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="flex flex-col">
                  <li>
                    <NavigationMenuLink asChild>
                      <Link
                        href={categoryHref(category.id)}
                        className="flex min-h-10 items-center justify-between gap-4 px-3 text-xs font-semibold text-[#70436f] hover:bg-[#faf1fa] focus:bg-[#faf1fa]"
                      >
                        Todo {category.name}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </NavigationMenuLink>
                  </li>
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={categoryHref(child.id)}
                          className="flex min-h-10 items-center px-3 text-xs text-[#4f414b] hover:bg-[#faf1fa] hover:text-[#70436f] focus:bg-[#faf1fa]"
                        >
                          {child.name}
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          ) : (
            <NavigationMenuItem key={category.id}>
              <NavigationMenuLink asChild>
                <Link href={categoryHref(category.id)} className={barLink}>
                  {category.name}
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ),
        )}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const drawerLink =
  'flex min-h-12 items-center justify-between gap-3 border-b border-[#eee4e8] text-sm text-ink hover:text-[#70436f]';

/**
 * Menú lateral del celular (replica .mobile-drawer del prototipo): catálogo, categorías con sus
 * subcategorías y las páginas de servicio. Se cierra al elegir un enlace.
 */
export function StoreMobileMenu({
  categories,
  whatsappNumber,
}: {
  categories: PublicCategory[];
  whatsappNumber: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menú"
          className="-ml-2.5 grid h-11 w-11 shrink-0 place-items-center text-ink hover:text-[#70436f] min-[601px]:hidden"
        >
          <Menu size={22} strokeWidth={1.7} />
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader className="border-b border-[#eee4e8] pb-5">
          <SheetTitle>Explorar Sky Beauty</SheetTitle>
          <SheetDescription>Categorías, seguimiento de pedidos y contacto.</SheetDescription>
        </SheetHeader>
        <nav
          aria-label="Menú de la tienda"
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest('a')) setOpen(false);
          }}
        >
          <Link href="/productos" className={cn(drawerLink, 'font-semibold')}>
            Todos los productos <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/productos?ofertas=1" className={cn(drawerLink, 'font-semibold')}>
            Ofertas <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/favoritos" className={drawerLink}>
            Mis favoritos <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {categories.map((category) => (
            <div key={category.id}>
              <Link href={categoryHref(category.id)} className={drawerLink}>
                {category.name} <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={categoryHref(child.id)}
                  className={cn(drawerLink, 'pl-4 text-[13px] text-[#5f5059]')}
                >
                  {child.name}
                </Link>
              ))}
            </div>
          ))}
          <p className="mb-1 mt-7 text-xs font-semibold uppercase tracking-[.16em] text-eyebrow">
            Tu pedido
          </p>
          <Link href="/rastrear" className={drawerLink}>
            Rastrear pedido <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/contacto" className={drawerLink}>
            Contacto <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {whatsappNumber && (
            <a
              href={whatsappUrl(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className={drawerLink}
            >
              WhatsApp de la tienda <ArrowRight size={16} aria-hidden="true" />
            </a>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
