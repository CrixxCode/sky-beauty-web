# Plan de pruebas del frontend — Sky Beauty Maquillaje

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-10-15 |
| Rama analizada | `dev` (commit `aaa2566`) |
| Alcance | `frontend/`: tienda pública (`src/app/(tienda)`) y panel administrativo (`src/app/admin`) |
| Documentos relacionados | [`PLAN_MAESTRO_QA.md`](PLAN_MAESTRO_QA.md) (riesgos `R-xx`, hallazgos `H-xx`, preguntas `Q-xx`, escenarios `E2E-xx`) · [`PLAN_PRUEBAS_BACKEND.md`](PLAN_PRUEBAS_BACKEND.md) (casos `BE-xxx`) |

> **División del trabajo con el backend.** Este plan prueba lo que el usuario ve y hace: interfaz, estados, navegación, validación en el navegador, persistencia local, accesibilidad y responsive. Las reglas de negocio (precios, stock, permisos, totales) se prueban en la API (`BE-xxx`) y aquí solo se verifica que la interfaz las refleje. Los flujos completos tienda ↔ panel están en el plan maestro (`E2E-xx`).

---

## A. Información general

### A.1 Objetivo

Garantizar que un cliente pueda encontrar productos, armar su bolsa y registrar un pedido desde el celular sin errores ni confusiones, y que la propietaria y el personal operen el panel con los permisos correctos, antes de publicar la tienda.

### A.2 Alcance

**Dentro del alcance (verificado en el código):**

| Área | Rutas reales | Componentes principales |
|---|---|---|
| Estructura de la tienda | `src/app/(tienda)/layout.tsx`, `not-found.tsx`, `error.tsx` | `features/storefront/store-navigation.tsx`, `components/layout/store-footer.tsx`, `header-count.tsx` |
| Inicio | `/` | `features/storefront/home-sections.tsx`, `hero-carousel.tsx` |
| Catálogo, búsqueda, filtros, ofertas | `/productos?categoria&marca&q&ofertas&pagina` | `features/storefront/catalog-ui.tsx`, `product-finder.tsx`, `mobile-filters-sheet.tsx` |
| Ficha de producto | `/producto/[slug]` | `features/storefront/product-detail.tsx`, `features/cart/add-to-cart-controls.tsx`, `quantity-stepper.tsx` |
| Agregar desde la tarjeta | Inicio, catálogo, favoritos | `features/cart/quick-add-button.tsx` |
| Favoritos (sin cuenta) | `/favoritos` | `features/favorites/*` (`localStorage` `sky-beauty-favorites`) |
| Bolsa | `/carrito` | `features/cart/cart-page.tsx`, `cart-context.tsx` (`localStorage` `sky-beauty-cart`), `use-cart-quote.ts`, `order-summary.tsx` |
| Checkout | `/checkout` | `features/cart/checkout-page.tsx` |
| Pedido creado | `/pedido/[code]` | `features/cart/order-created-page.tsx` (`sessionStorage`) |
| Seguimiento y rastreador | `/seguimiento/[token]`, `/rastrear` | `app/(tienda)/seguimiento/[token]/page.tsx`, `features/tracking/track-order-form.tsx` |
| Contenido y legales | `/contacto`, `/terminos`, `/datos-personales`, `/cambios-y-garantias`, `/envios` | `components/content/rich-text.tsx` |
| SEO | `/robots.txt`, `/sitemap.xml`, metadatos | `app/robots.ts`, `app/sitemap.ts` |
| Panel: acceso | `/admin/login`, `/admin/mi-cuenta` | `src/proxy.ts`, `features/admin-auth/*` |
| Panel: secciones | `/admin`, `/admin/{reportes,pedidos,avisos,pagos,envios,productos,inventario,promociones,categorias,marcas,cuentas,contenido,testimonios,configuracion}` | `features/{dashboard,reports,orders,notices,shipping,catalog,inventory,promotions,admin-users,content,store-settings}/*` |

**Fuera del alcance por decisión de negocio** (no existen en el código y `Context/` las descarta): registro, inicio de sesión, perfil e historial de clientes; recuperación de contraseña por correo; cupones; reseñas o valoraciones públicas; suscripción a novedades; pasarela de pago. Se documentan como **No aplicable** en C.16 y se verifica que **no aparezcan** (FE-126).

**No implementado y no decidido:** filtro por precio y ordenamiento elegido por el cliente (el catálogo ordena por fecha de publicación y "Ofertas" por descuento). Ver FE-027.

### A.3 Tecnologías identificadas

| Elemento | Versión | Uso |
|---|---|---|
| Next.js (App Router) | 16.3.8 | Rutas, Server Components, `proxy.ts`, rewrites `/api/v1` y `/uploads` al backend, cabeceras de seguridad |
| React | 19.2.8 | Interfaz |
| TypeScript | 5.9.3 | — |
| Tailwind CSS | 4 | Estilos y tokens en `app/globals.css` (variante `store:` para mínimo 12 px en la tienda) |
| shadcn/ui sobre `radix-ui` | 1.7 | `components/ui/*` (dialog, sheet, select, radio-group, checkbox, tabs, table, pagination, carousel…) |
| TanStack Query | 5 | Datos del cliente (cotización, ubicaciones, panel) |
| react-hook-form + zod | 7 / 4 | Formularios del panel y esquemas en `src/schemas/` |
| sonner | 2 | Notificaciones (toasts) |
| embla-carousel | 8 | Carrusel del inicio |
| zustand | 5 | Instalado; **sin uso** en el código (`src/stores/` vacío) |
| Jest + Testing Library + jsdom | 30 / 16 | Pruebas unitarias y de componentes |
| Playwright | 1.64.0 | Pruebas de punta a punta (proyectos `movil` = Pixel 7 y `escritorio` = Desktop Chrome) |

### A.4 Dependencias para probar

- **Backend en ejecución** con base `sky_beauty_test` (Playwright compila el backend en `dist-e2e` y lo sirve en el puerto 4100; el frontend en `.next-e2e`, puerto 3100). `e2e/global-setup.ts` limpia la base y crea la propietaria de prueba.
- Variables: `API_INTERNAL_URL`, `NEXT_PUBLIC_SITE_URL` (se fija al compilar), `INTERNAL_API_KEY` (obligatoria en producción).
- Navegadores de Playwright instalados (`npx playwright install`). Hoy solo Chromium.
- El backend de pruebas corre con `NODE_ENV=test`: **el limitador de peticiones y las tareas programadas están apagados** (H-15). Los avisos se disparan con `npm run orders:run-deadlines` desde `e2e/helpers.ts`.

### A.5 Riesgos principales del frontend

| Código | Riesgo | Impacto | Casos |
|---|---|---|---|
| FR-1 | La bolsa, los favoritos y el borrador del checkout dependen de `localStorage`/memoria: datos corruptos, modo privado o varias pestañas pueden perder o duplicar productos | Ventas perdidas | FE-044, FE-045, FE-050, FE-054, FE-132, FE-133 |
| FR-2 | Doble envío del checkout o reintento tras corte de red crea pedidos repetidos si la clave de idempotencia no se conserva | Pedidos duplicados, stock reservado de más | FE-062, FE-064 |
| FR-3 | La interfaz no refleja un bloqueo de la cotización (sin stock, sobre el máximo, variante retirada) y el cliente no entiende por qué no puede comprar | Abandono | FE-049, FE-055, FE-063 |
| FR-4 | Selección de departamento/municipio y métodos de pago dependientes: estados intermedios inconsistentes | Pedido con método no disponible o sin municipio | FE-058, FE-059 |
| FR-5 | Botones o secciones del panel visibles para el personal sin permiso (la API protege, pero la interfaz confunde) | Errores operativos | FE-089, FE-090, FE-110, FE-112 |
| FR-6 | Experiencia móvil: texto < 12 px, campos < 16 px (zoom en iOS), desbordes horizontales | Abandono en celular, que es el canal principal | FE-009, FE-010, FE-117 |
| FR-7 | Accesibilidad insuficiente (contraste de la paleta, botones solo con ícono, foco) | Exclusión de clientes, riesgo legal | FE-118 a FE-121 |
| FR-8 | Solo se prueba en Chromium; Safari iOS es frecuente en Colombia para compras móviles | Fallos no detectados | FE-122 |
| FR-9 | Exposición en la interfaz de datos que no deben verse (cantidad en existencia: la API la envía, aceptado por Q-01, pero la tienda no debe mostrarla; datos del cliente en el seguimiento) | Incumplimiento de decisiones | FE-034, FE-075 |
| FR-10 | Textos legales sin aprobar: las casillas del checkout no enlazan (H-19) | Bloqueo de lanzamiento | FE-061, FE-082 |

