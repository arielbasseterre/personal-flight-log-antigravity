import React, { useState } from 'react';
import { supabase } from '@/src/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, UserPlus, Mail, Lock, Plane, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [license, setLicense] = useState('');
  const [dni, setDni] = useState('');
  const [legajo, setLegajo] = useState('');
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
        const { data: authData, error: authError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name: firstName,
              last_name: lastName,
              license: license,
              dni: dni,
              legajo: legajo
            }
          }
        });
        
        if (authError) throw authError;

        alert("¡Registro exitoso! Revisa tu email para confirmar.");
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
    <div className="flex flex-col items-center justify-center p-6 h-full max-w-sm mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full space-y-8"
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
                      placeholder="Ariel" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input 
                      id="lastName" 
                      placeholder="Basseterre" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}
              
              {!isLogin && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="license">Licencia (Sigla)</Label>
                    <Input 
                      id="license" 
                      placeholder="TLA" 
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legajo">Legajo Nº</Label>
                    <Input 
                      id="legajo" 
                      placeholder="82468" 
                      value={legajo}
                      onChange={(e) => setLegajo(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI / Pasaporte</Label>
                  <Input 
                    id="dni" 
                    placeholder="29327413" 
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    required
                  />
                </div>
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
