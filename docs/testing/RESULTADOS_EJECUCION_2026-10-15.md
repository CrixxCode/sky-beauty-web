# Resultados de la ejecución del plan de QA — Sky Beauty Maquillaje

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15 |
| Rama | `dev` (commit `aaa2566` más los cambios de esta ejecución) |
| Planes ejecutados | [`PLAN_MAESTRO_QA.md`](PLAN_MAESTRO_QA.md) (SMK-01 a SMK-12, E2E-001 a E2E-023) · [`PLAN_PRUEBAS_BACKEND.md`](PLAN_PRUEBAS_BACKEND.md) (BE-001 a BE-232) · [`PLAN_PRUEBAS_FRONTEND.md`](PLAN_PRUEBAS_FRONTEND.md) (FE-001 a FE-144) |
| Casos ejecutados | 411 de 411 |

## 1. Resumen

| Grupo | Casos | Aprobado | Fallido | Parcial | Caracterización | Bloqueado | No aplica |
|---|---|---|---|---|---|---|---|
| Smoke (SMK) | 12 | 12 | 0 | 0 | 0 | 0 | 0 |
| Backend (BE) | 232 | 193 | 22 | 5 | 12 | 0 | 0 |
| Frontend (FE) | 144 | 111 | 10 | 9 | 6 | 1 | 7 |
| Punta a punta (E2E) | 23 | 22 | 0 | 0 | 0 | 1 | 0 |
| **Total** | **411** | **338** | **32** | **14** | **18** | **2** | **7** |

**Significado de los estados.**
- **Aprobado:** el sistema hizo lo que el plan espera.
- **Fallido:** no lo hizo. Incluye defectos ya conocidos cuyo cambio de código está pendiente (Q-02, Q-05).
- **Parcial:** una parte se cumple y otra no, o una parte no se pudo verificar.
- **Caracterización:** se documenta lo que hace el sistema porque el resultado final depende de una decisión pendiente (`Q-xx`).
- **Bloqueado:** depende de algo externo, como los textos legales aprobados.
- **No aplica:** la función está descartada en `Context/`.

**Lectura.** Las reglas críticas funcionan de punta a punta:
- Reserva de existencias, también con compradores simultáneos.
- Idempotencia del pedido.
- Totales sin descuadres.
- Permisos de la propietaria y del personal.
- Plazos automáticos y avisos.
- Pagos y envíos.
- Privacidad del seguimiento.
- Compra sin cuenta en celular, escritorio, Firefox y WebKit (iPhone).

Lo que bloquea un lanzamiento:
- Los dos cambios de código ya decididos el 15-oct: que no exista precio final de 0 COP y que no se pueda cancelar un pedido pagado sin registrar la devolución.
- La falta de paginación en las bandejas del panel.
- La capacidad del backend bajo carga, que hay que confirmar en Railway.
- Los bloqueos de negocio ya conocidos: textos legales y copias de seguridad.

## 2. Cómo se ejecutó

- **Entorno de QA aislado:**
  - Base `sky_beauty_qa`, creada y migrada para esta ejecución.
  - Backend compilado en el puerto 4200 con `NODE_ENV=development`, para que el limitador de peticiones estuviera activo.
  - Frontend compilado en modo producción en el puerto 3200.
  - Instancias temporales del backend con otras variables, para los casos de arranque, producción y plazos en 0.
  - La base de desarrollo `sky_beauty` **no se tocó**. La base `sky_beauty_test` solo la usan las suites automáticas.
- **Datos:** todos ficticios (`…@ejemplo.test`, teléfonos `300…`, WhatsApp `573000000000`), creados por la API o por el panel. Para BE-227 a BE-232 se cargaron por SQL 2.000 productos (`Carga QA …`), 5.000 variantes y 5.000 pedidos vencidos.
- **Backend:** cada caso se ejecutó con peticiones HTTP reales y verificación en la base. Los plazos se probaron moviendo fechas en la base y ejecutando el ciclo con `npm run orders:run-deadlines`.
- **Frontend:** Playwright (Chromium) con perfiles Pixel 7 y Desktop Chrome contra el frontend compilado; FE-122 también en Firefox, WebKit escritorio y WebKit iPhone. Accesibilidad con axe-core 4.10 (WCAG 2.1 AA). Rendimiento en celular con CPU ×4 y red lenta (no es Lighthouse).
- **Casos sin ruta en la API** (BE-029, BE-202 y parte de BE-105, BE-112 y BE-196): se citan las pruebas automatizadas que los cubren y que se ejecutaron y aprobaron este mismo día, o la revisión de código. Lo indica la evidencia de cada caso.
- **Suites automáticas existentes:**
  - Unitarias: backend 40/40 y frontend 38/38.
  - Integración del backend: 170/170.
  - Playwright: 38/38 tras actualizar los selectores; ver §6.
- **Arnés y evidencias:** los scripts, los registros y las capturas quedaron en el scratchpad de la sesión y no forman parte del repositorio. Cada caso de la tabla final trae su evidencia.

## 3. Defectos encontrados

Severidad según PLAN_MAESTRO_QA §F.4. Ningún defecto se corrigió en el código de la aplicación: se reportan para decisión, según AGENTS.md §5.

### Alta: bloquean el lanzamiento

| ID | Defecto | Casos | Detalle |
|---|---|---|---|
| D-01 | Se puede vender a precio final 0 COP | BE-068, BE-073, BE-102, BE-106, BE-107, BE-108, BE-111, BE-143, FE-105, FE-108, FE-130 | Se aceptan precio base y precio de variante en 0, promociones del 100 % y descuentos fijos iguales o mayores que el precio. Además, el redondeo deja en 0 un precio de 1 COP con 50 % de descuento. Hay un pedido real de QA a 0 COP. Ya conocido (H-02); falta el cambio de código de Q-02 y decidir el mecanismo (Q-22). |
| D-02 | Se cancela un pedido pagado sin registrar la devolución | BE-158, FE-110 | El pedido queda `CANCELLED` con `PAID`, y en el panel el botón de cancelar se habilita sin explicar la devolución. Ya conocido (H-10); falta el cambio de Q-05. |
| D-03 | Las bandejas del panel no paginan | FE-109 | Pedidos, productos y promociones muestran solo los 20 más recientes (por ejemplo, 20 de 189 pedidos), sin controles para ver el resto; solo se llega a ellos buscando. Causa: `orders-manager.tsx` llama `/admin/orders` sin `page`. |
| D-04 | Capacidad del backend bajo carga | BE-227, BE-228 | Cada petición sola tarda 35–340 ms, pero el proceso atiende unas 10–13 peticiones por segundo. Con 50 conexiones, el p95 del catálogo es de unos 11 s; con 20 conexiones, el de búsqueda y ofertas es de 12–14 s. La memoria sube de 364 a 955 MB y no baja (H-14). Cada vista del inicio hace 7 llamadas a la API. Hay que repetir la medición en Railway antes de lanzar. |

### Media

| ID | Defecto | Casos | Detalle |
|---|---|---|---|
| D-05 | Quitar una tarifa de envío muestra error aunque se borró | FE-099 | El backend responde 200 sin cuerpo y el panel muestra "No se pudo eliminar la tarifa."; la tarifa sigue en la lista hasta recargar. Causa: falta `@HttpCode(204)` en `store-settings.controller.ts:49`. |
| D-06 | Dos "existencias iniciales" simultáneas se registran ambas | BE-096 | En 5 de 5 intentos quedaron dos movimientos `INITIAL` (H-06). |
| D-07 | Respuestas 500 ante entradas inválidas | BE-009, BE-053, BE-077, BE-081, BE-097, BE-145, FE-026 | Casos que devuelven 500: JSON demasiado grande (en vez de 413), id "abc" al borrar una tarifa, archivo que no es imagen, PNG "bomba", cantidad de inventario fuera de rango, filtro de estado inexistente y `?categoria=abc` en el catálogo. En el catálogo la página dice "problema al conectar con la tienda", que es engañoso. |
| D-08 | Accesibilidad | FE-118, FE-117, FE-120 | axe encontró contraste insuficiente en el inicio (1 nodo) y en el panel (14 y 7), y desplegables sin nombre accesible ("Todos los estados" y "Todos los pagos" en pedidos y productos). Hay controles táctiles menores de 44×44 px en celular: buscador de 24 px de alto, corazón y pausa de 40×40, casillas de 16×16. El botón "Eliminar" de la bolsa no dice qué producto quita. |
| D-09 | Las pruebas de integración no exigen una base `*_test` | BE-218 | `test/setup-env.ts` solo rechaza que `TEST_DATABASE_URL` sea idéntica a `DATABASE_URL`. Con otra URL, la suite borra esa base. |

### Baja

| ID | Defecto | Casos |
|---|---|---|
| D-10 | Una entrada corrupta de tipo texto (`"x"`) en los favoritos guardados rompe toda la página de favoritos ("No pudimos cargar tus favoritos.") | FE-044, FE-133 |
| D-11 | Con la sesión vencida, guardar en el panel muestra "No se pudo cambiar la contraseña. Intenta de nuevo." sin explicar que hay que volver a iniciar sesión ni redirigir | FE-094 |
| D-12 | Departamentos (y posiblemente municipios) ordenados por bytes: "Córdoba" queda después de "Cundinamarca" | BE-061 |
| D-13 | Mensajes de validación en inglés ("password must be shorter…", "property role should not exist") | BE-022 |
| D-14 | `%` funciona como comodín en las búsquedas del panel | BE-220 |
| D-15 | Cuerpos con `__proto__` o `constructor` se aceptan en silencio (200) en lugar de rechazarse; no se observó contaminación | BE-221 |
| D-16 | Sin número de WhatsApp, el título dice "Envía tu pedido por WhatsApp para continuar" y no ofrece otra forma de contacto | FE-071 |
| D-17 | El aviso de cancelación no trae la fecha de la cancelación (el seguimiento muestra solo la fecha del pedido) | FE-077 |
| D-18 | El aviso "antes" del seguimiento termina en "a. m.." (doble punto) | Corrida E2E |
| D-19 | El checkout con la bolsa vacía tiene CLS 0,16 (meta propuesta < 0,1) | FE-123 |
| D-20 | En celular, el bloque del título de la tarjeta mide 44 px, pero el enlace solo ocupa la primera línea (21 px): tocar debajo del texto no abre el producto | Revisión de la falla de `catalog.spec.ts` |
| D-21 | No se informa el máximo por pedido junto al selector de cantidad | FE-032 |
| D-22 | Con movimiento reducido quedan 26 transiciones de más de 300 ms en el inicio | FE-125 |
| D-23 | La página de error del panel dice "problema al cargar la tienda" | FE-116 |

## 4. Decisiones y preguntas pendientes

1. **Conflicto entre código y `Context/` (FE-005, FE-082).** [`plan-desarrollo.md:398`](../../Context/plan-desarrollo.md) dice que una página legal sin texto "no existe (404) ni aparece en el pie". El commit `5a9bb43` hizo que el pie enlace siempre las cuatro páginas y que, sin texto, respondan 200 con "Esta información estará disponible pronto.". ¿Cuál es la correcta?
2. **Caracterizaciones a resolver con las preguntas del plan maestro:**
   - El bloqueo de cuenta revela si el correo existe (BE-019, Q-10).
   - Renombrar un producto cambia el slug y rompe enlaces compartidos (BE-069, Q-07).
   - Se puede reactivar un producto archivado (BE-070, Q-08).
   - Se puede activar un producto sin variantes (BE-071, FE-037, Q-18).
   - Productos de categoría inactiva visibles en listado y detalle (BE-087, Q-09).
   - Ventana entre desactivar un producto y crear un pedido (BE-136, H-20).
   - Comprobante aceptado antes de confirmar (BE-165, Q-06).
   - Montos verificados distintos del total y devoluciones parciales (BE-170, BE-172, Q-04).
   - Un pedido en preparación sin comprobante se cancela a las 24 h (BE-198, Q-19).
   - El token de seguimiento queda en el log de acceso (BE-225, Q-17).
   - Bolsa sin sincronizar entre pestañas (FE-054, Q-11).
   - Al llegar a 100 favoritos se bloquea y avisa, no reemplaza el más antiguo (FE-041).