---

## B. Estrategia de pruebas

| Tipo | Qué cubre en Sky Beauty | Herramienta | Ubicación |
|---|---|---|---|
| **Unitarias** | Lógica pura: `lib/format.ts`, `lib/csv.ts`, `lib/api.ts`, esquemas zod (`src/schemas`), `validate()` del checkout, lectura/escritura de bolsa y favoritos, `navItemsFor`, `proxy.ts`, paginación del catálogo | Jest + jsdom | `src/**/*.test.ts` junto al código (patrón existente) |
| **Componentes** | Un componente con sus estados: `LoginForm`, `QuantityStepper`, `AddToCartControls`, `QuickAddButton`, `FavoriteButton`, `OrderSummary`, `RichText`, `Modal`, formularios del panel | Jest + Testing Library + `user-event`; `apiFetch` simulado con `jest.mock` (patrón de `login-form.test.tsx`) | `src/**/*.test.tsx` |
| **Integración frontend** | Proveedores + componentes + React Query con API simulada: `CartProvider` + `CartPage`, `CheckoutPage` con cotización y ubicaciones, `FavoritesProvider` + `FavoritesPage` | Jest + Testing Library; simulación de `fetch` por ruta | `src/features/**/__tests__/` |
| **Funcionales / E2E** | Flujos en navegador real contra backend y base de pruebas | Playwright (`movil` y `escritorio`) | `frontend/e2e/*.spec.ts` |
| **Regresión** | Suite completa en cada cambio; suite crítica P0 antes de desplegar | Jest + Playwright en CI | — |
| **Accesibilidad** | WCAG 2.1 AA: análisis automático + teclado + lector de pantalla | `@axe-core/playwright` (propuesta, Q-13) + revisión manual con NVDA/TalkBack | `e2e/a11y.spec.ts` |
| **Responsive** | 360, 390, 768, 1024 y 1440 px; sin desborde horizontal; tamaños mínimos de texto | Playwright con `viewport` parametrizado | `e2e/responsive.spec.ts` |
| **Compatibilidad** | Chromium, Firefox, WebKit (Safari) en la compra y el catálogo | Proyectos adicionales de Playwright (Q-13) | `playwright.config.ts` |
| **Rendimiento de interfaz** | LCP, CLS, INP de inicio, catálogo, ficha y checkout en móvil | Lighthouse (Chrome DevTools o `lighthouse` CLI) sobre la compilación de producción | Manual / flujo programado |
| **Estados de carga, vacío y error** | Bolsa vacía, catálogo vacío, API caída, cotización recalculando, 404 | Testing Library + Playwright (`page.route` para forzar errores) | — |

**Principios:**

1. Selectores por rol y texto visible (`getByRole`, `getByLabel`), como las pruebas existentes; evitar clases de Tailwind.
2. Los datos de las pruebas E2E se crean por la API o el panel (no hay datos sembrados de catálogo) y son evidentemente ficticios.
3. Cada caso E2E corre en `movil` y `escritorio` salvo que diga lo contrario.

---

## C. Casos de prueba por módulo

**Leyenda de Automatización:** `Sí · existe <archivo>` (ya hay prueba; no ejecutada en esta auditoría salvo las unitarias, ver PLAN_MAESTRO_QA §A.1) · `Parcial · existe <archivo>` (ampliar) · `Sí · nueva` · `No` (manual).

### C.1 Estructura y navegación de la tienda

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-001 | Navegación | Encabezado con logotipo oficial y contadores | E2E | Tienda con productos | Abrir `/`; agregar un producto a la bolsa y otro a favoritos | — | Logotipo `brand/horizontal_logo.svg` enlaza a `/`; contadores de bolsa y favoritos se actualizan sin recargar y tienen `aria-label` con la cantidad | P1 | Parcial · existe `e2e/home.spec.ts` | Pendiente |
| FE-002 | Navegación | Menú de categorías y enlace de ofertas | E2E | Categorías con subcategorías y productos activos | Abrir el menú de escritorio y recorrerlo | — | Solo categorías públicas (las que devuelve `GET /store/categories`); "Ofertas" lleva a `/productos?ofertas=1` | P1 | Sí · nueva | Pendiente |
| FE-003 | Navegación | Menú móvil (sheet) | E2E · Accesibilidad | Proyecto `movil` | Abrir con el botón; recorrer con Tab; cerrar con Esc y con el botón; elegir una categoría | — | El foco queda dentro del panel abierto y vuelve al botón al cerrar; la navegación cierra el panel | P1 | Sí · nueva | Pendiente |
| FE-004 | Navegación | Barra de anuncio | E2E | `announcementText` vacío y luego con texto | Abrir `/` en cada caso | — | Sin texto no hay barra; con texto se muestra | P2 | Parcial · existe `e2e/content.spec.ts` | Pendiente |
| FE-005 | Navegación | Pie de la tienda | E2E | Contacto, redes y una página legal publicada | Revisar el pie | — | Logotipo `logo_vertical_dark.svg`; contacto y redes configurados; enlace de WhatsApp; solo páginas legales publicadas; "Rastrear pedido" → `/rastrear`; crédito "Desarrollado por Cristian Ramirez" abre en otra pestaña con `rel` seguro | P2 | Parcial · existe `e2e/store-config.spec.ts` | Pendiente |
| FE-006 | Navegación | Rutas y productos inexistentes | E2E | — | Abrir `/no-existe` y `/producto/no-existe` | — | Página 404 de la tienda con encabezado y pie, y enlace para seguir comprando | P1 | Sí · existe `e2e/errors.spec.ts` | Pendiente |
| FE-007 | Navegación | API caída durante la navegación | E2E | Backend detenido o `page.route` que responde 500 | Abrir `/` y `/productos` | — | Se muestra `(tienda)/error.tsx` con mensaje comprensible y opción de reintentar; sin pantalla en blanco ni detalles técnicos | P1 | Sí · nueva | Pendiente |
| FE-008 | Navegación | Cabeceras de seguridad de las páginas | E2E | Compilación de producción | Abrir cualquier página | — | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `Strict-Transport-Security` solo en producción | P1 | Sí · existe `e2e/errors.spec.ts` | Pendiente |
| FE-009 | Navegación | Texto mínimo de 12 px en toda la tienda | Responsive · Visual | Páginas de la tienda con datos | Recorrer `/`, `/productos`, ficha, `/carrito`, `/checkout`, seguimiento y medir `getComputedStyle(fontSize)` de los nodos de texto visibles dentro de `[data-area="store"]` | — | Ningún texto < 12 px (decisión del 2026-10-14) | P2 | Sí · nueva | Pendiente |
| FE-010 | Navegación | Campos de 16 px en celular | Responsive | Proyecto `movil` | Medir `font-size` de `input`, `select`, `textarea` en checkout, rastreador y búsqueda | — | ≥ 16 px (evita el zoom automático de iOS) | P2 | Sí · nueva | Pendiente |

