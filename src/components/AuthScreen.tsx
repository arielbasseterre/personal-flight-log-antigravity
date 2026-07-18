import React, { useState } from 'react';
import { supabase } from '@/src/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, UserPlus, Mail, Lock, Plane, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const AuthScreen = ({ onRegisterSuccess }: { onRegisterSuccess?: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Error de configuración: No se han encontrado las variables de Supabase en el entorno.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      if (showForgot) {
        const checkRes = await fetch('/api/check-email-exists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const checkData = await checkRes.json();
        if (!checkData.exists) {
          setError('Ese email no está registrado en la aplicación.');
          setLoading(false);
          return;
        }
        const appUrl = import.meta.env.VITE_API_URL || window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: appUrl,
        });
        if (error) throw error;
        setForgotSent(true);
        return;
      }

      if (isLogin) {
        await supabase.auth.signOut({ scope: 'local' });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!role) throw new Error("Debes seleccionar tu cargo (Pilotos FB / TCPs FB)");

        const response = await fetch('/api/mercadopago/register-with-trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            firstName,
            lastName,
            role
          })
        });
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || 'Error al crear la cuenta');
        }
        if (resData.access_token && resData.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: resData.access_token,
            refresh_token: resData.refresh_token
          });
          if (sessionError) throw sessionError;
        } else {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
        }

        onRegisterSuccess?.();
      }
    } catch (err: any) {
      if (err.message?.includes("Invalid login credentials")) {
        setError("Revisa tu usuario y/o contraseña");
      } else {
        setError(err.message || "Ocurrió un error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 flex-1 max-w-sm mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full space-y-8 -mt-8"
      >
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Plane className="text-white transform -rotate-45" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Personal flight log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Control de horas de vuelo profesional</p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">
              {showForgot ? 'Recuperar Contraseña' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </CardTitle>
            <CardDescription>
              {showForgot
                ? 'Te enviaremos un enlace para restablecer tu contraseña'
                : isLogin
                  ? 'Ingresa tus credenciales para acceder'
                  : 'Regístrate para comenzar a registrar tus vuelos'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input 
                      id="firstName" 
                      placeholder="Juan" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input 
                      id="lastName" 
                      placeholder="Pérez" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}
              
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="role">Cargo en Flybondi</Label>
                    <div className="relative">
                      <select
                        id="role"
                        required
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full h-11 pl-4 pr-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 appearance-none"
                      >
                        <option value="" disabled>Seleccionar cargo</option>
                        <option value="piloto_fb">Pilotos FB</option>
                        <option value="tcp_fb">TCPs FB</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="piloto@aerolinea.com" 
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              {!showForgot && (
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={isLogin ? "current-password" : "new-password"}
                    />
                  </div>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setError(null); }}
                      className="text-xs text-blue-600 hover:underline self-start -mt-1"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
              )}

              {forgotSent ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30 flex items-start gap-3">
                  <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Enlace enviado</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">Revisá tu email. Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.</p>
                  </div>
                </div>
              ) : error && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                  {error}
                </div>
              )}

              {!forgotSent && (
                <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                  {showForgot ? 'Enviar enlace' : isLogin ? 'Entrar' : 'Registrarme'}
                </Button>
              )}
            </form>

            <div className="mt-6 text-center">
              <button 
                onClick={() => {
                  if (showForgot) {
                    setShowForgot(false);
                    setError(null);
                    setForgotSent(false);
                  } else {
                    setIsLogin(!isLogin);
                  }
                }}
                className="text-sm font-medium text-blue-600 hover:underline flex items-center justify-center mx-auto gap-1"
              >
                {showForgot ? 'Volver al inicio de sesión' : isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                <ArrowRight size={14} />
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
