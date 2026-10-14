'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { PublicBrand, PublicCategory } from '@/types/catalog';
import { catalogHref } from './catalog-ui';

/**
 * Buscador guiado del inicio: arma la búsqueda del catálogo con los filtros que ya existen
 * (categoría, marca y texto). No recomienda por su cuenta: solo lleva a los resultados.
 */
export function ProductFinder({
  categories,
  brands,
}: {
  categories: PublicCategory[];
  brands: PublicBrand[];
}) {
  const router = useRouter();
  const [categoria, setCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [q, setQ] = useState('');
  // Si falta uno de los dos selectores, el otro ocupa toda la fila.
  const half = categories.length > 0 && brands.length > 0 ? 'mb-4' : 'col-span-full mb-4';

  function submit(event: FormEvent) {
    event.preventDefault();
    router.push(
      catalogHref({
        categoria: categoria || undefined,
        marca: marca || undefined,
        q: q.trim() || undefined,
      }),
    );
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Encuentra tu producto"
      className="grid grid-cols-2 gap-x-3.5 bg-paper p-6.75 shadow-[0_12px_48px_rgb(59_36_46/0.055)] max-[600px]:grid-cols-1 max-[600px]:p-5"
    >
      {categories.length > 0 && (
        <FormField id="finder-categoria" label="Tipo de producto" className={half}>
          <Select
            id="finder-categoria"
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.flatMap((category) => [
              <option key={category.id} value={category.id}>
                {category.name}
              </option>,
              ...category.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {`${category.name} · ${child.name}`}
                </option>
              )),
            ])}
          </Select>
        </FormField>
      )}
      {brands.length > 0 && (
        <FormField id="finder-marca" label="Marca" className={half}>
          <Select
            id="finder-marca"
            value={marca}
            onChange={(event) => setMarca(event.target.value)}
          >
            <option value="">Todas las marcas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      {/* La búsqueda del catálogo compara el nombre del producto (no los tonos ni la marca). */}
      <FormField
        id="finder-q"
        label="Nombre del producto (opcional)"
        className="col-span-full mb-5"
      >
        <Input
          id="finder-q"
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Escribe una palabra del nombre…"
          autoComplete="off"
          enterKeyHint="search"
        />
      </FormField>
      <Button type="submit" className="col-span-full">
        Ver productos <ArrowRight size={16} />
      </Button>
    </form>
  );
}