### C.2 Inicio

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-011 | Inicio | Títulos del inicio desde la configuración | E2E | `heroTitle`/`heroSubtitle` vacíos; luego con texto | Abrir `/` | — | Sin textos: solo el nombre de la tienda; con textos: se muestran | P2 | Sí · nueva | Pendiente |
| FE-012 | Inicio | Carrusel accesible | Componente · Accesibilidad | Varias diapositivas | Usar botones anterior/siguiente con teclado; activar `prefers-reduced-motion` | — | Controles con nombre accesible; con movimiento reducido no hay desplazamiento automático | P2 | Sí · nueva | Pendiente |
| FE-013 | Inicio | Destacados | E2E | Productos con `isFeatured` | Abrir `/` | — | La sección muestra solo destacados activos; sin destacados la sección no aparece vacía | P2 | Sí · nueva | Pendiente |
| FE-014 | Inicio | Franja de ofertas | E2E | Promoción vigente | Abrir `/` y seguir el enlace de la franja | — | Muestra productos en oferta; enlaza a `/productos?ofertas=1` | P1 | Sí · existe `e2e/home.spec.ts` | Pendiente |
| FE-015 | Inicio | Testimonios | E2E | 0 publicados; luego 7 publicados | Abrir `/` | — | Sin publicados no hay sección; con 7 se ven 6, formato "Nombre I.", estrellas con texto accesible ("4 de 5") | P2 | Parcial · existe `e2e/home.spec.ts` | Pendiente |
| FE-016 | Inicio | Inicio sin catálogo | E2E | Base sin productos activos | Abrir `/` | — | Sin secciones rotas ni carruseles vacíos; mensaje o enlace coherente | P2 | Sí · nueva | Pendiente |

### C.3 Catálogo, búsqueda, filtros y ofertas

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-017 | Catálogo | Filtro por categoría con subcategorías | E2E | Productos en categoría y subcategoría | Elegir la categoría padre en el filtro | — | URL `?categoria=<id>`; se listan los productos de la categoría y sus subcategorías; título con el nombre | P1 | Parcial · existe `e2e/catalog.spec.ts` | Pendiente |
| FE-018 | Catálogo | Filtro por marca | E2E | Dos marcas con productos | Elegir una marca | — | URL `?marca=<id>`; solo productos de esa marca | P1 | Parcial · existe `e2e/catalog.spec.ts` | Pendiente |
| FE-019 | Catálogo | Búsqueda sin tildes ni mayúsculas | E2E | Producto "Sómbra de prueba" | Buscar `SOMBRA` | — | Aparece el producto; URL con `q` | P1 | Parcial · existe `e2e/catalog.spec.ts` | Pendiente |
| FE-020 | Catálogo | Ofertas combinadas con otros filtros | E2E | Ofertas en dos categorías | Abrir `/productos?ofertas=1` y elegir una categoría | — | Solo ofertas de esa categoría, de mayor a menor descuento; contador de filtros activos correcto | P1 | Sí · nueva | Pendiente |
| FE-021 | Catálogo | Paginación | E2E | 45 productos activos | Navegar a la página 2 y 3; abrir `?pagina=999` y `?pagina=abc` | — | Enlaces anterior/siguiente y elipsis correctos; página actual marcada (`aria-current`); `999` → estado vacío con salida; `abc` → página 1 | P2 | Sí · nueva | Pendiente |
| FE-022 | Catálogo | Sin resultados con filtros | E2E | — | Buscar `zzzz-no-existe` | — | Mensaje de vacío y opción para quitar filtros | P2 | Sí · nueva | Pendiente |
| FE-023 | Catálogo | Filtros en celular | E2E · Responsive | Proyecto `movil` | Abrir el panel de filtros, aplicar categoría y marca, limpiar | — | El panel abre y cierra; la URL refleja los filtros; limpiar los quita | P1 | Sí · nueva | Pendiente |
| FE-024 | Catálogo | Producto agotado en la tarjeta | E2E | Producto con todas las variantes en 0 | Ver la tarjeta | — | Etiqueta "Agotado"; el botón "+" deshabilitado con nombre "…: agotado" | P1 | Sí · nueva | Pendiente |
| FE-025 | Catálogo | Precio con descuento en la tarjeta | E2E | Promoción vigente | Ver la tarjeta | — | Etiqueta "−X%", precio regular tachado y precio final (formato `$ 15.000`) | P1 | Sí · existe `e2e/promotions.spec.ts` | Pendiente |
| FE-026 | Catálogo | Parámetros malformados en la URL | E2E | — | Abrir `/productos?categoria=abc&marca=<script>` | — | Página sin error 500 ni contenido inyectado; estado vacío o filtros ignorados | P2 | Sí · nueva | Pendiente |
| FE-027 | Catálogo | Filtro por precio y ordenamiento elegido por el cliente | Funcional | — | — | — | No implementado y no decidido en `Context/` | P3 | No | No aplicable |

### C.4 Ficha de producto y selección de variantes

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-028 | Ficha | Información del producto y metadatos | E2E | Producto con marca, contenido neto, fotos generales | Abrir `/producto/<slug>` | — | Nombre, marca, descripción, contenido neto, galería; `<title>` y `og:image` con la foto del producto | P1 | Parcial · existe `e2e/catalog.spec.ts` | Pendiente |
| FE-029 | Ficha | Selección de variante | E2E | Variantes A (agotada), B y C con fotos y precios propios | Abrir la ficha; elegir C | — | Se preselecciona la primera disponible (B); al elegir C cambian galería y precio; botón de variante con `aria-pressed` | P0 | Parcial · existe `e2e/catalog.spec.ts` | Pendiente |
| FE-030 | Ficha | Variante agotada | E2E | Variante A agotada | Elegir A | — | "· Agotado" en el botón; mensaje "Esta variante no está disponible."; no se puede agregar | P0 | Sí · nueva | Pendiente |
| FE-031 | Ficha | Todas las variantes agotadas | E2E | Producto sin existencias | Abrir la ficha | — | El producto se ve con "Agotado" y no se puede agregar (decisión "Estructura del catálogo") | P0 | Sí · nueva | Pendiente |
| FE-032 | Ficha | Cantidad limitada por existencias y máximo por pedido | Componente · E2E | Stock 10, `maxPerOrder` 3, tope general 2 | Subir la cantidad con el selector | — | No pasa de 2; se informa el máximo por pedido; no baja de 1 | P0 | Sí · nueva | Pendiente |
| FE-033 | Ficha | Agregar a la bolsa y avisos | Componente · E2E | Bolsa con 1 unidad; máximo 2 | Agregar 3; volver a agregar | — | Primero: "Agregamos a tu bolsa las unidades disponibles." (queda 2); segundo: error "Ya tienes en tu bolsa el máximo…"; acción "Ver bolsa" lleva a `/carrito` | P0 | Sí · nueva | Pendiente |
| FE-034 | Ficha | No se muestra la cantidad en existencia | E2E | Variante con stock 7 | Revisar la ficha, la tarjeta, la bolsa y el checkout | — | Solo "Disponible"/"Agotado"; nunca "quedan 7" (decisión del 2026-10-13). La API sí envía el dato y eso está aceptado (Q-01, 2026-10-15): la restricción es de la interfaz | P1 | Sí · nueva | Pendiente |
| FE-035 | Ficha | Producto no publicado | E2E | Producto `INACTIVE` | Abrir su slug | — | 404 de la tienda | P1 | Sí · existe `e2e/errors.spec.ts` | Pendiente |
| FE-036 | Ficha | Favorito desde la ficha | Componente | — | Activar y desactivar el corazón | — | `aria-pressed` cambia; contador del encabezado se actualiza | P2 | Parcial · existe `e2e/home.spec.ts` | Pendiente |
| FE-037 | Ficha | Producto activo sin variantes activas | E2E | Ver BE-071 | Abrir la ficha | — | Sin controles de compra ni errores de JavaScript; comportamiento final según Q-18 | P2 | Sí · nueva | Pendiente |