3. **Paleta oficial (FE-121).** Varias combinaciones no llegan a 4,5:1 para texto normal: `#B785B8` sobre blanco da 2,97:1 y `#A46EA4` sobre blanco 3,93:1. Conviene definir qué tonos se usan para texto.
4. **Metas de rendimiento (Q-15).** Las mediciones usan las metas propuestas, que nadie ha confirmado.
5. **Observación de configuración (BE-001).** Un plazo vacío (`ORDER_PENDING_TTL_HOURS=`) se convierte en 0, es decir, desactivado, sin ningún error al arrancar.
6. **Correcciones al plan.** BE-076: el corte al recibir el archivo es de 10 MB, y los 5 MB se validan después con 400. BE-214: hay 18 migraciones, no 19. FE-012: el carrusel usa puntos y botón de pausa, no anterior/siguiente.

## 5. Bloqueados

- **FE-061 y E2E-018:** la mecánica funciona con textos ficticios (casillas independientes, enlaces a `/terminos` y `/datos-personales`, pie y páginas). Faltan los textos legales aprobados (H-19).
- **Pendientes fuera de esta ejecución (validación previa a producción, PLAN_MAESTRO_QA §E.2):** necesitan el entorno de Railway, el dominio, los datos reales y la estrategia de copias de seguridad.

## 6. Cambios hechos en el repositorio durante la ejecución

- `frontend/eslint.config.mjs`: se excluye `.next-video/**`. El lint del frontend fallaba con 305 errores, todos en la compilación del video; ahora da 0 errores y 6 advertencias.
- `frontend/e2e/`: selectores actualizados tras el rediseño de la tienda (`697ed9e`).
  - `catalog.spec.ts`: el buscador es un `searchbox`, el panel "Filtros" se abre en celular y se toca el enlace del producto en vez del bloque del título.
  - `checkout.spec.ts`: mensaje por casilla.
  - `notices.spec.ts`: el aviso es `role="status"`.
  - `shipping.spec.ts`: el enlace se llama "Rastrear en la transportadora".

  La primera corrida dio 30/38; las 8 fallas eran pruebas desactualizadas, no defectos. Con los selectores actualizados, la suite completa da **38/38** (celular y escritorio).
- No se modificó código de la aplicación ni archivos de `Context/`.

## 7. Resultado por caso


### Smoke

| ID | Estado | Evidencia |
|---|---|---|
| SMK-01 | Aprobado | GET /api/v1/health → 200 {"status":"ok","database":"ok"} |
| SMK-02 | Aprobado | GET / → 200; encabezado y pie en el HTML |
| SMK-03 | Aprobado | GET /productos → 200; tarjetas de producto en el HTML |
| SMK-04 | Aprobado | GET /producto/labial-qa-9vu6hx → 200; con precio |
| SMK-05 | Aprobado | POST /api/v1/store/orders/quote por el dominio de la tienda → 201 (agregar a la bolsa: FE-001/FE-038) |
| SMK-06 | Aprobado | departamentos 200 (33) y municipios del 44 200 |
| SMK-07 | Aprobado | GET /admin sin sesión → 307 a /admin/login |
| SMK-08 | Aprobado | login de la propietaria por el dominio de la tienda → 200; bandeja de pedidos → 200 (197 pedidos) |
| SMK-09 | Aprobado | GET http://localhost:3200/uploads/<foto> → 200 image/webp |
| SMK-10 | Aprobado | tienda: XFO=DENY, nosniff=nosniff, CSP=true; API: nosniff=nosniff |
| SMK-11 | Aprobado | Swagger con NODE_ENV=production → 404 |
| SMK-12 | Aprobado | robots.txt 200; sitemap.xml 200 |

### Backend

