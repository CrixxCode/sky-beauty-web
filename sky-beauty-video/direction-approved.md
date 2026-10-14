# Dirección del video

## Exención de las tres direcciones (Huashu Design)

La skill Huashu Design pide mostrar tres direcciones visuales y esperar a que la persona usuaria elija antes de producir. En esta entrega no se hizo, por dos motivos registrados aquí:

1. **Instrucción explícita de la persona usuaria (2026-10-14):** "Debes generar realmente el siguiente archivo: `sky-beauty-video/output/sky-beauty-demo.mp4`. No te limites a entregar un storyboard, un documento, imágenes estáticas o código sin ejecutar. Quiero el video final renderizado y reproducible." La skill se pidió "como referencia principal para la dirección visual", no como proceso con aprobaciones intermedias.
2. **La dirección visual ya estaba fijada por la marca y por la petición:** colores, tipografías y logotipos oficiales (`Context/decisiones.md`), interfaz real como protagonista, y referencia de calidad "Apple, Stripe y Linear" con estética de belleza premium.

## Dirección aplicada

**"Editorial claro"**: fondo marfil de la marca con brillos lavanda muy suaves; la interfaz real dentro de una ventana flotante con sombra profunda y discreta; antetítulo en Poppins con espaciado amplio y título en Playfair Display arriba a la izquierda, alineados a la ventana; cámara contenida (acercamientos de 1,2x a 1,5x solo con la pantalla quieta); cierre en morado profundo con el logotipo para fondo oscuro.

Si se quiere explorar otra dirección (por ejemplo, oscuro de principio a fin, o montaje a pantalla completa sin ventana), el montaje está parametrizado en `scenes/compositor.html` y `scripts/timeline.mjs`: no hace falta volver a grabar.