### C.5 Tarjetas y agregar rápido

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-038 | Tarjeta | Botón "+" solo con una variante | E2E | Producto de 1 variante y otro de 3 | Usar el "+" en inicio, catálogo y favoritos | — | Una variante: agrega 1 unidad; varias: la tarjeta lleva a la ficha (decisión del 2026-10-14) | P1 | Parcial · existe `e2e/home.spec.ts` | Pendiente |
| FE-039 | Tarjeta | "+" respeta existencias y máximo | Componente | Stock 1 | Pulsar "+" dos veces | — | Segunda vez: aviso de máximo; la bolsa queda en 1 | P1 | Sí · nueva | Pendiente |

### C.6 Favoritos

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-040 | Favoritos | Persistencia y sincronización entre pestañas | E2E | — | Guardar 2 productos; recargar; abrir otra pestaña y quitar uno | — | Persisten tras recargar; la primera pestaña se actualiza sola (evento `storage`) | P1 | Sí · nueva | Pendiente |
| FE-041 | Favoritos | Máximo de 100 productos | Unitaria | 100 guardados | Guardar uno más | — | Se conservan 100 (el más antiguo sale); definir si debe avisarse | P2 | Sí · nueva | Pendiente |
| FE-042 | Favoritos | Producto que dejó de estar publicado | E2E | Favorito despublicado después | Abrir `/favoritos` | — | Aviso de que no está disponible y opción para quitarlo (decisión del 2026-10-14) | P1 | Sí · nueva | Pendiente |
| FE-043 | Favoritos | Aviso de almacenamiento local y no indexación | E2E | — | Abrir `/favoritos` | — | Texto que explica que no pasan a otros dispositivos; `meta robots` `noindex,nofollow` | P3 | Sí · nueva | Pendiente |
| FE-044 | Favoritos | Datos guardados corruptos | Unitaria | `localStorage` con `"{no-json"` o `[1,{}]` | Montar `FavoritesProvider` | — | Lista vacía o solo cadenas válidas; sin excepción | P2 | Sí · nueva | Pendiente |
| FE-045 | Favoritos | Almacenamiento bloqueado | Unitaria | `localStorage.setItem` lanza error | Guardar un favorito | — | Funciona en memoria; sin error visible | P2 | Sí · nueva | Pendiente |

### C.7 Bolsa (carrito)

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-046 | Bolsa | Líneas con datos de la cotización | E2E | Bolsa con 2 variantes, una en promoción | Abrir `/carrito` | — | Nombre, variante, foto, precio unitario, descuento y total por línea calculados por el servidor (BE-114) | P0 | Parcial · existe `e2e/checkout.spec.ts` | Pendiente |
| FE-047 | Bolsa | Cambiar cantidad | E2E | Bolsa con una línea | Subir y bajar la cantidad | — | Totales se recalculan; mientras tanto la lista no desaparece (datos anteriores marcados) | P1 | Sí · nueva | Pendiente |
| FE-048 | Bolsa | Quitar y deshacer | Componente | 3 líneas | Quitar la segunda y pulsar "Deshacer" | — | Vuelve en su posición original | P2 | Sí · nueva | Pendiente |
| FE-049 | Bolsa | Problemas de la cotización | E2E | Una línea sin stock suficiente y otra sobre el máximo | Abrir `/carrito` | — | Mensaje por línea según `issue`; botón para continuar al checkout bloqueado (`canCheckout=false`) | P0 | Sí · nueva | Pendiente |
| FE-050 | Bolsa | Persistencia y datos corruptos | Unitaria | `localStorage` con bolsa válida; luego corrupta y con cantidades 0, −1, 1,5 | Montar `CartProvider` | — | Restaura la válida; descarta entradas inválidas sin excepción | P1 | Sí · nueva | Pendiente |
| FE-051 | Bolsa | Bolsa vacía | E2E | Sin productos | Abrir `/carrito` | — | Estado vacío con enlace a `/productos` | P2 | Sí · nueva | Pendiente |
| FE-052 | Bolsa | Resumen y envío | E2E | Bolsa con productos | Revisar el resumen | — | Subtotal, descuento, "Envío por confirmar" y "Total sin envío" mientras no hay municipio (provisional en `plan-desarrollo.md`, pendiente de decisión) | P0 | Parcial · existe `e2e/checkout.spec.ts` | Pendiente |
| FE-053 | Bolsa | Error al cotizar | Integración FE | `POST /store/orders/quote` responde 500 | Abrir `/carrito` | — | Mensaje de error con reintento; sin `NaN` ni totales en cero | P1 | Sí · nueva | Pendiente |
| FE-054 | Bolsa | Dos pestañas | E2E | — | Agregar en la pestaña A; abrir `/carrito` en B y modificar | — | Documentar: la bolsa no se sincroniza entre pestañas abiertas (H-21); decidir según Q-11 | P3 | Sí · nueva (caracterización) | Pendiente |
| FE-055 | Bolsa | Variante retirada del catálogo | E2E | Producto despublicado después de agregarlo | Abrir `/carrito` | — | La línea se marca como no disponible (`unavailableVariantIds`) con opción de quitarla; checkout bloqueado | P1 | Sí · nueva | Pendiente |

### C.8 Checkout

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-056 | Checkout | Campos obligatorios y foco en el primer error | Componente · Accesibilidad | Bolsa con productos | Enviar el formulario vacío | — | Mensajes por campo; foco en "Nombre completo"; `aria-invalid` y `aria-describedby` en cada campo con error; no se llama a la API | P0 | Sí · nueva | Pendiente |
| FE-057 | Checkout | Teléfono escrito de cualquier forma | E2E | — | Escribir `300 123 4567` y `+57 300-123-4567` | — | Se acepta y el pedido se crea (normaliza el backend, BE-133) | P1 | Sí · nueva | Pendiente |
| FE-058 | Checkout | Departamento y municipio dependientes | E2E | — | Elegir La Guajira → Riohacha; cambiar a Antioquia | — | Municipios del departamento elegido (DIVIPOLA); al cambiar de departamento se borra el municipio | P0 | Sí · nueva | Pendiente |
| FE-059 | Checkout | Métodos de pago según municipio y total | E2E | COD activo solo en Riohacha | Elegir Riohacha y luego Medellín | — | Métodos visibles solo con municipio elegido; COD en Riohacha y no en Medellín; sin métodos: mensaje claro | P0 | Parcial · existe `e2e/checkout.spec.ts` | Pendiente |
| FE-060 | Checkout | Instrucciones del método elegido | E2E | Nequi con instrucciones de prueba | Elegir Nequi | — | Se muestran sus instrucciones | P1 | Sí · nueva | Pendiente |
| FE-061 | Checkout | Dos casillas separadas con enlaces a los textos | E2E | Textos legales publicados (requiere aprobación, H-19) | Revisar y marcar cada casilla | — | Dos casillas obligatorias independientes; cada una enlaza a `/terminos` y `/datos-personales` cuando están publicadas; sin publicar, texto sin enlace | P0 | Parcial · existe `e2e/checkout.spec.ts` | Bloqueado (textos legales sin aprobar) |
| FE-062 | Checkout | Doble clic en "Confirmar pedido" | E2E | Formulario válido | Doble clic rápido | — | El botón se deshabilita al enviar; un solo pedido (misma clave de idempotencia) | P0 | Sí · nueva | Pendiente |
| FE-063 | Checkout | Error del servidor al crear | E2E | Otra sesión compra la última unidad antes | Enviar el pedido | — | Mensaje del servidor ("No hay existencias suficientes…") visible; el formulario conserva lo escrito; se puede corregir desde la bolsa | P0 | Sí · nueva | Pendiente |
| FE-064 | Checkout | Corte de red y reintento | E2E | `page.route` aborta la primera respuesta de `POST /store/orders` después de que el servidor la procesa | Enviar y reintentar | — | El reintento usa la misma clave y lleva al mismo pedido (BE-130); un solo pedido en el panel | P0 | Sí · nueva | Pendiente |
| FE-065 | Checkout | Borrador y aviso al salir | E2E | Formulario parcialmente lleno | Ir a la bolsa y volver; luego intentar cerrar la pestaña | — | El borrador se conserva en la misma pestaña; el navegador pide confirmación al salir con datos sin enviar | P2 | Sí · nueva | Pendiente |
| FE-066 | Checkout | Pedido creado | E2E | Formulario válido | Enviar | — | Se vacía la bolsa, se guarda el resumen en `sessionStorage` y se navega a `/pedido/<código>` | P0 | Sí · existe `e2e/checkout.spec.ts` | Pendiente |
| FE-067 | Checkout | Checkout con bolsa vacía | E2E | Bolsa vacía | Abrir `/checkout` | — | Estado vacío con enlace a productos | P2 | Sí · nueva | Pendiente |
| FE-068 | Checkout | Envío según municipio | E2E | Tarifa en Riohacha; umbral de envío gratis | Elegir Riohacha con subtotal bajo y alto | — | "Envío: $ 5.000" y luego "Envío gratis"; total actualizado | P1 | Sí · nueva | Pendiente |
| FE-069 | Checkout | Datos con caracteres especiales | E2E · Seguridad | — | Nombre `<img src=x onerror=alert(1)>` | — | Se muestra como texto en el pedido creado y en el panel; no se ejecuta | P1 | Sí · nueva | Pendiente |

