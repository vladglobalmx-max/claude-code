# Aviso de Privacidad — Impulso Sticker Builder Professional

> Aviso mínimo para la V1 comercial. **No sustituye asesoría legal.** Impulso Sticker Builder Professional es una aplicación que corre enteramente en tu computadora — este aviso describe exactamente eso, sin generalidades.

## Qué datos NO recopila Impulso

Por diseño (ver ADR-0026/ADR-0028 del proyecto), la aplicación:
- **No sube tu contenido creativo** — ningún diseño, imagen, texto o proyecto sale de tu computadora sin que tú lo exportes/descargues explícitamente.
- **No sube tus archivos ni nombres de archivo.**
- **No tiene telemetría de uso** en esta versión — no se registra qué haces dentro de la aplicación.
- **No requiere ni crea ninguna cuenta.**
- **No usa cookies de rastreo** ni analíticas de terceros dentro de la aplicación misma.
- **No se conecta a ningún servidor propio** — la aplicación funciona localmente, sirviéndose a sí misma desde tu propia computadora (ver la Guía de Distribución Offline).

## Qué datos SÍ existen, y dónde

- **Tus proyectos y assets** se guardan localmente en tu navegador (IndexedDB), en tu propia computadora. Nadie más tiene acceso a ellos salvo que tú los exportes o los compartas.
- **Una preferencia mínima** ("¿ya viste la pantalla de bienvenida?") se guarda en `localStorage`, también localmente.
- **Los datos de tu compra** (email, método de pago, país) los procesa **Gumroad**, no Impulso directamente — consulta la [política de privacidad de Gumroad](https://gumroad.com/privacy) para esos datos.

## Soporte

Si nos escribes para pedir soporte, solo usamos la información que tú decidas incluir en tu mensaje (ver la Guía de Soporte para qué información es útil incluir, y qué evitar — nunca envíes contenido confidencial de tus proyectos salvo que te lo pidamos explícitamente para diagnosticar un problema).

## Futuro

Si una versión futura de Impulso agrega telemetría de diagnóstico opcional (errores/uso agregado, nunca contenido creativo), este aviso se actualizará antes de que esa versión se publique, y será opt-in, no automático (ver `docs/product/05-Technical-Debt.md`/Roadmap de la Commercial Platform para el diseño ya evaluado).

---

*Preguntas sobre este aviso: contacta el correo de soporte indicado en la documentación de este paquete.*
