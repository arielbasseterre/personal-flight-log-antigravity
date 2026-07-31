# Usar la imagen oficial de Playwright que incluye Node.js y todas las dependencias de Chromium
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

# Crear directorio de la app
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

COPY scripts/ ./scripts/

# Instalar dependencias de Node
RUN npm install --legacy-peer-deps

# Copiar el código fuente
COPY . .

# Establecer variable de entorno para producción
ENV NODE_ENV=production

# Compilar el frontend (React/Vite)
RUN npm run build

# Sincronizar el reloj al arrancar: ANAC rechaza con "ajusta la hora de su sistema"
# cuando el reloj del contenedor está desviado (clock drift de Render).
RUN apt-get update && apt-get install -y ntpdate tzdata

# Zona horaria Argentina (ANAC valida hora local AR)
ENV TZ=America/Argentina/Buenos_Aires

# Exponer el puerto
EXPOSE 3000

# Arrancar la aplicación sincronizando el reloj (al inicio y cada hora) antes de servir
CMD ["bash", "-c", "ntpdate -s pool.ntp.org || true; (while true; do sleep 3600; ntpdate -s pool.ntp.org || true; done) & npx tsx server.ts"]