### C.9 Pedido creado y WhatsApp

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-070 | Pedido creado | Resumen y botón de WhatsApp | E2E | WhatsApp configurado | Crear un pedido | — | Código, productos y totales; botón abre `https://wa.me/<número>?text=` con el mensaje del backend (BE-137) en otra pestaña | P0 | Sí · existe `e2e/checkout.spec.ts` | Pendiente |
| FE-071 | Pedido creado | Sin número de WhatsApp | E2E | `whatsappNumber` vacío | Crear un pedido | — | Sin botón roto; mensaje alternativo para contactar a la tienda | P1 | Sí · nueva | Pendiente |
| FE-072 | Pedido creado | Enlace de seguimiento | E2E | — | Usar el enlace o copiarlo | — | Lleva a `/seguimiento/<token>` del pedido | P1 | Parcial · existe `e2e/tracking.spec.ts` | Pendiente |
| FE-073 | Pedido creado | Abrir el pedido en otra pestaña o dispositivo | E2E | `sessionStorage` vacío | Abrir `/pedido/<código>` directamente | — | No muestra datos de otro pedido ni errores; orienta a `/rastrear` | P1 | Sí · nueva | Pendiente |
| FE-074 | Pedido creado | No indexable | E2E | — | Revisar `robots.txt` y metadatos | — | `/pedido` excluido en `robots.txt`; se recomienda también `noindex` en la página | P3 | Sí · nueva | Pendiente |

### C.10 Seguimiento y rastreador

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-075 | Seguimiento | Avance del pedido sin datos del cliente | E2E | Pedido despachado por transportadora | Abrir el enlace | — | Pasos (registrado, confirmado, preparando, despachado, entregado), pago, transportadora, guía y enlace de rastreo, productos y totales; sin nombre, teléfono ni dirección | P0 | Sí · existe `e2e/tracking.spec.ts` | Pendiente |
| FE-076 | Seguimiento | Enlace inválido | E2E | — | Abrir `/seguimiento/abc` y un token de 48 hex inexistente | — | Mismo mensaje genérico de no encontrado | P0 | Sí · existe `e2e/tracking.spec.ts` | Pendiente |
| FE-077 | Seguimiento | Pedido cancelado con aviso | E2E | Pedido cancelado automáticamente | Abrir el enlace | — | Aviso con la fecha; sin pasos de avance | P1 | Parcial · existe `e2e/notices.spec.ts` | Pendiente |
| FE-078 | Seguimiento | Entrega local | E2E | Envío `LOCAL` | Abrir el enlace | — | "Entrega local de la tienda", sin transportadora ni guía | P2 | Sí · nueva | Pendiente |
| FE-079 | Seguimiento | Enlace de rastreo seguro | E2E | Transportadora con plantilla | Revisar el enlace | — | Abre en otra pestaña con `rel="noreferrer"` | P2 | Sí · nueva | Pendiente |
| FE-080 | Seguimiento | No indexable | E2E | — | Revisar metadatos | — | `noindex, nofollow` | P2 | Sí · nueva | Pendiente |
| FE-081 | Rastreador | Consulta por código y teléfono | E2E | Pedido existente | Enviar vacío; datos que no coinciden; datos correctos; 6 intentos en un minuto (backend con limitador activo) | — | Validación en el formulario; mensaje genérico; navegación al seguimiento; mensaje comprensible ante 429 | P0 | Parcial · existe `e2e/tracking.spec.ts` | Pendiente |

### C.11 Contenido, legales y SEO

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-082 | Contenido | Páginas legales con formato mínimo y sin HTML | E2E · Componente | Texto con `#`, `-`, `**negrita**` y `<script>` | Abrir `/terminos`; quitar el texto y volver a abrir | — | Encabezados, listas y negritas; `<script>` como texto; sin texto → 404 y fuera del pie | P1 | Sí · existe `e2e/content.spec.ts`, `src/components/content/rich-text.test.tsx` | Pendiente |
| FE-083 | Contenido | Contacto | E2E | Contacto configurado | Abrir `/contacto` | — | Datos configurados y botón de WhatsApp; sin formulario de correo | P2 | Sí · nueva | Pendiente |
| FE-084 | SEO | `robots.txt` y `sitemap.xml` | E2E | Productos activos e inactivos; una página legal publicada | Pedir ambos archivos | — | `robots.txt` excluye panel, bolsa, checkout, favoritos, pedido, seguimiento, rastrear y API; `sitemap.xml` solo con productos activos y páginas publicadas | P1 | Sí · nueva | Pendiente |
| FE-085 | SEO | Vista previa al compartir | E2E | Producto con foto | Revisar `og:title`, `og:description`, `og:image` de inicio y ficha | — | Valores del panel y de la foto del producto; imagen general pendiente (logotipo en PNG) | P2 | Sí · nueva | Pendiente |

### C.12 Panel: acceso, sesión y navegación por rol

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-086 | Acceso | El panel exige sesión | E2E | Sin cookie | Abrir `/admin` y `/admin/pedidos` | — | Redirige a `/admin/login` sin mostrar contenido | P0 | Sí · existe `e2e/admin-access.spec.ts` | Pendiente |
| FE-087 | Acceso | Errores de inicio de sesión | E2E | Cuenta existente | Contraseña errada; cuenta bloqueada | — | Mensaje genérico; mensaje de bloqueo con minutos (BE-018) | P0 | Parcial · existe `e2e/admin-access.spec.ts` | Pendiente |
| FE-088 | Acceso | Formulario de inicio de sesión | Componente | — | Enviar vacío; alternar visibilidad de la contraseña | — | Errores sin llamar a la API; el botón de ojo alterna el tipo del campo | P2 | Sí · existe `src/features/admin-auth/login-form.test.tsx` | Pendiente |
| FE-089 | Acceso | Menú según el rol | E2E | Cuenta STAFF | Iniciar sesión como STAFF | — | No ve Reportes, Promociones ni Cuentas; ve Configuración en solo lectura | P0 | Sí · existe `e2e/admin-access.spec.ts` | Pendiente |
| FE-090 | Acceso | URL directa a secciones de la propietaria | E2E | Sesión STAFF | Abrir `/admin/reportes`, `/admin/promociones`, `/admin/cuentas` | — | Redirige a `/admin` (`requireRole`) | P0 | Sí · nueva | Pendiente |
| FE-091 | Acceso | Cookie presente pero inválida o vencida | E2E | Cookie `sb_admin_session=xyz` | Abrir `/admin` | — | `proxy.ts` deja pasar; `requireAdmin` redirige a `/admin/login` | P0 | Sí · nueva | Pendiente |
| FE-092 | Acceso | Cerrar sesión | E2E | Sesión iniciada | Cerrar sesión; usar "Atrás" del navegador | — | Vuelve a login; "Atrás" no muestra datos del panel sin volver a validar | P1 | Sí · nueva | Pendiente |
| FE-093 | Acceso | Cambio de contraseña propia | E2E · Componente | Sesión iniciada | Nueva < 12; confirmación distinta; correcta | — | Errores de validación; éxito con aviso | P1 | Parcial · existe `src/schemas/admin-auth.test.ts` | Pendiente |
| FE-094 | Acceso | Sesión que vence durante una acción | E2E | Sesión revocada desde otra pestaña | Guardar un formulario | — | Mensaje claro y redirección a login; sin pérdida silenciosa | P1 | Sí · nueva | Pendiente |

