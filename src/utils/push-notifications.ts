// ═══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — Capacitor + Firebase Cloud Messaging (FCM)
// ═══════════════════════════════════════════════════════════════════════════
// Este módulo maneja el registro y recepción de notificaciones push en el
// lado del CLIENTE (app Android/iOS via Capacitor).
//
// Flujo:
//   1. Solicitar permisos de notificación al usuario
//   2. Registrar el dispositivo con FCM y obtener el token
//   3. Guardar el token FCM en Supabase (tabla push_tokens)
//   4. Escuchar notificaciones entrantes (foreground + background)
//   5. Al tap en la notificación, navegar a la pantalla de roster
//
// REQUISITOS:
//   - Firebase project configurado con FCM habilitado
//   - google-services.json en android/app/
//   - @capacitor/push-notifications instalado (v6 para Capacitor 6)
//   - Tabla push_tokens creada en Supabase (ver database_arms_roster.sql)
// ═══════════════════════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase/client';

// ── Tipo para el evento custom de navegación ────────────────────────────
// Cuando el usuario toca la notificación, disparamos este evento para
// que App.tsx cambie la pantalla a 'roster'.
declare global {
  interface WindowEventMap {
    'open-arms-roster': CustomEvent;
  }
}

/**
 * Registra el dispositivo para recibir notificaciones push.
 * Solo funciona en plataformas nativas (Android/iOS), NO en web.
 *
 * @param userId — UUID del usuario autenticado en Supabase
 */
export async function registerPushNotifications(userId: string): Promise<void> {
  // ── Guard: Solo ejecutar en plataformas nativas ───────────────────────
  // En web (navegador), las push notifications de Capacitor no funcionan.
  if (!Capacitor.isNativePlatform()) {
    console.log('[PUSH] Plataforma web detectada — notificaciones push no disponibles.');
    return;
  }

  try {
    // ── Import dinámico (evita errores en web) ──────────────────────────
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // ── Paso 1: Solicitar permisos ──────────────────────────────────────
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') {
      console.warn('[PUSH] Permiso de notificaciones denegado por el usuario.');
      return;
    }
    console.log('[PUSH] Permiso de notificaciones concedido.');

    // ── Paso 2: Registrar con FCM ───────────────────────────────────────
    await PushNotifications.register();

    // ── Paso 3: Listener de token FCM ───────────────────────────────────
    // Se dispara cuando FCM asigna o renueva el token del dispositivo.
    PushNotifications.addListener('registration', async (token) => {
      console.log('[PUSH] Token FCM obtenido:', token.value.substring(0, 30) + '...');

      // Guardar/actualizar el token en Supabase para que el servidor
      // pueda enviarnos notificaciones en el cron job.
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          fcm_token: token.value,
          platform: Capacitor.getPlatform(),  // 'android' | 'ios'
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[PUSH] Error guardando token FCM en Supabase:', error.message);
      } else {
        console.log('[PUSH] Token FCM guardado en Supabase correctamente.');
      }
    });

    // ── Paso 4: Error de registro ───────────────────────────────────────
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PUSH] Error en registro FCM:', error);
    });

    // ── Paso 5: Notificación recibida con la app ABIERTA (foreground) ───
    // Cuando llega una notificación y la app está visible, podemos
    // mostrar un indicador visual sutil en lugar del banner del sistema.
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PUSH] Notificación recibida (foreground):', notification.title);

      // Disparar evento para que la UI muestre un badge o indicador
      window.dispatchEvent(new CustomEvent('arms-roster-updated', {
        detail: { title: notification.title, body: notification.body },
      }));
    });

    // ── Paso 6: El usuario TAP en la notificación (foreground o background) ─
    // Navegar automáticamente a la pantalla del roster.
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[PUSH] Notificación tocada — abriendo roster...');
      window.dispatchEvent(new CustomEvent('open-arms-roster'));
    });

    console.log('[PUSH] Sistema de notificaciones inicializado correctamente.');

  } catch (error) {
    console.error('[PUSH] Error inicializando notificaciones push:', error);
  }
}

/**
 * Elimina el token FCM de Supabase (e.g. cuando el usuario cierra sesión).
 * Esto previene que el servidor siga enviando notificaciones al dispositivo.
 *
 * @param userId — UUID del usuario
 */
export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);
    console.log('[PUSH] Token FCM eliminado de Supabase.');
  } catch (error) {
    console.error('[PUSH] Error eliminando token:', error);
  }
}
