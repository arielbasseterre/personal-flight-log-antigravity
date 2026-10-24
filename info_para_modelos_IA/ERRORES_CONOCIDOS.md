# Errores Conocidos y Soluciones — Personal Flight Log

## 1. Brevo bloquea IP de Render

**Síntoma**: `[NOTIFY] Error al notificar a X: { message: 'We have detected you are using an unrecognised IP address 74.220.48.29...' }`
**Causa**: Brevo tiene lista blanca de IPs autorizadas. Render cambia de IP o la IP nueva no está registrada.
**Solución**:
1. Ir a https://app.brevo.com/security/authorised_ips
2. Agregar `74.220.48.29` (la IP actual de Render)
3. **Para cubrir todo Render**, agregar manualmente estos rangos CIDR (la importación CSV **no** acepta CIDR, solo IPs individuales):

   ```
   52.3.128.0/17
   52.0.128.0/17
   54.88.0.0/17
   54.208.0.0/17
   44.192.0.0/16
   44.194.0.0/16
   44.196.0.0/16
   ```

4. Si Render cambia la IP, repetir el proceso

## 2. MP callback URL malformada (doble `?`)

**Síntoma**: `subscription-callback` no encuentra `preapproval_id` en `req.query`
**Causa**: MP concatena `?preapproval_id=ID` con `?` en vez de `&`: `/callback?external_reference=UUID?preapproval_id=ID`
**Solución**: Usar regex sobre `req.url` en vez de `req.query`:
```typescript
const matchPreapproval = urlStr.match(/[?&](?:preapproval_id|id)=([^&?]+)/);
```
Implementado en V2 línea ~2060 y V1 línea ~1340.

## 3. MP checkout redirige a URL incorrecta (pantalla blanca post-pago)

**Síntoma**: Después de pagar, el usuario ve pantalla blanca o URL de MP en vez de la app
**Causa**: `resolveFrontendUrl()` no encuentra la URL correcta porque depende de `req.headers.origin` que MP sobreescribe
**Solución**: El callback ahora usa `req.query.frontend_url` como primera opción (enviado desde el frontend al crear la suscripción). Si no está, cae a `req.headers.origin/referer`, luego `VITE_API_URL`, luego URL hardcodeada.

## 4. Trial sigue activo después de pagar (V1)

**Síntoma**: Usuario paga pero sigue viendo "Período de prueba gratuito"
**Causa**: El trial se detecta por `subscription_id = null`. Si el callback/webhook no setea `subscription_id`, el trial persiste.
**Solución**: Verificar que el callback y webhook siempre seteen `subscription_id` al crear o actualizar el perfil. Implementado en ambos.

## 5. Webhook vs callback race condition

**Síntoma**: El webhook de MP procesa la suscripción antes que el callback, y cuando el callback llega, `pending_registrations` ya no tiene el registro.
**Causa**: MP envía webhook y redirect al callback simultáneamente. El webhook (async) procesa primero.
**Solución**: El callback tiene fallback que busca `profiles WHERE subscription_id = sub.id`. Si existe, actualiza end_date en vez de crear. Implementado en V2 línea ~2262 y V1.

## 6. Playwright clock drift en Render

**Síntoma**: Login ANAC o ARMS falla con error de certificado SSL
**Causa**: El reloj del servidor Render puede desviarse, haciendo que los certificados SSL aparezcan como vencidos o no válidos
**Solución**: `ignoreHTTPSErrors: true` en `browser.newContext()`. Implementado en ANAC y ARMS.

## 7. SW update detection duplicado

**Síntoma**: Aparecen dos banners de actualización al mismo tiempo
**Causa**: En `App.tsx`, los listeners `reg.installing` y `updatefound` se disparaban ambos para el mismo Service Worker
**Solución**: Usar una sola función listener con nombre (`onStateChange`). Fix aplicado en ambas versiones.

## 8. Login falso "Invalid login credentials"

**Síntoma**: Usuario existente obtiene "Invalid login credentials" aunque la contraseña sea correcta
**Causa**: Sesión stale en localStorage de Supabase Auth que interfiere con el nuevo intento de login
**Solución**: `await supabase.auth.signOut({ scope: 'local' })` antes de `signInWithPassword()`. Implementado en AuthScreen.tsx.

## 9. Layout roto en iOS Safari (PWA)

**Síntoma**: Contenido cortado en la parte inferior en iPhone
**Causa**: `100vh` en CSS incluye el área detrás de las barras del navegador. `h-screen overflow-hidden` empeora el problema.
**Solución**: Reemplazar `h-screen overflow-hidden` por `min-h-screen`. Agregar `viewport-fit=cover` al meta tag. Usar clase `pt-safe-area-inset-top` en headers.

## 10. PDF.js bloqueado por CSP en Safari