### C.13 Panel: secciones de operación

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-095 | Resumen | Pendientes del día y ventas | E2E | Pedidos y avisos pendientes; ventas pagadas | Abrir `/admin` como ADMIN y como STAFF | — | Ambos ven los pendientes con enlace a su sección (cifras de BE-210); solo ADMIN ve las ventas de 30 días | P1 | Sí · nueva | Pendiente |
| FE-096 | Notificaciones | Campana del panel | E2E | Notificaciones sin leer | Abrir la campana; marcar una; marcar todas | — | Contador correcto; disminuye al leer; independiente por usuario | P2 | Parcial · existe `e2e/notices.spec.ts` | Pendiente |
| FE-097 | Cuentas | Gestión del personal | E2E | Sesión ADMIN | Crear STAFF; correo repetido; desactivar; restablecer contraseña | — | Mensajes de éxito y error; la cuenta desactivada no inicia sesión | P1 | Parcial · existe `e2e/admin-access.spec.ts` | Pendiente |
| FE-098 | Configuración | Solo lectura para el personal | E2E | Sesión STAFF | Abrir `/admin/configuracion` | — | Campos deshabilitados (`fieldset disabled`) y sin botones de guardar | P0 | Sí · existe `e2e/store-config.spec.ts` | Pendiente |
| FE-099 | Configuración | Datos, cifras y tarifas | E2E | Sesión ADMIN | Guardar WhatsApp de 10 dígitos; cifras inválidas; agregar y quitar tarifa por municipio | — | WhatsApp guardado con `57`; errores por campo; tarifas listadas por departamento/municipio | P1 | Parcial · existe `e2e/store-config.spec.ts` | Pendiente |
| FE-100 | Métodos de pago | Activación y municipios | E2E | Sesión ADMIN | Activar Nequi sin instrucciones; con instrucciones; agregar municipios al COD | — | Mensaje del servidor; activado; lista de municipios actualizada | P1 | Parcial · existe `e2e/store-config.spec.ts` | Pendiente |
| FE-101 | Contenido | Edición del contenido | E2E | ADMIN y STAFF | Editar títulos y textos; abrir como STAFF | — | ADMIN guarda; STAFF ve en solo lectura | P2 | Parcial · existe `e2e/content.spec.ts` | Pendiente |
| FE-102 | Testimonios | Gestión de testimonios | E2E | ADMIN y STAFF | Crear, publicar, ocultar, borrar; abrir como STAFF | — | Acciones reflejadas en el inicio; STAFF sin botones de edición | P2 | Parcial · existe `e2e/home.spec.ts` | Pendiente |
| FE-103 | Marcas | Gestión de marcas | E2E | ADMIN y STAFF | Crear, editar, nombre repetido; borrar como STAFF y con productos | — | 409 mostrado como mensaje; borrar solo visible para ADMIN | P2 | Sí · nueva | Pendiente |
| FE-104 | Categorías | Dos niveles | E2E | ADMIN | Crear categoría, subcategoría y un tercer nivel | — | El tercer nivel no se ofrece o muestra el error del servidor | P2 | Sí · nueva | Pendiente |
| FE-105 | Productos | Crear y publicar con variantes y fotos | E2E | ADMIN y STAFF | Crear producto con precio base 0 (error) y luego válido; variante con precio propio 0 (error) y válida; foto; publicar; abrir como STAFF | — | Precio 0 rechazado con mensaje (Q-02); producto visible en la tienda; STAFF sin columna ni campo de costo | P0 | Parcial · existe `e2e/catalog.spec.ts` | Pendiente |
| FE-106 | Productos | Errores al subir fotos | E2E | ADMIN | Subir 6 MB; subir un PDF | — | Mensajes "supera el tamaño máximo" y "Solo se aceptan imágenes JPG, PNG o WebP" | P1 | Sí · nueva | Pendiente |
| FE-107 | Inventario | Entradas, ajustes e historial | E2E | STAFF | Registrar compra; ajuste sin motivo; ajuste con motivo; filtrar stock bajo | — | Motivo exigido en ajustes; historial cuadra; alerta de stock bajo | P1 | Sí · existe `e2e/inventory.spec.ts` | Pendiente |
| FE-108 | Promociones | Crear, validar y versiones | E2E | ADMIN | Crear con fechas invertidas; sobre el límite; del 100 %; fija mayor que el precio de un destino; válida; editar; ver versiones | — | Mensajes de error (el 100 % y la fija que deja un precio en 0 se rechazan, Q-02); precio con descuento en la tienda; historial de versiones | P1 | Parcial · existe `e2e/promotions.spec.ts` | Pendiente |
| FE-109 | Pedidos | Bandeja con filtros | E2E | 25 pedidos | Filtrar por estado y pago; buscar por código, nombre y teléfono; paginar | — | Resultados y paginación correctos | P1 | Sí · nueva | Pendiente |
| FE-110 | Pedidos | Detalle y acciones según rol | E2E | Pedido pendiente sin envío; pedido pagado; STAFF y ADMIN | Confirmar (pide costo de envío); editar productos; cancelar; cancelar el pedido pagado | — | Confirmar exige costo; editar solo si está sin confirmar; STAFF solo ve "Cancelar" cuando `staffCanCancel`; un pedido pagado no se cancela sin registrar antes la devolución, y la interfaz lo explica (Q-05) | P0 | Parcial · existe `e2e/orders.spec.ts` | Pendiente |
| FE-111 | Pedidos | Conflicto por edición simultánea | E2E | Dos pestañas con el mismo pedido | Confirmar en una y editar en otra | — | Mensaje "El pedido cambió mientras se procesaba…" y recarga de datos | P1 | Sí · nueva | Pendiente |
| FE-112 | Pagos | Bandeja y acciones | E2E | Pedidos con comprobante | STAFF registra comprobante; ADMIN verifica, rechaza y devuelve; ADMIN cambia el costo de envío de un pedido pagado | — | STAFF no ve verificar, rechazar ni devolver; plazo de aclaración visible; el cambio de envío tras el pago se permite y actualiza el total (Q-03). Monto distinto y devoluciones parciales según Q-04 (por confirmar) | P0 | Sí · existe `e2e/payments.spec.ts` | Pendiente |
| FE-113 | Envíos | Transportadoras y envío del pedido | E2E | STAFF | Crear transportadora; despachar con guía; entrega local; copiar enlace de seguimiento | — | Estados del pedido y del seguimiento actualizados | P1 | Parcial · existe `e2e/shipping.spec.ts` | Pendiente |
| FE-114 | Avisos | Bandeja de avisos | E2E | Aviso pendiente | Abrir WhatsApp; marcar enviado; ver pestaña de enviados | — | Enlace `wa.me` con el teléfono del cliente; contador del menú disminuye | P1 | Sí · existe `e2e/notices.spec.ts` | Pendiente |
| FE-115 | Reportes | Filtros, pestañas y CSV | E2E | Ventas pagadas | Cambiar fechas; recorrer pestañas; exportar | — | Últimos 30 días por defecto; CSV con `;`, coma decimal y BOM | P1 | Sí · existe `e2e/reports.spec.ts` | Pendiente |
| FE-116 | Panel | API caída en el panel | E2E | `page.route` responde 500 | Abrir secciones | — | `admin/(panel)/error.tsx` con mensaje y reintento | P2 | Sí · nueva | Pendiente |

