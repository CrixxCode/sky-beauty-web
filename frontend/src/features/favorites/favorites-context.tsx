'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'sky-beauty-favorites';
/** Máximo de favoritos guardados (lo que la API devuelve en una sola consulta por ids). */
export const MAX_FAVORITES = 100;

interface FavoritesContextValue {
  /** Ids de los productos guardados, del más reciente al más antiguo. */
  ids: string[];
  /** false mientras no se han leído los favoritos guardados en el navegador. */
  ready: boolean;
  isFavorite: (productId: string) => boolean;
  /** Guarda o quita el producto. Devuelve true si quedó guardado. */
  toggle: (productId: string) => boolean;
  /** Deja solo los ids indicados (p. ej. para quitar productos que ya no están publicados). */
  keepOnly: (productIds: string[]) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function readFavorites(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Sin almacenamiento (modo privado o bloqueado): los favoritos viven solo en esta pestaña.
  }
}

/**
 * Favoritos de la tienda. Como no hay cuentas de clientes, se guardan en este navegador: no
 * pasan a otros dispositivos y se pierden si se borran los datos del sitio.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Primero se lee lo guardado; solo después se guarda, para no borrarlo al recargar.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIds(readFavorites());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (ready) writeFavorites(ids);
  }, [ids, ready]);

  // Otra pestaña de la tienda cambió los favoritos.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setIds(readFavorites());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback(
    (productId: string) => {
      const saved = !ids.includes(productId);
      setIds((list) =>
        list.includes(productId)
          ? list.filter((id) => id !== productId)
          : [productId, ...list].slice(0, MAX_FAVORITES),
      );
      return saved;
    },
    [ids],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ids,
      ready,
      isFavorite: (productId) => ids.includes(productId),
      toggle,
      keepOnly: (productIds) => {
        const keep = new Set(productIds);
        setIds((list) => list.filter((id) => keep.has(id)));
      },
    }),
    [ids, ready, toggle],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites debe usarse dentro de FavoritesProvider.');
  return context;
}
