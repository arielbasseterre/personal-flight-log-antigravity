# Decisiones Técnicas — Personal Flight Log

## ¿Por qué redirect checkout y no CardPayment Brick de MP?

**Problema**: La sandbox de MP rechazaba todos los card tokens con `"Card token service not found"` (tanto API v1 como v2).
**Solución**: Redirect checkout vía `PreApprovalPlan.create()` → `init_point`. El usuario completa el pago en el sitio de MP y es redirigido de vuelta.
**Lección**: No intentar usar Brick de MP en sandbox para suscripciones — no funciona. Redirect checkout es más simple y fiable.

## ¿Por qué Brevo y no Resend?

Resend se usó originalmente para las Edge Functions de Supabase, pero:
- Resend usa `onboarding@resend.dev` como sender — solo puede enviar al email registrado hasta verificar dominio
- Las Edge Functions dependían de webhooks de Supabase que se pierden al restaurar la BD
- Brevo permite usar `gringo.soft.ar@gmail.com` como sender directo
- Brevo tiene mejor dashboard de tracking

**Estado actual**: Resend está legacy, no activo. Todo usa Brevo desde `server.ts`.

## ¿Por qué sin React Router (navegación por estado)?

**Motivo**: La app es PWA + Capacitor. React Router puede causar problemas con:
- URLs deep-link en Capacitor (rutas relativas vs absolutas)
- Service Worker cacheo de rutas
- Recarga en SPA servida por Express (`app.get("*")`)
**Alternativa**: Estado `screen` en App.tsx con renderizado condicional. Más simple, predecible, y compatible con mobile.

## ¿Por qué Playwright y no puppeteer?

Playwright:
- Soporte nativo de Microsoft, actualizaciones frecuentes
- API más limpia y moderna
- `ignoreHTTPSErrors` fácil de configurar
- Buen soporte en Docker (imagen oficial `mcr.microsoft.com/playwright`)
- Timeouts y network idle handling más predecibles

## ¿Por qué un solo `server.ts` monolítico?

**Contexto**: Comenzó como un backend pequeño y creció orgánicamente.
**Razón**: Simplicidad de deploy (un solo archivo, tsx lo corre directo). No requiere build step ni routers modulares.
**Consecuencia**: V2 tiene ~2356 líneas. Si sigue creciendo, convendría dividir en:
- `routes/` (ANAC, MP, ARMS, email, calendario)
- `services/` (Brevo, Playwright, Supabase)
- `helpers/` (ICS, PDF, formatos)

## ¿Por qué el callback de MP parsea la URL con regex?

**Problema**: MP redirige a la URL `...callback?external_reference=UUID?preapproval_id=ID`. El segundo `?` en vez de `&` rompe el parser estándar de URL de Express.
**Solución**: Extraer parámetros con regex directamente de `req.url`:
```typescript
const matchPreapproval = urlStr.match(/[?&](?:preapproval_id|id)=([^&?]+)/);
```
**Lección**: No confiar en que MP respete estándares de URL. Siempre parsear la URL cruda.

## ¿Por qué ignorar errores SSL en Playwright en Render?

**Problema**: En Render, el reloj del servidor puede desviarse (clock drift), causando falsos positivos de certificado SSL vencido.
**Solución**: `ignoreHTTPSErrors: true` en `browser.newContext()`.
**Riesgo**: Bajo — solo afecta al tráfico hacia ANAC y ARMS, no hay datos sensibles en tránsito que no estén ya cifrados.

## ¿Por qué separar V1 y V2 en dos repositorios?

**Historia**: 
1. V1 se creó primero (sin roster)
2. Se añadió roster ARMS + calendario en V2
3. Se mantuvieron ambas versiones porque hay usuarios en cada una
4. V1 tiene trial 30 días, V2 requiere pago directo

**Consecuencia**: Los cambios de seguridad/estructurales deben replicarse manualmente en ambas. Existe `NOTA: Revision cruzada entre versiones` en ai_context.md para recordarlo.

## ¿Por qué `SUPABASE_SERVICE_ROLE_KEY` y no la anon key en server.ts?

**Motivo**: La service role key bypasea RLS. Como todos los endpoints del server son operaciones admin (crear usuarios, insertar registros), necesitan este permiso. La anon key solo se usa en el frontend con RLS activo.

**Riesgo**: Si alguien obtiene la service role key, tiene acceso total a la BD. Por eso solo está en el servidor y en Render Dashboard, nunca en el frontend ni en el repositorio.

## ¿Por qué el webhook de MP siempre responde 200?

**Comportamiento de MP**: Si un webhook responde con error (4xx/5xx), MP reintenta el envío múltiples veces durante horas, generando logs espurios y posibles race conditions.
**Solución**: Todos los webhooks responden 200 aunque haya error interno. El error se loguea pero no se devuelve a MP.

## ¿Por qué la navegación usa `localStorage` flags en vez de context?

**Ejemplo**: Al hacer clic en la card de suscripción, se setea `localStorage.setItem('scroll_to_subscription', 'true')` antes de navegar a `'perfil'`, y ProfileScreen lo lee y hace scroll.

**Motivo**: El flag sobrevive aunque el componente se monte/desmonte (lo cual pasa seguido con renderizado condicional). Context se perdería si el screen cambia antes de que el target termine de montarse.
