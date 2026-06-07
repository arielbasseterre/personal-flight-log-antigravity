import React, { useState } from 'react';
import { supabase } from '@/src/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, UserPlus, Mail, Lock, Plane, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [license, setLicense] = useState('');
  const [dni, setDni] = useState('');
  const [legajo, setLegajo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Error de configuración: No se han encontrado las variables de Supabase en el entorno.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
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
      setError(err.message || "Ocurrió un error");
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
            <CardTitle className="text-xl">{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</CardTitle>
            <CardDescription>
              {isLogin ? 'Ingresa tus credenciales para acceder' : 'Regístrate para comenzar a registrar tus vuelos'}
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
              </div>

              {error && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : (isLogin ? <LogIn className="mr-2" size={18} /> : <UserPlus className="mr-2" size={18} />)}
                {isLogin ? 'Entrar' : 'Registrarme'}
              </Button>
            </form>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
              <span className="relative px-2 bg-white dark:bg-[#1a2233] text-[10px] text-slate-400 uppercase tracking-widest">DEBUG / TEST</span>
            </div>

            <Button 
              variant="outline" 
              className="w-full border-dashed border-blue-400/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10"
              onClick={async () => {
                setLoading(true);
                const email = import.meta.env.VITE_DEMO_EMAIL || 'gomez@oasis.com';
                const pass = import.meta.env.VITE_DEMO_PASS || 'gomez123';
                try {
                  const { error: signInError } = await supabase!.auth.signInWithPassword({ email, password: pass });
                  
                  if (signInError) {
                    const { error: signUpError } = await supabase!.auth.signUp({ email, password: pass });
                    if (signUpError) throw signUpError;
                    alert("Usuario 'Gómez' creado. Por favor haz click otra vez para Iniciar Sesión.");
                  }
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setLoading(false);
                }
              }}
            >
              🚀 Probar como "Gómez"
            </Button>

            <div className="mt-6 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-medium text-blue-600 hover:underline flex items-center justify-center mx-auto gap-1"
              >
                {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                <ArrowRight size={14} />
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