| ID | Estado | Evidencia |
|---|---|---|
| BE-001 | Aprobado | arranque fuera de backend/ (sin .env): salida=1; variables no nombradas: ninguna. Observación: un plazo vacío ("") se convierte en 0 (desactivado) sin error |
| BE-002 | Aprobado | producción sin clave: salida=1, nombra la variable=true; desarrollo sin clave arranca=true |
| BE-003 | Aprobado | 200 {"status":"ok","database":"ok"} |
| BE-004 | Aprobado | 404; faltan: ninguno; {"statusCode":404,"error":"NOT_FOUND","message":"Cannot GET /api/v1/no-existe","path":"/api/v1/no-existe","timestamp":"2026-10-15T15:12:35.651Z"} |
| BE-005 | Aprobado | nosniff=nosniff xfo=SAMEORIGIN x-powered-by=null csp=true |
| BE-006 | Aprobado | producción /docs=404; desarrollo /docs=200 |
| BE-007 | Aprobado | permitido: ACAO=http://localhost:3200 cred=true; atacante: ACAO=null (204) |
| BE-008 | Aprobado | 400 {"statusCode":400,"error":"BAD_REQUEST","message":["items.0.property unitPrice should not exist"],"path":"/api/v1/store/orders/quote","timestamp":"2026-10-15T15:12:38.952Z"} |
| BE-009 | Fallido | duplicado=409 "Ya existe una marca con ese nombre o slug."; inexistente=404 "Marca con id '00000000-0000-4000-8000-000000000000' no encontrada."; grande=500 "Error interno del servidor.". El 500 genérico (Error no controlado) no se puede provocar desde la API: requiere la prueba unitaria nueva |
| BE-010 | Aprobado | secretos en el log: 0; línea registra [Redacted]=true |
| BE-011 | Aprobado | 1–120 todas 200=true; petición 121=429; primer 429 en la n.º 121 |
| BE-012 | Aprobado | IP distintas=404,404,404,404,404,404; misma IP=404,404,404,404,404,429; hops=0 con IP distintas=404,404,404,404,404,429 |
| BE-013 | Aprobado | tras agotar el límite: clave correcta=404, incorrecta=429, otra longitud=429, ausente=429; sin clave configurada (6 intentos con cabecera)=404,404,404,404,404,429 |
| BE-014 | Aprobado | 200=true; cookie desarrollo="sb_admin_session=…; Path=/; Expires=Thu, 15 Oct 2026 23:16:08 GMT; HttpOnly; SameSite=Lax"; producción Secure=true; sin hash=true; sesiones 3→4; lastLoginAt actualizado=true |
| BE-015 | Aprobado | inexistente=401 "Correo o contraseña incorrectos."; contraseña errada=401 "Correo o contraseña incorrectos." |
| BE-016 | Aprobado | mediana existente=121 ms, inexistente=113 ms, diferencia=7 % (20 intentos c/u) |
| BE-017 | Aprobado | 401 "Correo o contraseña incorrectos."; sesiones 1→1 |
| BE-018 | Aprobado | intentos errados=401,401,401,401,401; 6.º con la correcta=429 "Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en 15 minuto(s)."; lockedUntil=2026-10-15T15:31:15.459Z |
| BE-019 | Caracterización | correo existente: 401,401,401,401,401,429 (mensaje final "Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en 15 minuto(s)."); correo inexistente: 401,401,401,401,401,401. El bloqueo revela que el correo existe (H-07, decisión en Q-10) |
| BE-020 | Aprobado | 200; failedLoginAttempts=0; lockedUntil=null |
| BE-021 | Aprobado | respuestas: 401,401,401,401,401,401,401,401,401,401,429 |
| BE-022 | Parcial | correo inválido: 400 "Ingresa un correo válido."; contraseña vacía: 400 "Ingresa la contraseña."; contraseña de 201: 400 "password must be shorter than or equal to 200 characters" [en inglés]; campo extra: 400 "property role should not exist" [en inglés] |
| BE-023 | Aprobado | 401 "Debes iniciar sesión." |
| BE-024 | Aprobado | firma alterada / otra clave / vencido = 401, 401, 401; control válido=200 |
| BE-025 | Aprobado | logout=204; reutilizar cookie=401; revokedAt=2026-10-15T15:16:21.104Z |
| BE-026 | Aprobado | sesión con expiresAt vencido → 401 |
| BE-027 | Aprobado | antes=200; tras desactivar en BD=401 |
| BE-028 | Aprobado | actual errada=400 "La contraseña actual no es correcta."; nueva corta=400; correcta=204; otra sesión=401; sesión actual=200 |
| BE-029 | Aprobado | [automatizada] purgeExpired no tiene ruta en la API (corre a diario); lo cubre test/auth.e2e-spec.ts, aprobada el 15-oct (170/170) |
| BE-030 | Aprobado | propietaria=ok; contador=0; lockedUntil=null; sesión anterior=401; nuevo login=200; con cuenta STAFF → error: No existe una cuenta de propietaria (ADMIN) con ese correo.; contraseña corta → error: La contraseña debe tener al menos 12 caracteres. |
| BE-031 | Aprobado | 200 |
| BE-032 | Aprobado | 73 rutas /admin sin sesión; distintas de 401: ninguna |
| BE-033 | Aprobado | 24 rutas; distintas de 403: ninguna; mensaje "No tienes permiso para realizar esta acción."; BD sin cambios=true |
| BE-034 | Aprobado | 23 acciones; fallidas: ninguna |
| BE-035 | Aprobado | fugas para el personal: ninguna; la propietaria sí ve unitCost=true |
| BE-036 | Aprobado | crear=201 costPrice en BD=null; editar=200 costPrice en BD=8000.00 (original 8000) |
| BE-037 | Aprobado | sin confirmar=403; rechazado hace 2 h=403; rechazado hace 9 h=200 |
| BE-038 | Aprobado | 11 respuestas públicas; campos internos: ninguno |
| BE-039 | Aprobado | stock en BD=3; detalle variants[].stock=3; el listado trae variantes=true |
| BE-040 | Aprobado | 400 "property role should not exist"; cuentas creadas=0 |
| BE-041 | Aprobado | repetido=409 "Ya existe una cuenta con ese correo."; 11 caracteres=400 "La contraseña debe tener al menos 12 caracteres." |
| BE-042 | Aprobado | desactivar=200; sesión del personal=401 |
| BE-043 | Aprobado | 204; lockedUntil=null; sesiones abiertas=0; sesión anterior=401; login con la nueva=200 |
| BE-044 | Aprobado | PATCH=404 "No existe una cuenta del personal con ese identificador."; reset=404 "No existe una cuenta del personal con ese identificador." |
| BE-045 | Aprobado | 200; campos sensibles: ninguno |
| BE-046 | Aprobado | 400 "Validation failed (uuid is expected)" |
| BE-047 | Aprobado | leer=200; modificar=403 |
| BE-048 | Aprobado | "3001234567"→200/573001234567; "+57 300 123 4567"→200/573001234567; "573001234567"→200/573001234567; "1234"→400 |
| BE-049 | Aprobado | límite 30=400 (nombra 40 %=true, 60 % vencida=false, 70 % inactiva=false); límite 50 sin la de 40 activa=200; quitar límite=200; promociones intactas=true |
| BE-050 | Aprobado | inválidos≠400: ninguno; válidos≠200: ninguno |
| BE-051 | Aprobado | campos fuera de PublicStoreInfoDto: ninguno; publishedPages=[] (páginas con texto=0) |
| BE-052 | Aprobado | crear=201; repetir=201; filas=1 monto=9500.00; 99999=400 |
| BE-053 | Fallido | UUID inexistente=404; "abc"=500 "Error interno del servidor." |
| BE-054 | Aprobado | Riohacha (44001) = 5000.00 |
| BE-055 | Aprobado | vacío=404; con texto=200 {slug,text,title}; __proto__/constructor/no-existe=404/404/404 |
| BE-056 | Aprobado | texto devuelto="<script>alert(1)</script>" (literal=true); la presentación en la tienda se verifica en FE-082 |
| BE-057 | Aprobado | activar sin instrucciones=400; con instrucciones=200; borrarlas activo=400 "Para activar Nequi escribe primero sus instrucciones de pago." |
| BE-058 | Aprobado | COD sin instrucciones=200; COD máximo=200; Nequi máximo=400 "Nequi no admite un total máximo de pedido." |
| BE-059 | Aprobado | lista válida=200; reemplazo=200 (filas tras reemplazo=1); con 99999=400; método no restringido=400 "Transferencia bancaria no se restringe por municipio." |
| BE-060 | Aprobado | métodos ofrecidos en 44001: BANK_TRANSFER |
| BE-061 | Fallido | departamentos=33 ordenados=false; 44001=Riohacha; "00"=404 |
| BE-062 | Aprobado | municipios=1122; ejemplos encontrados: San José del Guaviare | Valle del Cauca | Bogotá, D.C. | Bogotá, D.C. |
| BE-063 | Aprobado | creado=DRAFT; tienda antes=404; tras activar=200; publishedAt=2026-10-15T15:22:10.808Z y tras reactivar=2026-10-15T15:22:10.808Z |
| BE-064 | Aprobado | {"DRAFT":"oculto/404","INACTIVE":"oculto/404","ARCHIVED":"oculto/404","ACTIVE":"listado/200"} |
| BE-065 | Aprobado | tercer nivel=400 "No se permite más de dos niveles de categorías (categoría > subcategoría)."; producto en categoría con hijos=400 "No se puede asignar un producto a una categoría que tiene subcategorías. Elige una subcategoría o una categoría sin subcategorías."; padre de sí misma=400 "property parentId should not exist" (el PATCH no admite parentId) |
| BE-066 | Aprobado | cat con hijos=409 "No se puede eliminar la categoría porque tiene subcategorías."; cat con productos=409; marca en uso=409 "No se puede eliminar la marca porque tiene productos asociados."; libres=204/204 |
| BE-067 | Aprobado | marca nombre=409; marca slug=409; producto slug=409 "Ya existe un producto con ese slug." |
| BE-068 | Fallido | {"sin marca":400,"sin categoría":400,"basePrice -1":400,"basePrice 0":201,"descripción vacía":400,"nombre 201":400} — precio base 0 aceptado: H-02, falta el cambio de código de Q-02 |
| BE-069 | Caracterización | slug anterior "producto-qa-quvqv9" → 404; slug nuevo "renombrado-qa-cmt9x5" → 200. Renombrar cambia el slug y rompe enlaces compartidos (H-11, Q-07) |
| BE-070 | Caracterización | ARCHIVED→ACTIVE=200; estado=ACTIVE; archivedAt antes=2026-10-15T15:22:14.349Z después=2026-10-15T15:22:14.349Z (H-12, Q-08) |
| BE-071 | Caracterización | activar sin variantes=200; tienda=200 variants=[] precio=15000 (H-12, Q-18) |
| BE-072 | Aprobado | con pedido=409; con movimientos=409; limpio=204; variantes restantes=0; carpeta de fotos (tenía 2 archivos) existe=false |
| BE-073 | Fallido | {"SKU repetido":409,"colorHex #GGG000":400,"price -1":400,"price 0":201,"maxPerOrder 0":400} — precio propio 0 aceptado: H-02, falta el cambio de Q-02 |
| BE-074 | Aprobado | {"con pedido":409,"con movimiento":409,"limpia":204,"de otro producto":404} |
| BE-075 | Aprobado | filas [sin precio propio, con precio]: crear=1,1; cambiar base=2,1; cambiar precio B=2,2; quitar precio B=2,3; editar sin cambio de precio=2,3 |
| BE-076 | Aprobado | 6 MB=400 "La imagen no puede superar 5 MB."; 11 MB (corte al recibir, tope 10 MB)=413 "El archivo supera el tamaño máximo permitido.". El plan esperaba 413 con 6 MB: el corte al recibir es de 10 MB y los 5 MB se validan después con 400 |
| BE-077 | Fallido | texto como PNG=500 "Error interno del servidor."; GIF=400 "Solo se aceptan imágenes JPG, PNG o WebP." |
| BE-078 | Aprobado | 404 "Variante con id '08177b87-fcf7-4273-b609-0d4708927e09' no encontrada."; archivos en disco 0→0 |
| BE-079 | Aprobado | 201; principal webp 1600×1067; miniatura webp 420×420; ruta products/f135f9ac-acff-4295-b0ef-99ec05fdcb8b/a5dc9c35-9640-42ad-8f64-011268a50e08.webp; URL pública /uploads/products/f135f9ac-acff-4295-b0ef-99ec05fdcb8b/a5dc9c35-9640-42ad-8f64-011268a50e08.webp → 200 |
| BE-080 | Aprobado | de otro producto=404; borrar=204; registro=0; archivos eliminados=true |
| BE-081 | Fallido | PNG de 48 KB declarando 20000×20000 → 500 "Error interno del servidor." en 48 ms; salud después=200 |
| BE-082 | Aprobado | {"categoría padre":true,"marca":true,"q=sombra":true,"q=SÓMBRA":true} |
| BE-083 | Aprobado | página 2=5 ítems total=25; limit=101→400; page=0→400; limit=abc→400 |
| BE-084 | Aprobado | 3 ids (uno inactivo)→2 activos; 101 ids→400; id no UUID→400 |
| BE-085 | Aprobado | con categoría=30% > fijo 25% > 10%; sin categoría (estos 4)=3 y mismo orden=true |
| BE-086 | Aprobado | destacado activo=true; destacado inactivo=false; no destacado=false |
| BE-087 | Caracterización | categoría inactiva en el árbol=false; producto en listado=true; detalle=200 (H-13, Q-09) |
| BE-088 | Aprobado | q de 10.000=200; inyección=200 (0 resultados) |
| BE-089 | Aprobado | {"padre con productos en subcategoría":true,"categoría vacía":false,"marca con productos":true,"marca sin productos":false} |
| BE-090 | Aprobado | crear=201; editar=200; eliminar producto/marca/categoría=403/403/403 |
| BE-091 | Aprobado | INITIAL 10=201 stock=10; INITIAL 5=409 "Las existencias iniciales solo se pueden registrar antes de cualquier otro movimiento." |
| BE-092 | Aprobado | PURCHASE 0/-1, ADJUSTMENT sin y con motivo = 400, 400, 400, 201; stock=8 |
| BE-093 | Aprobado | 400 "El movimiento no puede dejar existencias negativas."; stock=3 |
| BE-094 | Aprobado | 400, 400, 400 |
| BE-095 | Aprobado | aplicados=5; rechazados=400,400,400,400,400; stock=0; historial encadenado=true |
| BE-096 | Fallido | 5 intentos en paralelo: 201/201→2 INITIAL, stock 10; 201/201→2 INITIAL, stock 10; 201/201→2 INITIAL, stock 10; 201/201→2 INITIAL, stock 10; 201/201→2 INITIAL, stock 10 |
| BE-097 | Fallido | 500 "Error interno del servidor." |
| BE-098 | Aprobado | 82 variantes; sin cuadre con la suma=0; eslabones rotos=0 (orden por fecha e id) |
| BE-099 | Aprobado | {"stock 5 umbral 5":true,"stock 6 umbral 5":false,"sin umbral stock 0":false} |
| BE-100 | Aprobado | página 2=10 de 40; limit=101→400 |
| BE-101 | Aprobado | listar/crear/editar como personal = 403/403/403 |
| BE-102 | Fallido | 31 % con límite 30=400 "El descuento porcentual no puede superar 30%."; 99 % sin límite=201; 100 % sin límite=201 — se acepta el 100 % (H-02, falta el cambio de Q-02) |
| BE-103 | Aprobado | {"inicio ≥ fin":400,"VARIANT sin variantIds":400,"ids inexistentes":400,"valor 0":400} |
| BE-104 | Aprobado | ediciones en paralelo=200/409 (La promoción cambió mientras la editabas. Vuelve a cargarla e inténtalo de nuevo.); revisiones=2, versiones distintas=2 |
| BE-105 | Aprobado | {"mayor descuento":4000,"empate→primera":true,"subcategoría hereda":1000,"desactivada ignorada":1000}; la vigencia inclusiva en los instantes exactos la cubre pricing.service.spec.ts (aprobada) |
| BE-106 | Fallido | fija 25.000=201; fija 20.000=201; tienda precio final=0; cotización unitFinalPrice=0; pedido=201 con total de productos 0 — se vende a 0 COP (H-02/Q-02; mecanismo en Q-22) |
| BE-107 | Fallido | crear 100 %=201; editar a 100 %=200 (H-02/Q-02) |
| BE-108 | Fallido | 9.999 al 33,33 %: descuento 3333, final 6666, línea 19998; pedido total 24998 = 29997 − 9999 + 5000; 1 COP al 50 %: final 0 (precio 0 por redondeo, Q-02) |
| BE-109 | Aprobado | editar=200; X: lista 20000 (precio a la fecha 20.000, hoy 25.000), descuento 0 (promo creada después); Y: descuento 3000 (promo vigente al crear, desactivada después) |
| BE-110 | Caracterización | producto movido a la categoría B después del pedido: al agregarlo se aplicó la promoción de B=true (descuento 4000). Limitación aceptada en decisiones.md |
| BE-111 | Fallido | promoción=201; 50.000 → descuento 15000; 10.000 → final 0 (precio 0: H-02/Q-02, mecanismo en Q-22) |
| BE-112 | Parcial | El motor compara instantes y la vigencia inclusiva la cubre pricing.service.spec.ts ("aplica desde el instante de inicio hasta el instante de fin, incluidos", aprobada). No se puede mover el reloj del servidor para probar 23:59:59 → 00:00:00 de Colombia por la API; la conversión del día a −05:00 se verifica en el formulario del panel (FE) |
| BE-113 | Aprobado | total=26/26; activas=14/14; categoría=3/3; filtros coherentes=true |
| BE-114 | Aprobado | 201; línea: 40000 − 10000 = 30000 × 2 = 60000; subtotal 112000 − 20000 + envío 5000 = 97000; BD sin cambios=true |
| BE-115 | Aprobado | 201; sin stock=INSUFFICIENT_STOCK; sobre el máximo=OVER_MAX_PER_ORDER; inactiva en unavailable=true; canCheckout=false |
| BE-116 | Aprobado | líneas=1; cantidad=4; issue=INSUFFICIENT_STOCK |
| BE-117 | Aprobado | maxPerOrder=2; issue=OVER_MAX_PER_ORDER |
| BE-118 | Aprobado | sin máximo=7; con máximo 3=3 |
| BE-119 | Aprobado | distintos de 400: ninguno |
| BE-120 | Aprobado | {"nacional":0,"umbral alcanzado":0,"tarifa 44001":5000,"sin tarifa":"null/\"Envío por confirmar\""} |
| BE-121 | Aprobado | neto 99.000 → envío 5000; neto 100.000 → envío 0 |
| BE-122 | Aprobado | 44001 → 5000 |
| BE-123 | Aprobado | 44001 total 200000 (195.000 + envío 5.000) → COD=true; total 200001 → COD=false; 05001 → COD=false |
| BE-124 | Aprobado | 201 SB-261015-731F72; verificaciones fallidas: ninguna |
| BE-125 | Aprobado | pedido conserva: "Producto QA 0mue76", "Variante QA 0mue76", QA-0mue76, 20000 (el SKU no es editable por la API) |
| BE-126 | Aprobado | términos=false / datos=false / ausentes = 400/400/400; pedidos nuevos=0 |
| BE-127 | Aprobado | sin stock/método inactivo/municipio 99999 = 400/400/400; BD antes {"o":15,"c":2,"m":142} después {"o":15,"c":2,"m":142} |
| BE-128 | Aprobado | respuestas=201/400; reservas=1 |
| BE-129 | Aprobado | 201=5; 400=15; otros=ninguno; stock=0 |
| BE-130 | Aprobado | 201/201; mismo id=true; reservas=1 |
| BE-131 | Aprobado | respuestas=201/201/201/201/201; pedidos=1; códigos distintos=1 |
| BE-132 | Aprobado | 409 "La clave de idempotencia ya fue usada con otro pedido." |
| BE-133 | Aprobado | clientes=1 (573008951458); "12345"=400 |
| BE-134 | Aprobado | distintos de 400: ninguno |
| BE-135 | Aprobado | inactivo=400 "El método de pago no está disponible para este pedido."; inexistente=400 "El método de pago no está disponible para este pedido." |
| BE-136 | Caracterización | 8 carreras pedido/desactivación: pedidos creados de productos que terminaron inactivos=8. Es la ventana de H-20 (si el pedido llegó primero es correcto; no se puede distinguir sin marcas de tiempo finas) |
| BE-137 | Aprobado | faltan en el mensaje: nada; whatsappUrl correcto y decodifica al mensaje=true |
| BE-138 | Aprobado | 201; whatsappUrl=null; "Envío por confirmar"=true; "Total sin envío"=true |
| BE-139 | Aprobado | 201,201,201,201,201,201,201,201,201,201,429 |
| BE-140 | Aprobado | 201; guardado literal=true; whatsappUrl decodifica con nombre y saltos=true |
| BE-141 | Aprobado | total/subtotal/unitPrice = 400/400/400 |
| BE-142 | Aprobado | 47 pedidos; total descuadrado=0; líneas ≠ subtotal − descuento=0 |
| BE-143 | Fallido | ítems con precio final ≤ 0=1; pedidos con productos ≤ 0=1 (H-02/Q-02) |
| BE-144 | Aprobado | por teléfono=3; por código=1; PENDING_CONFIRMATION=44/44; PAID coherente; página 2=20 de 51/51; orden descendente=true |
| BE-145 | Fallido | status inválido=500 "Error interno del servidor."; paymentStatus inválido=500 |
| BE-146 | Aprobado | faltan: nada; unitCost propietaria=10000 personal=null; eventos=5; pagos=1; inexistente=404 |
| BE-147 | Aprobado | sin costo=400 "Registra el costo de envío cotizado antes de confirmar."; con 8.000=200; estado=CONFIRMED; total=40000.00; evento=1 |
| BE-148 | Aprobado | confirmaciones simultáneas=200/409; confirmar cancelado=400 "Solo se pueden confirmar pedidos pendientes." |
| BE-149 | Aprobado | {"CONFIRMED":"200/total 44000.00/evento true","PREPARING":"200/total 44000.00/evento true","SHIPPED":"200/total 44000.00/evento true","DELIVERED":400,"CANCELLED":400}. Con el pago ya verificado el pedido sigue PAID aunque el total suba (Q-21 pendiente) |
| BE-150 | Aprobado | CONFIRMED→PREPARING=200; SHIPPED: 400 "El despacho y la entrega se registran en la sección de envío del pedido."; DELIVERED: 400 "El despacho y la entrega se registran en la sección de envío del pedido."; CONFIRMED: 400 "Usa la acción de confirmar pedido."; CANCELLED: 400 "Usa la acción de cancelar para liberar las existencias."; pendiente→PREPARING=400 |
| BE-151 | Aprobado | 200; X conserva 20.000=20000; Y quitada=true; Z con promo del día del pedido=900; stock X/Y/Z=7/10/9; movimientos=ORDER_RESERVED-1,ORDER_RESERVED-2,ORDER_RESERVED-2,ORDER_RELEASED2,ORDER_RESERVED-1; evento ITEMS_CHANGED=1 |
| BE-152 | Aprobado | agregar inactiva=400 "Uno o más productos agregados no están disponibles."; editar el resto=200; línea sin variante conservada=true |
| BE-153 | Aprobado | {"sin tarifa conserva manual":9000,"con tarifa":5000,"gratis→no gratis sin tarifa":"0.00→null"}; evento de envío al cambiar=1 |
| BE-154 | Aprobado | editar confirmado=400; items vacío=400 |
| BE-155 | Aprobado | respuestas=200/409 (El pedido cambió mientras se procesaba. Vuelve a cargarlo e inténtalo de nuevo.); cantidad=2; stock=8 |
| BE-156 | Aprobado | motivo " a "=400; válido=200; estado=CANCELLED; motivo guardado="La clienta desistió (QA)"; ORDER_RELEASED=1; avisos "antes" abiertos=0 |
| BE-157 | Aprobado | despachado/entregado/cancelado = 400/400/400 |
| BE-158 | Fallido | cancelar sin devolución=200; estado final CANCELLED/PAID — queda CANCELLED con PAID (H-10, falta el cambio de código de Q-05) |
| BE-159 | Aprobado | 200/409/409→CONFIRMED, liberaciones 0, stock 3; 200/409/409→CONFIRMED, liberaciones 0, stock 3; 200/409/409→CONFIRMED, liberaciones 0, stock 3; 200/409/409→CONFIRMED, liberaciones 0, stock 3 |
| BE-160 | Aprobado | 8 eventos (ORDER_STATUS,SHIPPING,PAYMENT_STATUS); sin autor aparte de la creación desde la tienda=0 |
| BE-161 | Aprobado | comprobante=200 AWAITING_VERIFICATION, registros=1; verificar personal=403; propietaria=200 PAID paidAt=true |
| BE-162 | Aprobado | comprobante/verificar/rechazar en contra entrega = 400/400/400 |
| BE-163 | Aprobado | 400 "No se puede registrar pago en un pedido cancelado." |
| BE-164 | Aprobado | PAID=400 "Este pedido ya no admite registro de comprobante."; REFUNDED=400 |
| BE-165 | Caracterización | comprobante en PENDING_CONFIRMATION → 200 AWAITING_VERIFICATION (Q-06) |
| BE-166 | Aprobado | sin motivo=400; con motivo=200 REJECTED; personal a 7 h 59 min=403; a 8 h=200 |
| BE-167 | Aprobado | 200; AWAITING_VERIFICATION; paymentRejectedAt=null; avisos de pago no demostrado=DISCARDED |
| BE-168 | Aprobado | verificar/rechazar=200/409; final=PAID |
| BE-169 | Aprobado | PENDING/REJECTED = 400/400 |
| BE-170 | Caracterización | total 40000: verificar con 30000=200 PAID; con el total=200; con 41000 sin nota=200 PAID. Hoy acepta cualquier monto (H-09); la recomendación de Q-04 está por confirmar |
| BE-171 | Aprobado | 40001=400; 40000=200; repetir=400; dos en paralelo=200/409 con 1 devolución registrada |
| BE-172 | Caracterización | devolver 10.000 de 40000.00 → 200, estado de pago REFUNDED. Hoy la devolución parcial deja REFUNDED (H-09); recomendación de Q-04 por confirmar |
| BE-173 | Aprobado | 400 "Solo se puede registrar una devolución sobre un pago verificado." |
| BE-174 | Aprobado | plazo 0: staffCanCancel=false; el personal intenta cancelar un rechazo de hace 100 h=403 |
| BE-175 | Aprobado | crear=201; repetido=409; sin {tracking}=400; javascript:=400 |
| BE-176 | Aprobado | sin guía=400 "Para despachar registra transportadora y número de guía."; con guía=200; pedido=SHIPPED; dispatchedAt=true |
| BE-177 | Aprobado | local con transportadora y guía=200 (guardó carrier=null, guía=null); entregar=200; pedido=DELIVERED |
| BE-178 | Aprobado | 16 transiciones; distintas de lo esperado: ninguna |
| BE-179 | Aprobado | despachar sin confirmar=400; cancelado=400; entrega anterior al despacho=400 "La fecha de entrega no puede ser anterior a la de despacho." |
| BE-180 | Aprobado | pedido nuevo con inactiva=400; corregir envío que ya la usa=200 |
| BE-181 | Aprobado | entregar=200, repetir=200; pago=PAID; registros PAID=1 por 37000.00 (total 37000.00) |
| BE-182 | Aprobado | 409/200→CANCELLED, envío ninguno, stock 5; 409/200→CANCELLED, envío ninguno, stock 5; 409/200→CANCELLED, envío ninguno, stock 5; 409/200→CANCELLED, envío ninguno, stock 5 |
| BE-183 | Aprobado | trackingUrl=https://t.ejemplo.test/?g=AB%2012%2F%26%3F%23 |
| BE-184 | Aprobado | 200; datos del cliente/internos presentes: ninguno; faltan: nada |
| BE-185 | Aprobado | 404:No existe ese enlace de seguimiento. | 404:No existe ese enlace de seguimiento. | 404:No existe ese enlace de seguimiento. |
| BE-186 | Aprobado | token 48 hex=true; estable=true; distinto con otro secreto=true |
| BE-187 | Aprobado | 200; trackingPath coincide=true |
| BE-188 | Aprobado | 404:No encontramos un pedido con esos datos. | 404:No encontramos un pedido con esos datos. | 404:No encontramos un pedido con esos datos. |
| BE-189 | Aprobado | 404,404,404,404,404,429 |
| BE-190 | Aprobado | antes: stage=BEFORE, fecha=2026-10-15T16:34:40.703Z, sin saludo ni nombre=true ("…"); después: stage=AFTER |
| BE-191 | Aprobado | 47 h: estado PENDING_CONFIRMATION, avisos UNCONFIRMED/BEFORE, notificaciones NOTICE_PENDING; 48 h: CANCELLED "Cancelación automática: el pedido siguió sin confirmar 48 horas después de creado.", stock 5, aviso antes=EXPIRED, aviso después=PENDING, notificaciones NOTICE_PENDING,NOTICE_PENDING,ORDER_AUTO_CANCELLED |
| BE-192 | Aprobado | aviso=DISCARDED; estado=CONFIRMED |
| BE-193 | Aprobado | sin comprobante/con comprobante/contra entrega = CANCELLED/CONFIRMED/CONFIRMED |
| BE-194 | Aprobado | 7 h: PAYMENT_NOT_PROVEN/BEFORE; 9 h: estado CONFIRMED; tras cancelar a mano: BEFORE/DISCARDED,AFTER/PENDING |
| BE-195 | Aprobado | salidas: [Avisos creados: 0. Pedidos cancelados: 5. Avisos cerrados: 0.] [Otra instancia está procesando los plazos en este momento.]; cancelados=5/5; avisos duplicados=0; liberaciones dobles=0 |
| BE-196 | Aprobado | 48 h − 10 s: PENDING_CONFIRMATION; 48 h + 1 s: CANCELLED. La precisión de milisegundo la cubre test/notices.e2e-spec.ts (hora controlada, aprobada) |
| BE-197 | Aprobado | ciclo con plazos en 0: "Avisos creados: 0. Pedidos cancelados: 0. Avisos cerrados: 0."; estados tras el ciclo=PENDING_CONFIRMATION/CONFIRMED; avisos=0 (el ciclo de la instancia principal corre cada minuto con 48/24 h y puede tocarlos después) |
| BE-198 | Caracterización | pedido PREPARING sin comprobante a las 24 h → CANCELLED ("Cancelación automática: no se recibió el comprobante de pago 24 horas después de confirmado.") (Q-19) |
| BE-199 | Aprobado | pendientes=3; del más antiguo al más reciente=true; whatsappUrl al teléfono del cliente=true; marcar=204; repetir=409; inexistente=404 |
| BE-200 | Aprobado | A: 29→28 (leyó una); B: 29→0 (leyó todas, dos veces: 204/204) |
| BE-201 | Aprobado | sin bloqueo: "Avisos creados: 0. Pedidos cancelados: 1. Avisos cerrados: 0."; con el bloqueo tomado: "Otra instancia está procesando los plazos en este momento." |
| BE-202 | Parcial | Revisión de código: NoticesService.tick() retorna antes de consultar si NODE_ENV=test (notices.service.ts:52), y las 20 suites de integración (que usan la hora controlada) pasan sin interferencias. No se observó en ejecución: requeriría una base aislada sin la instancia principal de QA |
| BE-203 | Aprobado | 403/403/403 |
| BE-204 | Aprobado | {"formato inválido":400,"to < from":400,"más de 3 años":400} |
| BE-205 | Aprobado | reporte: 14 pedidos, 567000; esperado (PAID no cancelados, incluye COD entregado): 14, 567000. Universo del día: PENDING/PENDING_CONFIRMATION=56, PENDING/CONFIRMED=18, PENDING/PREPARING=1, PENDING/SHIPPED=13, PENDING/DELIVERED=10, PENDING/CANCELLED=11, AWAITING_VERIFICATION/PENDING_CONFIRMATION=1, AWAITING_VERIFICATION/CONFIRMED=2, AWAITING_VERIFICATION/PREPARING=1, AWAITING_VERIFICATION/SHIPPED=2, PAID/CONFIRMED=9, PAID/PREPARING=1, PAID/SHIPPED=3, PAID/DELIVERED=1, PAID/CANCELLED=1, REJECTED/CONFIRMED=3, REJECTED/CANCELLED=2, REFUNDED/CONFIRMED=4 |
| BE-206 | Aprobado | pagado 10-oct 23:30 −05:00 (04:30 UTC del 11): día 10=40000; día 11=0 pedidos; día de creación 7=0 |
| BE-207 | Aprobado | {"day":"76 períodos, con cero=75","week":"12 períodos, con cero=11","month":"3 períodos, con cero=2"}; year=400 (días esperados 76) |
| BE-208 | Aprobado | ingreso con costo=60000, costo=24000, ganancia=36000; sin costo: 1 u. / 20000; envío cobrado=8000, costo real=3000; más vendido=Producto QA 1gzzdk (2 u.) |
| BE-209 | Aprobado | groupBy malicioso=400; from malicioso=400; tabla Order intacta (140 filas) |
| BE-210 | Aprobado | resumen {"ordersToConfirm":57,"paymentsToVerify":7,"noticesToSend":13,"lowStockVariants":1}; secciones: por confirmar=57, por verificar=7 (no cancelados 7), avisos=13, stock bajo=1 |
| BE-211 | Aprobado | escritura=403/403/403; lectura=200 |
| BE-212 | Aprobado | {"rating 0":400,"rating 6":400,"inicial \"Ga\"":400,"comentario 601":400,"producto inexistente":400} |
| BE-213 | Aprobado | publicados=6; primero="undefined undefined."; "María G." con producto activo=true; con producto inactivo muestra producto=false |
| BE-214 | Aprobado | migrate deploy en base vacía: ok (18 migraciones; el plan dice 19); diff esquema vs base: sin diferencias |
| BE-215 | Aprobado | 38 restricciones CHECK; resultado: {"stock negativo":"ProductVariant_stock_non_negative","total descuadrado":"Order_total_consistent","cancelado sin motivo":"Order_cancel_reason_required","rating 6":"Testimonial_rating_range","stockAfter incoherente":"InventoryMovement_stock_after_consistent"} |
| BE-216 | Aprobado | 1.ª=true, 2.ª=true; configuración filas=1, conserva la edición=true; métodos=BANK_TRANSFER:inactivo,CASH_ON_DELIVERY:inactivo,DAVIPLATA:inactivo,NEQUI:inactivo; propietarias=duena.seed@ejemplo.test |
| BE-217 | Aprobado | db:demo: Los datos de demostración no se cargan ni se borran en producción.; db:demo:clean: Los datos de demostración no se cargan ni se borran en producción.; productos demo=0 |
| BE-218 | Fallido | URL igual: se detiene=true; URL sin "_test" (sky_beauty_qa_scratch): se detiene=false, la suite falló (cuentas 1→1) |
| BE-219 | Aprobado | {"/store/orders":404,"/store/orders/af3b3ce3-b0c1-45b9-aebd-8ff348cc0bff":404,"/store/customers":404,"/store/orders?phone=3000000000":404,"/customers":404,"/orders":404} |
| BE-220 | Fallido | pedidos · productos · inventario (estado/resultados): {"' OR 1=1 --":"200/0 · 200/0 · 200/0","%":"200/140 · 200/149 · 200/154","\\":"200/0 · 200/0 · 200/0"} |
| BE-221 | Fallido | cuerpos con __proto__ y constructor → 200 (se ignoran en silencio en vez de rechazarse con 400; forbidNonWhitelisted no los detecta); arrays y objetos en campos de texto → 400. No se observó contaminación: tras {"__proto__":{"contaminado":"si"}} (200) ninguna respuesta incluye "contaminado"=false. Severidad baja |
| BE-222 | Aprobado | {"producto id":400,"producto status/isDemo/publishedAt":400,"variante stock":400,"personal role":400}; stock sigue en 20 |
| BE-223 | Parcial | cookie SameSite=Lax y CORS sin permiso para otros orígenes (correcto). Pero la API acepta cuerpos application/x-www-form-urlencoded: con la cookie, un PATCH en formato de formulario cambió la configuración. Un formulario HTML de otro sitio no envía la cookie Lax, así que la protección depende solo de SameSite; se recomienda aceptar solo JSON en /admin. Prueba en navegador real pendiente en FE |
| BE-224 | Aprobado | subida=201, guardada como products/b4607b41-0507-487c-9e7a-161b32f9d24f/7c5e8bdb-481d-468d-9640-5db9496a91cb.webp; /uploads/../package.json=404; /uploads/..%2f..%2fpackage.json=404; /uploads/%2e%2e/%2e%2e/.env=404; /uploads/products/..%5c..%5c.env=404 |
| BE-225 | Caracterización | el token de seguimiento aparece en el log de acceso=true (H-17, Q-17) |
| BE-226 | Parcial | npm audit --omit=dev (15-oct): 6 vulnerabilidades (4 altas, 2 moderadas), todas transitivas: mysql2 y deepmerge-ts vía la CLI de Prisma (mysql2 no se usa: la base es PostgreSQL) y js-yaml vía @nestjs/swagger (Swagger está apagado en producción). La corrección propuesta por npm es bajar Prisma a 6.x o cambiar de versión mayor de Swagger. Falta registrar la justificación o actualizar cuando haya versión corregida |
| BE-227 | Fallido | Catálogo bajo carga, 50 conexiones × 60 s con clave interna (listado, detalle, árbol y categoría). Con 2.206 productos activos y 5.242 variantes: 771 peticiones (13/s), p50 3,3 s, p95 10,5 s, 0 errores 5xx, memoria pico 364 MB. Con 506 activos: 10/s, p50 3,7 s, p95 11,4 s. Sin carga cada petición tarda 35–65 ms: el límite es la capacidad (~10–13 peticiones/s en un solo proceso de Node) y la cola crece con la concurrencia. Meta propuesta p95 < 500 ms (Q-15, sin confirmar) no se cumple. Medido en la misma máquina con PostgreSQL, Next.js y el generador de carga: cifras conservadoras; repetir en Railway |
| BE-228 | Fallido | Búsqueda y ofertas, 20 conexiones × 60 s. Con 2.206 productos activos: 120 peticiones (2/s), p50 10,3 s, p95 14,3 s, 0 errores, memoria 364 → 955 MB y no baja. Con 506 activos: 3/s, p95 12,0 s, memoria 444 → 554 MB. Sin carga: búsqueda 170 ms, ofertas 340 ms. Confirma H-14 (búsqueda y ofertas resueltas en memoria). Meta propuesta p95 < 1 s no se cumple; la memoria que no se libera es un riesgo en Railway |
| BE-229 | Aprobado | 30 pedidos simultáneos sobre la misma variante: códigos {"201":30}; p50 1182 ms, p95 1304 ms, máx 1321 ms; sin interbloqueos. Meta propuesta p95 < 1,5 s |
| BE-230 | Aprobado | 5242 variantes sin paginar (H-14): 10 peticiones, p50 160 ms, p95 192 ms, respuesta de 1374 KB. Meta propuesta p95 < 1 s |
| BE-231 | Aprobado | 5000 pedidos vencidos; ciclo: "Avisos creados: 0. Pedidos cancelados: 5000. Avisos cerrados: 0."; todos cancelados en 231 s (pendientes 0); existencias liberadas → 6050. Límite: 5 min (tiempo máximo de la transacción) |
| BE-232 | Aprobado | 10 fotos de 2.1 MB en paralelo: 201,201,201,201,201,201,201,201,201,201 en 6.1 s; memoria 212 → pico 226 → 226 MB |