### C.14 Transversales: responsive, accesibilidad, compatibilidad, rendimiento y estados

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-117 | Responsive | Matriz de anchos | Responsive | Datos de catálogo | Abrir inicio, catálogo, ficha, bolsa, checkout, seguimiento y 4 secciones del panel en 360, 390, 768, 1024 y 1440 px | — | Sin desplazamiento horizontal (`scrollWidth ≤ innerWidth`); elementos táctiles ≥ 44×44 px en celular | P1 | Sí · nueva | Pendiente |
| FE-118 | Accesibilidad | Análisis automático WCAG 2.1 AA | Accesibilidad | `@axe-core/playwright` (Q-13) | Analizar las páginas de FE-117 | — | Cero violaciones `serious` o `critical` | P1 | Sí · nueva | Pendiente |
| FE-119 | Accesibilidad | Compra solo con teclado | Accesibilidad | — | Completar E2E-001 sin ratón | — | Todo alcanzable con Tab/Enter/Espacio; foco visible; orden lógico | P1 | Sí · nueva | Pendiente |
| FE-120 | Accesibilidad | Botones con ícono y lector de pantalla | Accesibilidad | NVDA o TalkBack | Recorrer encabezado, tarjetas y bolsa | — | Corazón, "+", bolsa, menú y cerrar con nombre accesible (p. ej. "Agregar … a la bolsa") | P2 | Parcial · nueva + revisión manual | Pendiente |
| FE-121 | Accesibilidad | Contraste de la paleta oficial | Accesibilidad | Colores `#B785B8`, `#A46EA4`, `#D8D4CB`, `#F5F1EB`, `#8A694D` | Medir combinaciones texto/fondo usadas | — | ≥ 4,5:1 en texto normal y ≥ 3:1 en texto grande | P2 | Sí · nueva (axe) | Pendiente |
| FE-122 | Compatibilidad | Navegadores | Compatibilidad | Proyectos Firefox y WebKit (Q-13) | Ejecutar E2E-001, E2E-002 y FE-058 | — | Mismo resultado que en Chromium; atención a Safari iOS (WebKit) | P1 | Sí · nueva | Pendiente |
| FE-123 | Rendimiento | Métricas en celular | Rendimiento | Compilación de producción con 100 productos y fotos | Lighthouse móvil en inicio, catálogo, ficha y checkout | — | Metas propuestas (Q-15): LCP < 2,5 s, CLS < 0,1, INP < 200 ms, rendimiento ≥ 80 | P2 | Parcial · Lighthouse manual o programado | Pendiente |
| FE-124 | Estados | Carga de bolsa y checkout | Componente | Cotización pendiente | Montar `CartPage` y `CheckoutPage` con la API demorada | — | Indicador de carga; botón de envío deshabilitado mientras se recalcula ("Actualizando…") | P2 | Sí · nueva | Pendiente |
| FE-125 | Estados | Movimiento reducido | Accesibilidad | `prefers-reduced-motion: reduce` | Recorrer inicio y bolsa | — | Sin animaciones automáticas ni transiciones largas | P3 | Sí · nueva | Pendiente |
| FE-126 | Alcance | Funciones descartadas no aparecen | Regresión | Compilación de producción | Buscar en la tienda: "Iniciar sesión", "Registrarse", "Mi cuenta", "Cupón", "Suscríbete", "¿Olvidaste tu contraseña?"; rutas `/login`, `/cuenta`, `/registro` | — | Ninguna existe en la tienda (las rutas responden 404) | P1 | Sí · nueva | Pendiente |
| FE-127 | Alcance | Sin datos del prototipo | Regresión | Código fuente | Buscar `CIELO10`, `unsplash`, precios y marcas del demo en `frontend/src` | — | Sin coincidencias | P2 | Sí · nueva (verificación en CI) | Pendiente |

### C.15 Unitarias de lógica del frontend

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-128 | Formato | Pesos y WhatsApp | Unitaria | — | `formatCOP`, `normalizeWhatsappNumber`, `whatsappUrl` | 15000; `300 123 4567` | `$ 15.000`; `573001234567`; mismo criterio que el backend | P1 | Sí · existe `src/schemas/store-settings.test.ts` | Pendiente |
| FE-129 | CSV | Exportación | Unitaria | — | `toCsv` con comas, comillas, saltos y decimales | — | `;`, BOM, comillas escapadas | P2 | Sí · existe `src/lib/csv.test.ts` | Pendiente |
| FE-130 | Esquemas | Validaciones de formularios | Unitaria | — | Esquemas de `admin-auth`, `catalog`, `store-settings` y `testimonials` | Casos límite | Mismos límites que los DTO del backend (p. ej. contraseña 12, rating 1–5, inicial de 1 letra, precios mayores que 0 por Q-02) | P2 | Parcial · existe para 3 esquemas; falta `testimonials.ts` | Pendiente |
| FE-131 | API | Cliente de la API | Unitaria | — | `apiFetch` y `fetchPublicApi` con 2xx, 204, 404, 500 y cuerpo no JSON | — | `ApiError` con mensaje del backend; 404 → `null` en la versión pública; cabecera interna solo si hay clave | P1 | Sí · existe `src/lib/api.test.ts`, `src/lib/api.server.test.ts` | Pendiente |
| FE-132 | Bolsa | Lógica de `CartProvider` | Unitaria | — | `addItem` con máximo; `updateItem` con 0, −1, 1,5; `restoreItem`; `clear` | — | Nunca supera el máximo; ignora cantidades inválidas; restaura en su posición | P0 | Sí · nueva | Pendiente |
| FE-133 | Favoritos | Lógica de `FavoritesProvider` | Unitaria | — | `toggle`, `keepOnly`, límite 100, evento `storage` | — | Comportamiento descrito en la decisión del 2026-10-14 | P1 | Sí · nueva | Pendiente |
| FE-134 | Checkout | Función `validate()` | Unitaria | — | Combinaciones de campos vacíos y límites | Nombre de 1; teléfono de 6; dirección de 4 | Mismos mínimos que `CreateOrderDto` (BE-134) | P0 | Sí · nueva (exportar la función o probarla vía el componente) | Pendiente |
| FE-135 | Acceso | `proxy.ts` | Unitaria | — | Peticiones a `/admin`, `/admin/login`, `/admin/pedidos` con y sin cookie | — | Sin cookie redirige salvo `/admin/login` | P1 | Sí · nueva | Pendiente |
| FE-136 | Acceso | `navItemsFor` | Unitaria | — | `ADMIN` y `STAFF` | — | STAFF sin Reportes, Promociones ni Cuentas | P1 | Sí · nueva | Pendiente |
| FE-137 | Contenido | `parseRichText` y `RichText` | Unitaria | — | Títulos, listas, negritas, `\r\n`, HTML | — | Encabezados semánticos; HTML como texto | P1 | Sí · existe `src/components/content/rich-text.test.tsx` | Pendiente |
| FE-138 | Catálogo | Paginación (`pageList`) | Unitaria | — | `pageList(1,1)`, `(5,10)`, `(10,10)` | — | Páginas y elipsis correctas | P3 | Sí · nueva (exportar la función) | Pendiente |

### C.16 Funcionalidades del listado inicial que no aplican

Se registran para que nadie las implemente ni las pruebe por error. Su ausencia se verifica en FE-126.