**Síntoma**: PDF no se muestra en Safari, error de CSP en consola
**Causa**: Content Security Policy bloquea la carga dinámica de scripts desde CDN (cdnjs)
**Solución**: Descargar PDF.js a `public/assets/` y cargarlo desde el propio dominio. Eliminar cdnjs de CSP. Agregar `unsafe-eval` a `script-src` para WASM de `@react-pdf/renderer`.

## 11. DNS timeout en ANAC desde Windows/Node v24

**Síntoma**: `dns.promises.lookup()` tarda ~11s en resolver `cad.anac.gob.ar`, superando timeouts
**Causa**: Node.js v24 en Windows tiene problemas con `lookup()` para ciertos dominios
**Solución**: Reemplazar por `dns.promises.resolve4()` que resuelve en ~9ms. Implementado en server.ts.

## 12. Error de compilación en V2 por fragment `< >` huérfano

**Síntoma**: Vite da error "Unterminated regular expression" al hacer build
**Causa**: Al remover campos del formulario de registro en AuthScreen.tsx, quedó un `</>` (fragment) sin cerrar correctamente
**Solución**: Reemplazar `</>` por `</div>` para cerrar el contenedor correctamente.

## 13. Webhook de suscripción no encuentra el usuario

**Síntoma**: El webhook de MP no actualiza la suscripción porque no encuentra `external_reference`
**Causa**: A veces MP no asocia el `external_reference` a la suscripción, o el callback ya lo limpió
**Solución**: Búsqueda con 3 estrategias en orden:
1. `external_reference` del body del webhook
2. Búsqueda por `subscription_id` en `profiles`
3. Extraer de `back_url` de la suscripción en MP vía `PreApproval.get()`

## 14. Cron de Telegram falla en 1 segundo (ubuntu-latest → Ubuntu 26.04)

**Síntoma**: El workflow `Telegram Roster Bot` empieza a fallar en **todos** los runs (llega el correo "All jobs have failed" cada 30 min). El step `Install Chromium (with system deps)` falla en **~1 segundo** y `Run bot` queda `skipped` (el scraper de ARMS nunca arranca). Ocurrió del 2026-10-20 al 2026-10-24.

**Causa**: GitHub migró el label `ubuntu-latest` de Ubuntu 24.04 a **Ubuntu 26.04** (rollout desde el 19/10/2026, completo el 19/11/2026 — [actions/runner-images#14748](https://github.com/actions/runner-images/issues/14748)). `playwright@1.59.1` solo trae builds hasta `ubuntu24.04-x64` (ver `node_modules/playwright-core/lib/server/registry/index.js`), así que `npx playwright install --with-deps chromium` aborta al instante por plataforma no soportada.

**Ojo — no confundir con ARMS caído**: cuando ARMS falla, el error se captura por usuario (`telegram/index.ts`, catch de `checkRosters`) → el job termina **verde** y a lo sumo avisa por Telegram. Si el job falla entero, es entorno/credenciales, no ARMS.

**Solución aplicada** (commit `60276e0`) en `.github/workflows/telegram-bot.yml`:
```yaml
jobs:
  bot:
    runs-on: ubuntu-24.04   # antes: ubuntu-latest (playwright 1.59.1 no soporta Ubuntu 26.04)
```

**Cómo volver a `ubuntu-latest`** — ✅ **RESUELTO el 2026-10-24**:
- Playwright actualizado `1.59.1` → **`1.64.1`** (npm) y `Dockerfile` → **`v1.64.1-jammy`** (obligatorio que vayan juntos: si cambia el npm sin la imagen, el Chromium del contenedor no coincide y el scraping falla con *"Executable doesn't exist at /ms-playwright/chromium-XXXX"*).
- Workflow de vuelta a `runs-on: ubuntu-latest` (y `actions/checkout@v7`, `setup-node@v7`, `cache@v6` para sacar el warning de Node 20).
- Validado con runs verdes: **#577** (`ubuntu-latest` = 24.04) y **#578** (`ubuntu-26.04` explícito). Además se probó en producción: sync manual de **ARMS** desde la app y sync de **ANAC** con la imagen nueva.

El procedimiento queda registrado por si hay que repetirlo con una futura migración:
1. Verificar que la versión nueva de Playwright tenga `ubuntu26.04-x64` en el registry (buscar en `nativeDeps.js` / `registry/index.js`).
2. `npm i playwright@latest` + commit de `package.json` / `package-lock.json`.
3. Probar con `runs-on: ubuntu-26.04` disparando `workflow_dispatch` (no tocar `ubuntu-latest` todavía).
4. Si el run da verde → cambiar a `ubuntu-latest` y borrar el pin.

**Diagnóstico rápido sin `gh` CLI** (la API pública alcanza; los logs crudos sí requieren auth):
- `GET https://api.github.com/repos/<owner>/<repo>/actions/runs?per_page=5` → conclusiones y `head_sha`
- `GET https://api.github.com/repos/<owner>/<repo>/actions/runs/<run_id>/jobs` → qué step exacto falló
- `GET .../check-runs/<id>/annotations` → anotaciones del runner (acá apareció el aviso de la migración a Ubuntu 26)