### Frontend

| ID | Estado | Evidencia |
|---|---|---|
| FE-001 | Aprobado | [movil] logo=/brand/horizontal_logo.svg → /; bolsa "Bolsa de compra, 0 productos" → "Bolsa de compra, 1 producto"; favoritos → "Favoritos, 1 producto" · [escritorio] logo=/brand/horizontal_logo.svg → /; bolsa "Bolsa de compra, 0 productos" → "Bolsa de compra, 1 producto"; favoritos → "Favoritos, 1 producto" |
| FE-002 | Aprobado | [escritorio] 2 enlaces; fuera de /store/categories: ninguno; Ofertas → /productos?ofertas=1 |
| FE-003 | Aprobado | [movil] foco atrapado=true; vuelve al botón con Esc=true; elegir la categoría "Rostro QA 9vu6hx" navega y cierra el panel=true |
| FE-004 | Aprobado | [movil] sin texto: barra=false; con texto: visible=true · [escritorio] sin texto: barra=false; con texto: visible=true |
| FE-005 | Caracterización | Logotipo logo_vertical_dark.svg, WhatsApp, Instagram, contacto, "Rastrear pedido" → /rastrear y crédito con target=_blank rel="noopener noreferrer": correctos en celular y escritorio. CONFLICTO con Context: el pie enlaza siempre las 4 páginas legales y, sin texto, responden 200 con "Esta información estará disponible pronto." (commit 5a9bb43), mientras plan-desarrollo.md:398 dice que sin texto "no existe (404) ni aparece en el pie". Hay que decidir cuál es la correcta |
| FE-006 | Aprobado | [movil] /no-existe: 404, encabezado=true, pie=true, seguir comprando=true; /producto/no-existe: 404, encabezado=true, pie=true, seguir comprando=true · [escritorio] /no-existe: 404, encabezado=true, pie=true, seguir comprando=true; /producto/no-existe: 404, encabezado=true, pie=true, seguir comprando=true |
| FE-007 | Aprobado | [movil] /: 500, "No pudimos cargar esta página Tuvimos un problema al conectar con la tienda. Intenta de nuevo en unos segundos.", reintentar=true, detalles técnicos=false; [movil] /productos: 500, "No pudimos cargar esta página Tuvimos un problema al conectar con la tienda. Intenta de nuevo en unos segundos.", reintentar=true, detalles técnicos=false; [escritorio] /: 500, "No pudimos cargar esta página Tuvimos un problema al conectar con la tienda. Intenta de nuevo en unos segundos.", reintentar=true, detalles técnicos=false; [escritorio] /productos: 500, "No pudimos cargar esta página Tuvimos un problema al conectar con la tienda. Intenta de nuevo en unos segundos.", reintentar=true, detalles técnicos=false (backend detenido) |
| FE-008 | Aprobado | [escritorio] XFO=DENY; frame-ancestors none=true; nosniff=nosniff; Referrer-Policy=strict-origin-when-cross-origin; Permissions-Policy=true; HSTS=max-age=31536000 (next start en http local) |
| FE-009 | Aprobado | [movil] 8 páginas sin textos menores de 12 px · [escritorio] 8 páginas sin textos menores de 12 px |
| FE-010 | Aprobado | [movil] checkout, rastreador y búsqueda con campos ≥ 16 px |
| FE-011 | Aprobado | [escritorio] sin textos h1="Sky Beauty Maquillaje"; con textos h1="Título ficticio de QA", subtítulo=true |
| FE-012 | Aprobado | [escritorio] diapositivas=2 con botones "Ver diapositiva N de M"; botón de pausa=sí; sin avance automático en 7 s=true; Enter en el punto 2 cambia la diapositiva=true. El plan menciona "anterior/siguiente": la interfaz usa puntos |
| FE-013 | Aprobado | [escritorio] tarjetas en la sección=1; no destacadas=0. (La sección omite destacados ya mostrados en "Recién llegados" o en la portada) |
| FE-014 | Aprobado | [movil] sección "Precios especiales" visible=true; etiquetas de descuento=9; "Ver las N ofertas" → /productos?ofertas=1 · [escritorio] sección "Precios especiales" visible=true; etiquetas de descuento=9; "Ver las N ofertas" → /productos?ofertas=1 |
| FE-015 | Aprobado | [movil] sección=true; elementos=18; "María G."=true; estrellas con texto accesible=6 · [escritorio] sección=true; elementos=18; "María G."=true; estrellas con texto accesible=6 |
| FE-016 | Aprobado | [escritorio] estado=200; secciones=Presentación | Por qué comprar en Sky Beauty | Lo que dicen nuestras clientas | Inspírate con Sky Beauty; vacías=[]; errores JS=0 |
| FE-017 | Aprobado | [escritorio] URL ?categoria=<id>; título "Ojos FE 44gic5"; incluye subcategorías (sombra y delineador)=true; 9 productos |
| FE-018 | Aprobado | [escritorio] URL ?marca=<id>; productos=["Delineador FE 44gic5"] |
| FE-019 | Aprobado | [movil] URL ?q=SOMBRA+DE+PRUEBA+44GIC5; encontró "Sómbra de prueba 44gic5"=true · [escritorio] URL ?q=SOMBRA+DE+PRUEBA+44GIC5; encontró "Sómbra de prueba 44gic5"=true |
| FE-020 | Aprobado | [escritorio] ofertas de la categoría en orden=["Oferta 30 FE 44gic5","Oferta 10 FE 44gic5"] (esperado 30 % y luego 10 %); filtros activos: chips=2 Filtros(2) |
| FE-021 | Aprobado | [escritorio] paginación presente; página 2 marcada con aria-current; enlaces anterior/siguiente; elipsis visual (ícono aria-hidden) entre saltos de página (ver FE-138); ?pagina=999 → estado vacío "Sin resultados" con salida; ?pagina=abc → página 1 |
| FE-022 | Aprobado | [movil] mensaje="Sin resultados"; opciones para quitar filtros=1 · [escritorio] mensaje="Sin resultados"; opciones para quitar filtros=1 |
| FE-023 | Aprobado | [movil] abre y cierra al elegir=true; con categoría y marca "Filtros(2)"; "Todas las categorías" y "Todas las marcas" quitan cada filtro → "(sin filtros)". No hay un único botón "Limpiar" |
| FE-024 | Aprobado | [movil] etiqueta "Agotado"=true; botón "+" "…: agotado" deshabilitado=true · [escritorio] etiqueta "Agotado"=true; botón "+" "…: agotado" deshabilitado=true |
| FE-025 | Aprobado | [movil] etiqueta −30%=true; precio final $ 14.000=true; regular tachado="$ 20.000" · [escritorio] etiqueta −30%=true; precio final $ 14.000=true; regular tachado="$ 20.000" |
| FE-026 | Fallido | [escritorio] estado=500; script inyectado en el HTML=false; errores JS=1 |
| FE-027 | No aplica | Filtro por precio y ordenamiento elegido por el cliente: no implementado y no decidido en Context/ |
| FE-028 | Aprobado | [escritorio] nombre, marca, contenido neto (12 g) y descripción visibles; <title>="Paleta FE 44gic5 | Sky Beauty Maquillaje"; og:image con la foto del producto |
| FE-029 | Aprobado | [movil] y [escritorio] preselecciona Tono B (primera disponible, aria-pressed=true); precio B $ 50.000 → C $ 55.000; al elegir C la galería muestra la foto de C (color visible #7f90c1 ≈ foto C #8090c0; durante la transición se apilan dos <img>) |
| FE-030 | Aprobado | [movil] botón "Tono A· Agotado"; mensaje=true; no se puede agregar=true · [escritorio] botón "Tono A· Agotado"; mensaje=true; no se puede agregar=true |
| FE-031 | Aprobado | [movil] muestra agotado=true; no se puede agregar=true · [escritorio] muestra agotado=true; no se puede agregar=true |
| FE-032 | Parcial | [movil] y [escritorio] con stock 10, maxPerOrder 3 y tope general 2: el selector no pasa de 2 (Aumentar deshabilitado) y no baja de 1. No se muestra ningún texto que informe el máximo por pedido |
| FE-033 | Aprobado | [escritorio] bolsa con 1 y tope 2; selector en 2 → "Agregamos a tu bolsa las unidades disponibles." (la bolsa queda en 2); agregar de nuevo → "Ya tienes en tu bolsa el máximo disponible de este producto."; la acción "Ver bolsa" del toast lleva a /carrito. (Con dos toasts apilados, el botón "Ver bolsa" del primero queda detrás del segundo hasta pasar el puntero) |
| FE-034 | Aprobado | [escritorio] ficha muestra "Disponible"=true; cantidad en existencia visible en ficha/tarjeta/bolsa/checkout=false |
| FE-035 | Aprobado | [movil] producto INACTIVE → 404 · [escritorio] producto INACTIVE → 404 |
| FE-036 | Aprobado | [movil] aria-pressed false→true→false; contador "Favoritos, 1 producto" → "Favoritos, 0 productos" · [escritorio] aria-pressed false→true→false; contador "Favoritos, 1 producto" → "Favoritos, 0 productos" |
| FE-037 | Caracterización | [escritorio] 200; botón de compra=1; errores JS=0; texto: "Inicio / Productos / Sombras FE 44gic5 / Sin variantes FE 44gic5 Foto pendiente MARCA A FE 44GIC5 · SOMBRAS FE 44GIC5 Sin variantes FE 44gic5 Agotado $ 10.000 x Esta variante no está disponible. 1 Agr…" (comportamiento final según Q-18) |
| FE-038 | Aprobado | [movil] una variante: bolsa=[1]; varias variantes: el "+" es A /producto/paleta-fe-44gic5 · [escritorio] una variante: bolsa=[1]; varias variantes: el "+" es A /producto/paleta-fe-44gic5 |
| FE-039 | Aprobado | [movil] bolsa=1; segundo "+" muestra el aviso de máximo=true · [escritorio] bolsa=1; segundo "+" muestra el aviso de máximo=true |
| FE-040 | Aprobado | [escritorio] tras recargar=2; al quitar en otra pestaña la primera muestra "Favoritos, 1 producto" con 1 tarjeta(s) |
| FE-041 | Caracterización | [escritorio] con 100 guardados, el 101 → se conservan 100; aviso "Puedes guardar hasta 100 favoritos. Quita alguno para agregar más."=true. El plan suponía que salía el más antiguo; la interfaz bloquea y avisa |
| FE-042 | Aprobado | [movil] con uno activo y uno despublicado: aviso=true; "Quitar de favoritos"=true; tras quitar quedan 1 (el activo) · [escritorio] con uno activo y uno despublicado: aviso=true; "Quitar de favoritos"=true; tras quitar quedan 1 (el activo) |
| FE-043 | Aprobado | [escritorio] meta robots="noindex, nofollow"; texto sobre guardado en este navegador/dispositivo=true |
| FE-044 | Fallido | [escritorio] "{no-json": errores=0, contador="Favoritos, 0 productos"; [1,{},"x"]: errores=1, contador="Favoritos, 1 producto" |
| FE-045 | Aprobado | [escritorio] guardado en memoria=true; contador "Favoritos, 1 producto"; errores JS=0; error visible=0 |
| FE-046 | Aprobado | [movil] líneas con nombre y variante; total línea A $ 60.000, B con descuento $ 36.000; subtotal $ 100.000 y descuentos $ 4.000 iguales a los del servidor=true · [escritorio] líneas con nombre y variante; total línea A $ 60.000, B con descuento $ 36.000; subtotal $ 100.000 y descuentos $ 4.000 iguales a los del servidor=true |
| FE-047 | Aprobado | [escritorio] subtotal $ 30.000 → $ 60.000 → $ 30.000; la línea sigue visible mientras recalcula=true |
| FE-048 | Aprobado | [escritorio] orden tras deshacer = A,B,C |
| FE-049 | Aprobado | [movil] mensaje de existencias=true; mensaje de máximo por pedido=true; continuar bloqueado=true · [escritorio] mensaje de existencias=true; mensaje de máximo por pedido=true; continuar bloqueado=true |
| FE-050 | Aprobado | [escritorio] válida restaurada (A); cantidades 0/−1/1,5 descartadas=true; JSON corrupto → bolsa vacía=true; errores JS=0 |
| FE-051 | Aprobado | [movil] estado vacío=true; enlace=/productos · [escritorio] estado vacío=true; enlace=/productos |
| FE-052 | Aprobado | [escritorio] subtotal=true; descuentos=true; envío "Por confirmar"=true; "Total sin envío"=true (provisional) |
| FE-053 | Aprobado | [escritorio] NaN=false; totales en $ 0=false; botón de reintento=true; texto: "TU SELECCIÓN Tu bolsa de belleza Revisa productos, cantidades y precios antes de continuar al checkout. No pudimos revisar tu bolsa. Revisa tu conexión e intent" |
| FE-054 | Caracterización | [escritorio] pestaña B sube a 2; la pestaña A abierta sigue mostrando $ 30.000 (sin sincronizar entre pestañas). H-21, decidir según Q-11 |
| FE-055 | Aprobado | [movil] línea marcada no disponible=true; opción de quitar=true; checkout bloqueado=true · [escritorio] línea marcada no disponible=true; opción de quitar=true; checkout bloqueado=true |
| FE-056 | Aprobado | [movil] foco en "Nombre completo"; campos con aria-invalid=7, con aria-describedby=7; mensajes por campo=3/3 visibles; llamadas a la API=0 · [escritorio] foco en "Nombre completo"; campos con aria-invalid=7, con aria-describedby=7; mensajes por campo=3/3 visibles; llamadas a la API=0 |
| FE-057 | Aprobado | [escritorio] pedidos SB-261015-256393, SB-261015-56390D; teléfono guardado 573001234567, 573001234567 |
| FE-058 | Aprobado | [movil] municipios de La Guajira=15 (DIVIPOLA 15); al cambiar a Antioquia el municipio queda "Selecciona municipio" · [escritorio] municipios de La Guajira=15 (DIVIPOLA 15); al cambiar a Antioquia el municipio queda "Selecciona municipio" |
| FE-059 | Aprobado | [escritorio] métodos antes de elegir municipio=0; Riohacha: contra entrega=true; Medellín: contra entrega=false |
| FE-060 | Aprobado | [escritorio] instrucciones de Nequi visibles al elegirlo=true |
| FE-061 | Bloqueado | [escritorio] dos casillas obligatorias independientes=true; sin textos publicados las casillas no tienen enlaces (0); con textos ficticios publicados enlazan a /terminos target=_blank, /datos-personales target=_blank (abren en otra pestaña) → la mecánica funciona. Bloqueado para aprobar: faltan los textos legales aprobados (H-19) |
| FE-062 | Aprobado | [escritorio] peticiones POST enviadas=1; pedidos creados=1 |
| FE-063 | Aprobado | [escritorio] mensaje del servidor visible=true; nombre conservado="Clienta Que Llega Tarde QA"; enlace a la bolsa=true |
| FE-064 | Aprobado | [escritorio] primer envío cortado tras procesarse (mensaje: "intenta"); reintento con la misma clave=true; pedidos=1 |
| FE-065 | Aprobado | [escritorio] borrador conservado al volver=true; el navegador pide confirmación al cerrar=true |
| FE-066 | Aprobado | [escritorio] URL /pedido/SB-261015-43BE6F; bolsa vacía=true; resumen en sessionStorage=sky-beauty-order-SB-261015-43BE6F |
| FE-067 | Aprobado | [movil] estado vacío: "pedido. Tu bolsa está vacía Agrega productos antes de continuar al checkout. Ver productos"; "Ver productos" → /productos · [escritorio] estado vacío: "pedido. Tu bolsa está vacía Agrega productos antes de continuar al checkout. Ver productos"; "Ver productos" → /productos |
| FE-068 | Aprobado | [escritorio] subtotal 30.000 → envío $ 5.000 y total $ 35.000=true; subtotal 120.000 → "Envío gratis" y total $ 120.000=true |
| FE-069 | Aprobado | [escritorio] pedido creado: muestra el nombre=false, <img> inyectada=0; en el panel se ve como texto=true; se ejecutó alert=false |
| FE-070 | Aprobado | [movil] código, producto y total visibles; botón WhatsApp → https://wa.me/573000000000?text=Hola%2C%… target=_blank · [escritorio] código, producto y total visibles; botón WhatsApp → https://wa.me/573000000000?text=Hola%2C%… target=_blank |
| FE-071 | Parcial | [escritorio] sin número de WhatsApp: no hay enlaces wa.me ni botones rotos y aparece "La tienda aún no tiene un número de WhatsApp configurado. Guarda tu código de pedido.". Pero el título sigue diciendo "Envía tu pedido por WhatsApp para continuar" (contradictorio) y no se ofrece otra forma de contactar a la tienda |
| FE-072 | Aprobado | [escritorio] enlace /seguimiento/<token> → página del pedido SB-261015-EAE170=true; copiar código="Código copiado."=true |
| FE-073 | Aprobado | [escritorio] estado=200; sin datos del pedido=true; orienta a /rastrear; errores=0 |
| FE-074 | Aprobado | [escritorio] robots.txt excluye /pedido=true; meta robots en la página="null" |
| FE-075 | Aprobado | [movil] pasos=true; transportadora y guía=true; rastreo=https://rastreo.ejemplo.test/GUIA-FE-075; datos del cliente visibles=ninguno · [escritorio] pasos=true; transportadora y guía=true; rastreo=https://rastreo.ejemplo.test/GUIA-FE-075; datos del cliente visibles=ninguno |
| FE-076 | Aprobado | [movil] abc → 200 "ENLACE PRIVADO"; 48 hex inexistente → 200 "ENLACE PRIVADO" · [escritorio] abc → 200 "ENLACE PRIVADO"; 48 hex inexistente → 200 "ENLACE PRIVADO" |
| FE-077 | Parcial | [escritorio] pedido cancelado automáticamente: aviso "Tu pedido SB-261015-D640DE fue cancelado. Motivo: no recibimos la confirmación de tu pedido por What…"; sin pasos de avance=true; fecha de la cancelación (15/10/2026) visible=false. La página muestra la fecha del pedido, pero el aviso de cancelación no trae fecha |
| FE-078 | Aprobado | [escritorio] "Entrega local"=true; muestra guía=false; transportadora=false |
| FE-079 | Aprobado | [escritorio] target=_blank; rel=noreferrer |
| FE-080 | Aprobado | [escritorio] meta robots="noindex, nofollow" |
| FE-081 | Aprobado | [escritorio] vacío → campos inválidos=2; no coinciden → mensaje genérico=true; correctos → seguimiento=true; tras 6 intentos: "Hiciste muchos intentos" |
| FE-082 | Caracterización | [escritorio] encabezado=true; lista=2; negrita=true; <script> como texto=true; se ejecutó=false. Sin texto: 200 con "disponible pronto"=true y sigue en el pie (el plan esperaba 404 fuera del pie: conflicto con plan-desarrollo, ver FE-005) |
| FE-083 | Aprobado | [movil] correo configurado visible=true; botón de WhatsApp=true; formularios=0 · [escritorio] correo configurado visible=true; botón de WhatsApp=true; formularios=0 |
| FE-084 | Aprobado | [escritorio] robots.txt sin excluir: nada; sitemap: activo=true, inactivo=false, /terminos publicada=true, /datos-personales sin texto=false |
| FE-085 | Parcial | [escritorio] inicio: og:title="Sky Beauty Maquillaje", og:description="Tienda de maquillaje y productos de belleza en Riohacha, La ", og:image=ninguna; ficha: og:title="Paleta FE 44gic5", og:image=/uploads/products/53858a26-a480-4e3e-b254-4c29e811e736/2a7b4666-675d-4352-83c9-47d476587ef1.webp. La imagen general del inicio está pendiente (logotipo en PNG) |
| FE-086 | Aprobado | [escritorio] /admin → /admin/login; /admin/pedidos → /admin/login; contenido del panel visible=false |
| FE-087 | Aprobado | [escritorio] errada: "Correo o contraseña incorrectos."; bloqueada: "Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en 15 minuto(s)." |
| FE-088 | Aprobado | [escritorio] vacío: campos con error=2, llamadas=0; ojo: password → text |
| FE-089 | Aprobado | [escritorio] menú del personal: Resumen, Pedidos, Avisos, Pagos, Envíos, Productos, Inventario, Categorías, Marcas, Contenido, Testimonios, Configuración, Mi cuenta; ve secciones de la propietaria: ninguna |
| FE-090 | Aprobado | [escritorio] /admin/reportes→/admin; /admin/promociones→/admin; /admin/cuentas→/admin |
| FE-091 | Aprobado | [escritorio] cookie inválida: /admin → /admin/login |
| FE-092 | Aprobado | [escritorio] tras cerrar sesión y "Atrás": ruta /admin/login, datos del panel visibles=false |
| FE-093 | Aprobado | [escritorio] corta → "Debe tener al menos 12 caracteres."; distinta → "Las contraseñas no coinciden."; correcta → aviso "Contraseña actualizada. Se cerraron tus otras sesiones." |
| FE-094 | Fallido | [escritorio] con la sesión revocada desde otra pestaña, al guardar el cambio de contraseña aparece "No se pudo cambiar la contraseña. Intenta de nuevo.": no explica que la sesión venció ni redirige a /admin/login (el usuario puede reintentar sin éxito). Severidad baja |
| FE-095 | Aprobado | [escritorio] propietaria: mostradas {"ordersToConfirm":"80","paymentsToVerify":"7","noticesToSend":"12","lowStockVariants":"4"} vs API {"ordersToConfirm":80,"paymentsToVerify":7,"noticesToSend":12,"lowStockVariants":4}; enlaces /admin/pedidos, /admin/pagos, /admin/avisos, /admin/inventario; ventas 30 días=1; personal: pendientes=1, ventas=0 |
| FE-096 | Aprobado | [escritorio] personal: 38 sin leer → 37 tras abrir una → 0 tras "Marcar todas"; la propietaria sigue con 38 (independiente) |
| FE-097 | Aprobado | [escritorio] crear → creada; repetido → "Ya existe una cuenta con ese correo."; desactivada (isActive=false) inicia sesión=401; restablecer → "Contraseña de Personal Ficticio QA restablecida exitosamente." |
| FE-098 | Aprobado | [escritorio] campos=18, deshabilitados=18; botones de acción=0 |
| FE-099 | Fallido | [escritorio] WhatsApp de 10 dígitos se guarda con 57 (573000000000); cifras inválidas muestran error por campo ("Ingresa un porcentaje mayor que 0 y hasta 100.") y no se guardan; agregar tarifa de Envigado → "Tarifa de envío guardada." y aparece listada. DEFECTO al quitar una tarifa: el backend la borra (DELETE → 200 sin cuerpo) pero el panel muestra "No se pudo eliminar la tarifa." y la deja en la lista hasta recargar. Causa: store-settings.controller.ts:49 no declara @HttpCode(204) y apiFetch solo omite el JSON con 204 |
| FE-100 | Aprobado | [escritorio] activar Nequi sin instrucciones → "Para activar Nequi escribe primero sus instrucciones de pago." (captura shots/FE-100-activar.png); con instrucciones guardadas → avisos "Nequi activado. / Nequi: cambios guardados.", activo=true, la tarjeta muestra "Activo". Municipios del contra entrega por la interfaz: FE-059 (Riohacha sí, Medellín no) |
| FE-101 | Aprobado | [escritorio] propietaria guarda → "Título UI QA"; personal solo lectura=true, botones Guardar=0 |
| FE-102 | Aprobado | [escritorio] publicado aparece en el inicio=true; al ocultar desaparece=true; borrado=true; botones de edición para el personal=0 |
| FE-103 | Aprobado | [escritorio] repetida → "Ya existe una marca con ese nombre o slug."; botón borrar en marca con productos=0; personal: crear=1, borrar=0 |
| FE-104 | Aprobado | [escritorio] opciones de padre=4; subcategorías ofrecidas como padre (tercer nivel)=0 |
| FE-105 | Fallido | [escritorio] precio base 0 → producto creado=true (H-02/Q-02: falta el cambio de código); personal: costo visible en la gestión=false, campo de costo al editar variante=0. Crear con valores válidos, foto y publicar: e2e/catalog.spec.ts (aprobada) |
| FE-106 | Aprobado | [escritorio] 6 MB → "La imagen no puede superar 5 MB."; PDF → "Solo se aceptan imágenes JPG, PNG o WebP." (controles: - button "Choose File" ; - button "Subir foto" ; - button "Cerrar") |
| FE-107 | Aprobado | [escritorio] compra +3 → 8; ajuste −5 sin motivo (campo "Justificación *") → botón deshabilitado, stock 8; con motivo → 3; aparece en "Stock bajo"=true |
| FE-108 | Fallido | [escritorio] fechas invertidas → "La fecha de inicio debe ser anterior a la fecha de fin." (correcto); promoción del 100 % → "Promoción creada." (se acepta: H-02, falta el cambio de código de Q-02). Botón "Historial" de versiones presente en cada promoción |
| FE-109 | Fallido | [escritorio] búsqueda por código, nombre y teléfono correcta; filtros de estado y pago presentes. Sin paginación: la bandeja muestra 20 de 189 pedidos (orders-manager.tsx llama /admin/orders sin page) y no hay forma de ver los más antiguos salvo buscando. Productos (20 de 189) y promociones tienen el mismo síntoma |
| FE-110 | Fallido | [escritorio] sin costo de envío el botón "Confirmar pedido" está bloqueado (correcto); "Editar productos" solo en el pedido sin confirmar (correcto); el personal no ve "Cancelar" en un pedido pendiente (correcto). Pero en un pedido pagado el botón "Cancelar pedido y liberar existencias" se habilita al escribir el motivo y no se exige ni explica la devolución previa (H-10, falta el cambio de código de Q-05) |
| FE-111 | Aprobado | [escritorio] segunda pestaña confirma un pedido ya confirmado → "Solo se pueden confirmar pedidos pendientes."; estado mostrado después: Sin confirmar |
| FE-112 | Aprobado | [escritorio] personal registra comprobante y no ve verificar/rechazar/devolver (0); propietaria verifica → PAID; cambia envío tras el pago → 12000, total 44000 |
| FE-113 | Aprobado | [escritorio] personal crea transportadora y despacha con guía → pedido SHIPPED; seguimiento muestra la guía=true; copiar enlace → "Enlace copiado." |
| FE-114 | Aprobado | [escritorio] "Abrir en WhatsApp" → https://wa.me/573000000000?text=… (teléfono del cliente); marcar como enviado: contador del menú 11 → 10 sin recargar; pestaña Enviados con avisos=true |
| FE-115 | Aprobado | [escritorio] rango por defecto 2026-09-16 → 2026-10-15 (30 días); CSV "ventas_2026-09-16_2026-10-15.csv": BOM=true, separador ;=true, coma decimal=true |
| FE-116 | Aprobado | [escritorio] con el backend detenido, /admin y /admin/pedidos muestran "Algo salió mal. Tuvimos un problema al cargar la tienda. Intenta de nuevo en unos segundos." con botón "Intentar de nuevo", sin pantalla en blanco ni detalles técnicos. Observación menor: en el panel el texto dice "la tienda" |
| FE-117 | Parcial | sin desbordes horizontales en 360/390/768/1024/1440 px (pasada anterior, 10 páginas). Controles táctiles < 44×44 en celular: 360px /: 30 (Inicio de Sky Beauty 180×41; Buscar productos 181×24; Buscar 71×34; Pausar el avance automático 40×40) | 360px /productos: 28 (Inicio de Sky Beauty 180×41; Buscar productos 181×24; Buscar 71×34; Guardar Producto QA 5k1xjg e 40×40) | 360px /producto/producto-qa-5k1xjg: 5 (Inicio de Sky Beauty 180×41; Buscar productos 181×24; Buscar 71×34; Disminuir cantidad 44×43) | 360px /carrito: 5 (Inicio de Sky Beauty 180×41; Buscar productos 181×24; Buscar 71×34; Disminuir cantidad de Produc 44×43) | 360px /checkout: 5 (Inicio de Sky Beauty 180×41; Buscar productos 181×24; Buscar 71×34; 16×16) | 360px /rastrear: 3 (Inicio de Sky Beauty 180×41; Buscar productos 181×24; Buscar 71×34) | 390px /: 30 (Inicio de Sky Beauty 180×41; Buscar productos 211×24; Buscar 71×34; Pausar el avance automático 40×40) | 390px /productos: 28 (Inicio de Sky Beauty 180×41; Buscar productos 211×24; Buscar 71×34; Guardar Producto QA 5k1xjg e 40×40) | 390px /producto/producto-qa-5k1xjg: 5 (Inicio de Sky Beauty 180×41; Buscar productos 211×24; Buscar 71×34; Disminuir cantidad 44×43) | 390px /carrito: 5 (Inicio de Sky Beauty 180×41; Buscar productos 211×24; Buscar 71×34; Disminuir cantidad de Produc 44×43) | 390px /checkout: 5 (Inicio de Sky Beauty 180×41; Buscar productos 211×24; Buscar 71×34; 16×16) | 390px /rastrear: 3 (Inicio de Sky Beauty 180×41; Buscar productos 211×24; Buscar 71×34) |
| FE-118 | Fallido | violaciones serias/críticas (axe-core 4.10, WCAG 2.1 AA): color-contrast → / (1, ej. .mt-2.text-eyebrow.leading-\[1\.8\]); /admin (14, ej. .mx-3); /admin/productos (7, ej. small) || button-name → /admin/pedidos (2, ej. .px-3\.5.py-3\.25[role="combobox"]:nth-child(3)); /admin/productos (2, ej. .min-w-44.focus\:border-\[\#936591\][role="combobox"]:nth-child(3)) |
| FE-119 | Aprobado | [escritorio] compra completa solo con teclado (Tab, Enter, Espacio y flechas): agregar desde la ficha, continuar desde la bolsa, llenar datos, elegir departamento y municipio en los desplegables, método de pago, casillas y "Crear pedido" → /pedido/<código>. Foco visible en el botón final |
| FE-120 | Parcial | controles sin nombre accesible: ninguno; botón de quitar en la bolsa con nombre genérico "Eliminar" (sin el producto)=1. Corazón, "+", bolsa, menú y cerrar sí tienen nombre. Prueba con NVDA/TalkBack real: no ejecutada |
| FE-121 | Caracterización | ratios de la paleta oficial: #B785B8/#FFFFFF = 2.97:1; #A46EA4/#FFFFFF = 3.93:1; #8A694D/#F5F1EB = 4.43:1; #B785B8/#F5F1EB = 2.64:1; #A46EA4/#F5F1EB = 3.49:1; #FFFFFF/#A46EA4 = 3.93:1; #8A694D/#FFFFFF = 4.99:1; #D8D4CB/#FFFFFF = 1.48:1. Bajo 4,5:1 para texto normal: #B785B8 sobre #FFFFFF, #A46EA4 sobre #FFFFFF, #8A694D sobre #F5F1EB, #B785B8 sobre #F5F1EB, #A46EA4 sobre #F5F1EB, #FFFFFF sobre #A46EA4, #D8D4CB sobre #FFFFFF. El uso real en pantalla lo verifica axe en FE-118 (regla color-contrast) |
| FE-122 | Aprobado | Firefox: compra creada SB-261015-C45C9C, municipios de La Guajira=15, municipio se borra al cambiar de departamento=true, botón WhatsApp=true, errores JS=0; WebKit escritorio: compra creada SB-261015-165E2B, municipios de La Guajira=15, municipio se borra al cambiar de departamento=true, botón WhatsApp=true, errores JS=0; WebKit iPhone: compra creada SB-261015-51F831, municipios de La Guajira=15, municipio se borra al cambiar de departamento=true, botón WhatsApp=true, errores JS=0. Equivale a E2E-001 (compra) y FE-058 en cada motor |
| FE-123 | Parcial | Medido con Chromium (Pixel 7, CPU ×4, red 1,6 Mb/s y 150 ms; no es Lighthouse): /: LCP 1956 ms, CLS 0, carga 3126 ms, JS 236 KB; /productos: LCP 1456 ms, CLS 0, carga 2773 ms, JS 204 KB; /producto/<slug>: LCP 1288 ms, CLS 0, carga 2948 ms, JS 208 KB; /checkout: LCP 1080 ms, CLS 0.16, carga 2799 ms, JS 238 KB. Metas propuestas de Q-15 (no confirmadas): LCP < 2,5 s → peor 1956 ms cumple; CLS < 0,1 → peor 0.16 NO cumple. INP y la puntuación de rendimiento no se midieron (requieren Lighthouse o interacción real); el catálogo de QA tiene pocas fotos |
| FE-124 | Aprobado | bolsa con cotización demorada: "Cargando tu bolsa…"; checkout al cambiar de municipio: "Actualizando el total…", botón deshabilitado=true |
| FE-125 | Parcial | /: animaciones largas/infinitas=0, transiciones > 300 ms=26; /carrito: animaciones largas/infinitas=0, transiciones > 300 ms=0 |
| FE-126 | Aprobado | textos de funciones descartadas: ninguno; rutas {"/login":404,"/cuenta":404,"/registro":404} |
| FE-127 | Aprobado | búsqueda de CIELO10 y unsplash en frontend/src: sin coincidencias |
| FE-128 | Aprobado | [unitarias aprobadas] store-settings.test.ts: normaliza WhatsApp igual que el backend, arma el enlace y formatea pesos sin decimales. En la tienda se ve "$ 15.000" (FE-025) y el panel guarda 573000000000 (FE-099) |
| FE-129 | Aprobado | [unitaria aprobada] csv.test.ts: punto y coma, BOM y comillas. Exportación real del panel verificada en FE-115 (BOM, ;, coma decimal) |
| FE-130 | Fallido | [unitarias aprobadas] admin-auth, catalog y store-settings validan contraseña de 12, correo, slug, hex, WhatsApp y cifras. Faltan: el esquema de testimonios no tiene pruebas, y el precio base 0 se acepta en el formulario de producto (FE-105, H-02/Q-02) |
| FE-131 | Aprobado | [unitarias aprobadas] api.test.ts y api.server.test.ts: JSON 2xx, ApiError con mensaje del backend y sin cuerpo JSON, 404 → null en la versión pública, cabecera interna solo con clave. Observación: con una respuesta 200 sin cuerpo apiFetch falla (ver FE-099); solo 204 está contemplado |
| FE-132 | Aprobado | [en el navegador] addItem respeta el máximo (FE-033, FE-039), cantidades 0/−1/1,5 se descartan (FE-050), deshacer restaura la posición (FE-048), crear el pedido vacía la bolsa (FE-066). No hay prueba unitaria de CartProvider |
| FE-133 | Parcial | [en el navegador] toggle (FE-036), límite de 100 con aviso (FE-041), favorito despublicado con opción de quitar (FE-042), sincronización entre pestañas por storage (FE-040). Falla FE-044: una entrada corrupta de tipo texto rompe la página de favoritos |
| FE-134 | Aprobado | nombre de 1, teléfono de 6, dirección de 4 → marcados: Nombre completo, Teléfono / WhatsApp, Departamento, Municipio, Dirección, Acepto los términos y condiciones., Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.; sin marcar: ninguno; indicaciones de 301 → el campo admite 300; llamadas a la API=0 |
| FE-135 | Aprobado | [en el navegador] sin cookie /admin y /admin/pedidos redirigen a /admin/login (FE-086); cookie inválida → login (FE-091); /admin/login accesible |
| FE-136 | Aprobado | [en el navegador] menú del personal sin Reportes, Promociones ni Cuentas, y las URL directas redirigen (FE-089, FE-090) |
| FE-137 | Aprobado | [unitarias aprobadas] rich-text.test.tsx: títulos, párrafos, listas, saltos de Windows, encabezados semánticos y HTML como texto. Verificado en /terminos (FE-082) |
| FE-138 | Aprobado | página 1: [1] 2 … 8 Siguiente · página 4: Anterior 1 … 3 [4] 5 … 8 Siguiente · página 8: Anterior 1 … 7 [8] (la elipsis es un ícono con aria-hidden) |
| FE-139 | No aplica | Descartado: registro e inicio de sesión de clientes (negocio.md §3, §13). FE-126 confirmó que no aparece en la tienda |
| FE-140 | No aplica | Descartado: recuperación de contraseña por correo (sin servicio de correo, decisión del 2026-10-09). FE-126 confirmó que no aparece en la tienda |
| FE-141 | No aplica | Descartado: perfil e historial de pedidos del cliente (sin cuentas; se usa el enlace privado o /rastrear). FE-126 confirmó que no aparece en la tienda |
| FE-142 | No aplica | Descartado: cupones (AGENTS.md §4). FE-126 confirmó que no aparece en la tienda |
| FE-143 | No aplica | Descartado: reseñas públicas (los testimonios los registra la propietaria). FE-126 confirmó que no aparece en la tienda |
| FE-144 | No aplica | Descartado: suscripción a novedades (decisión del 2026-10-14). FE-126 confirmó que no aparece en la tienda |

### Punta a punta

| ID | Estado | Evidencia |
|---|---|---|
| E2E-001 | Aprobado | celular: búsqueda → ficha → Tono 2 z1pbmj × 2 → bolsa → checkout (La Guajira/Riohacha, Nequi con instrucciones) → pedido SB-261015-DDB919 (total 65000); WhatsApp con código y método=true; seguimiento abre el pedido=true; existencias reservadas 10 → 8; errores JS=0 |
| E2E-002 | Aprobado | panel: crear (borrador, tienda 404) → 2 variantes → foto → existencias iniciales 6/6 → publicar (ACTIVE); tienda: ficha 200 con foto=true; encontrado por {"categoría padre":true,"marca":true,"búsqueda":true} |
| E2E-003 | Aprobado | agotado al inicio=true; personal registra compra de 3 → "Disponible"=true; clienta agrega 2; personal ajusta −2 con motivo (stock 1); la bolsa marca "No hay existencias suficientes…"=true y bloquea el checkout=true |
| E2E-004 | Aprobado | promoción del 20 % en la categoría padre creada en el panel; la ficha (subcategoría) muestra −20 %, $ 50.000 tachado y $ 40.000=true; compra SB-261015-B87778; al editarla al 10 % la tienda muestra −10 % y $ 45.000=true; el pedido conserva descuento 10000 y precio 40000 |
| E2E-005 | Aprobado | Riohacha 50.000 → envío $ 5.000=true; 100.000 → gratis=true; envío gratis nacional en Cali (sin tarifa) → gratis=true; desactivado → "Por confirmar"=true; pedido SB-261015-BC42E2: confirmar bloqueado sin costo=true, con 9.000 → CONFIRMED |
| E2E-006 | Aprobado | clienta compra SB-261015-56993D; personal cotiza 8.000 y confirma, registra comprobante; propietaria verifica; personal despacha con guía y entrega → DELIVERED/PAID; seguimiento con guía y "Entregado"=true; venta en reportes del día=true |
| E2E-007 | Aprobado | compra SB-261015-D0CD0E con contra entrega en Riohacha; personal confirma y registra entrega local en tránsito → entregado → DELIVERED/PAID, registros de pago=1; seguimiento "Entrega local"=true; venta en reportes=true |
| E2E-008 | Aprobado | propietaria rechaza en el panel; a las 7 h el aviso "antes" aparece en la bandeja y se marca enviado; a las 8 h el personal cancela con motivo → CANCELLED; avisos BEFORE/SENT, AFTER/PENDING; el seguimiento muestra "Tu pedido SB-261015-1D390C fue cancelado. Motivo: pago no verificado. …" |
| E2E-009 | Aprobado | 47 h: aviso en la bandeja del personal=true y en la campana=true; 48 h: CANCELLED ("Cancelación automática: el pedido siguió sin confirmar 48 horas después de creado."), stock liberado 5/5, notificaciones NOTICE_PENDING, NOTICE_PENDING, ORDER_AUTO_CANCELLED |
| E2E-010 | Aprobado | transferencia confirmada sin comprobante a las 24 h → CANCELLED ("Cancelación automática: no se recibió el comprobante de pago 24 horas después de confirmado."); contra entrega equivalente → CONFIRMED; el seguimiento muestra el aviso de cancelación |
| E2E-011 | Aprobado | personal edita el pedido sin confirmar: X ×2 conserva 20.000 (hoy 26.000)=20000, Y quitada=true, Z agregada=true; existencias X/Y/Z=8/10/9; subtotal 52000.00; tras confirmar ya no se puede editar=true |
| E2E-012 | Aprobado | dos navegadores compran la última unidad a la vez: pedidos creados=1; la otra clienta ve "No hay existencias suficientes para Producto QA jji4wc. Revisa los datos e intenta de nuevo."; su bolsa marca el problema=true |
| E2E-013 | Aprobado | primer envío procesado y cortado; reintento → la clienta llega a SB-261015-EE8880; pedidos en la base=1, en el panel=1 |
| E2E-014 | Aprobado | código en minúsculas y teléfono "+57 300-666-7788" → seguimiento de SB-261015-4520DC=true; datos erróneos → mensaje genérico=true |
| E2E-015 | Aprobado | menú sin secciones de la propietaria=true; URL directas → /admin, /admin, /admin; configuración editable=0; en un pedido con comprobante no ve verificar/rechazar/devolver/cancelar (0); costo visible=false; borrar marcas=0 |
| E2E-016 | Aprobado | propietaria crea la cuenta → el personal inicia sesión=true → cambia su contraseña (login con la nueva 200) → la propietaria restablece (login 200, la sesión abierta del personal vuelve a login=true) → desactiva (login 401) |
| E2E-017 | Aprobado | propietaria guarda WhatsApp, correo e Instagram y agrega Medellín al contra entrega; contacto muestra el correo=true; pie con WhatsApp=true e Instagram=true; contra entrega en Medellín=true, en Cali=false |
| E2E-018 | Bloqueado | mecánica con textos ficticios: las 4 páginas muestran su texto={"/terminos":true,"/datos-personales":true,"/cambios-y-garantias":true,"/envios":true}; enlaces en el pie=4; casillas del checkout enlazan a ["/terminos","/datos-personales"] → funciona. Bloqueado para aprobar: faltan los textos legales aprobados (H-19) |
| E2E-019 | Aprobado | propietaria desactiva uno desde el panel; /favoritos avisa=true; el otro sigue visible=true; al quitar queda 1 |
| E2E-020 | Aprobado | venta verificada aparece en reportes=true; la propietaria registra la devolución total en el panel → REFUNDED; sale de los reportes=true; el seguimiento muestra pago devuelto=true |
| E2E-021 | Aprobado | borrar → "El producto tiene pedidos asociados y no puede eliminarse. Archívalo en su lugar." (sigue existiendo=true); archivar → ARCHIVED; la tienda responde 404; el pedido conserva nombre y precio=true |
| E2E-022 | Aprobado | cambia la contraseña en el navegador A; el navegador B al navegar → /admin/login; A sigue en /admin/pedidos |
| E2E-023 | Aprobado | franja del inicio → /productos?ofertas=1; en la categoría: 35 % > 15 %; "+" agrega el de una variante (bolsa 1) |