| ID | Módulo | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| FE-139 | Clientes | Registro e inicio de sesión de clientes | — | — | — | — | Descartado: el cliente compra sin cuenta (`negocio.md` §3, §13) | P3 | No | No aplicable |
| FE-140 | Clientes | Recuperación de contraseña por correo | — | — | — | — | Descartado: no hay servicio de correo (decisión del 2026-10-09) | P3 | No | No aplicable |
| FE-141 | Clientes | Perfil e historial de pedidos del cliente | — | — | — | — | Descartado: sin cuentas. El cliente consulta su pedido con el enlace privado o `/rastrear` (FE-075, FE-081) | P3 | No | No aplicable |
| FE-142 | Promociones | Cupones | — | — | — | — | Descartado (`AGENTS.md` §4) | P3 | No | No aplicable |
| FE-143 | Contenido | Reseñas y valoraciones públicas | — | — | — | — | No existe formulario público; los testimonios los registra la propietaria (FE-015, FE-102) | P3 | No | No aplicable |
| FE-144 | Contenido | Suscripción a novedades | — | — | — | — | Descartada por ahora (decisión del 2026-10-14) | P3 | No | No aplicable |

---

## D. Matriz de pruebas (resumen)

Las tablas de la sección C son la matriz completa (FE-001 a FE-144).

| Módulo | Rango | Casos | P0 | P1 | P2 | P3 | No aplicable | Bloqueado |
|---|---|---|---|---|---|---|---|---|
| C.1 Estructura y navegación | FE-001 – FE-010 | 10 | 0 | 6 | 4 | 0 | 0 | 0 |
| C.2 Inicio | FE-011 – FE-016 | 6 | 0 | 1 | 5 | 0 | 0 | 0 |
| C.3 Catálogo | FE-017 – FE-027 | 11 | 0 | 7 | 3 | 1 | 1 | 0 |
| C.4 Ficha | FE-028 – FE-037 | 10 | 5 | 3 | 2 | 0 | 0 | 0 |
| C.5 Tarjetas | FE-038 – FE-039 | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| C.6 Favoritos | FE-040 – FE-045 | 6 | 0 | 2 | 3 | 1 | 0 | 0 |
| C.7 Bolsa | FE-046 – FE-055 | 10 | 3 | 4 | 2 | 1 | 0 | 0 |
| C.8 Checkout | FE-056 – FE-069 | 14 | 8 | 4 | 2 | 0 | 0 | 1 |
| C.9 Pedido creado | FE-070 – FE-074 | 5 | 1 | 3 | 0 | 1 | 0 | 0 |
| C.10 Seguimiento | FE-075 – FE-081 | 7 | 3 | 1 | 3 | 0 | 0 | 0 |
| C.11 Contenido y SEO | FE-082 – FE-085 | 4 | 0 | 2 | 2 | 0 | 0 | 0 |
| C.12 Panel: acceso | FE-086 – FE-094 | 9 | 5 | 3 | 1 | 0 | 0 | 0 |
| C.13 Panel: secciones | FE-095 – FE-116 | 22 | 4 | 12 | 6 | 0 | 0 | 0 |
| C.14 Transversales | FE-117 – FE-127 | 11 | 0 | 5 | 5 | 1 | 0 | 0 |
| C.15 Unitarias | FE-128 – FE-138 | 11 | 2 | 6 | 2 | 1 | 0 | 0 |
| C.16 No aplicables | FE-139 – FE-144 | 6 | 0 | 0 | 0 | 6 | 6 | 0 |
| **Total** | FE-001 – FE-144 | **144** | **31** | **61** | **40** | **12** | **7** | **1** |

Estado: 136 casos **Pendiente**, 7 **No aplicable** (FE-027 y FE-139 a FE-144) y 1 **Bloqueado** (FE-061).

> Los totales por prioridad se consolidan en [`PLAN_MAESTRO_QA.md` §D](PLAN_MAESTRO_QA.md#d-priorización).

---

## E. Recomendaciones técnicas

### E.1 Herramientas compatibles con el stack real

| Necesidad | Recomendación | Estado |
|---|---|---|
| Unitarias y componentes | **Jest 30 + Testing Library + jsdom** (ya configurado con `next/jest`) | En uso |
| E2E | **Playwright 1.64** (ya configurado con backend y frontend compilados) | En uso |
| Accesibilidad automática | `@axe-core/playwright` (dependencia de desarrollo, código abierto) | Propuesta (Q-13) |
| Compatibilidad | Proyectos `firefox` y `webkit` de Playwright (`devices['iPhone 14']`) | Propuesta (Q-13) |
| Rendimiento | Lighthouse (incluido en Chrome; CLI `lighthouse` opcional) | Propuesta |
| Simulación de API en componentes | Mantener `jest.mock('@/lib/api')` (patrón actual); para integración FE, un simulador de `fetch` por ruta escrito en `src/test-utils/` | Propuesta |

No se recomiendan servicios de pago (visual testing en la nube, granjas de dispositivos). Si se requieren dispositivos reales, usar los propios (Q-20).

### E.2 Organización de los archivos de pruebas

```text
frontend/
├── src/
│   ├── **/<archivo>.test.ts(x)         # unitarias y componentes junto al código (patrón actual)
│   ├── features/**/__tests__/          # NUEVO: integración FE (proveedor + página + API simulada)
│   └── test-utils/                     # NUEVO: render con QueryClient y proveedores, fetch simulado
└── e2e/
    ├── helpers.ts                      # existe: login, openNav, logout, pick, advanceOrder
    ├── factories.ts                    # NUEVO: crear marca/categoría/producto/variante/stock por API
    ├── <flujo>.spec.ts                 # existentes
    ├── a11y.spec.ts                    # NUEVO: FE-118, FE-121
    ├── responsive.spec.ts              # NUEVO: FE-009, FE-010, FE-117
    └── resilience.spec.ts              # NUEVO: FE-007, FE-053, FE-064, FE-116 con page.route
```

Recomendación: incluir el ID en el título de cada prueba nueva (`test('[FE-064] corte de red…')`).

### E.3 Estrategia de mocks

- **Unitarias/componentes:** simular `@/lib/api` (`apiFetch`) y `next/navigation` (`useRouter`), como hace `login-form.test.tsx`. Envolver en `QueryClientProvider` con `retry: false`.
- **`localStorage`/`sessionStorage`:** usar el de jsdom; para FE-045 sustituir `setItem` por una función que lanza.
- **Tiempo:** `jest.useFakeTimers()` para el arranque diferido de `CartProvider`/`FavoritesProvider` (`setTimeout(…, 0)`).
- **E2E:** **no** simular el backend en los flujos de negocio; solo `page.route` para forzar fallos (500, corte de red, latencia) en los casos de resiliencia.

### E.4 Cobertura recomendada

| Ámbito | Meta propuesta |
|---|---|
| `src/lib`, `src/schemas`, `features/cart/cart-context.tsx`, `features/favorites/favorites-context.tsx`, `proxy.ts` | ≥ 90 % de líneas |
| Componentes de compra (`features/cart`, `features/storefront/product-detail.tsx`) | ≥ 75 % de líneas |
| Panel (`features/*-manager.tsx`) | Cubierto por E2E; unitarias solo en lógica extraíble |
| Casos P0 de este plan | 100 % automatizados |

Hoy no se mide cobertura en el frontend. Agregar `--coverage` con `collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts']` y umbrales progresivos (empezar por el valor medido y subir).

### E.5 Ejecución local y en CI/CD

**Local:**

```bash
cd frontend
npm run lint && npm run typecheck
npm test                      # unitarias y componentes (no requiere backend)
npx playwright install        # una vez
npm run test:e2e              # requiere PostgreSQL con sky_beauty_test y backend/.env con TEST_DATABASE_URL
npx playwright test e2e/checkout.spec.ts --project=movil   # un flujo en celular
```

**CI (propuesta, sujeta a Q-12):** job `frontend-unit` (lint, typecheck, `npm test`) en cada push; job `e2e` con servicio PostgreSQL 17, `npm ci` en `backend/` y `frontend/`, `npx playwright install --with-deps chromium`, `npm run test:db:prepare` (backend) y `npm run test:e2e`; publicar `playwright-report/` como artefacto cuando falle. Las pruebas de Firefox/WebKit, accesibilidad completa y Lighthouse pueden ir en un flujo programado diario para no alargar cada cambio.
