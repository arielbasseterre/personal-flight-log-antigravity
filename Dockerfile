# Usar la imagen oficial de Playwright que incluye Node.js y todas las dependencias de Chromium
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

# Crear directorio de la app
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de Node
RUN npm install --legacy-peer-deps

# Copiar el código fuente
COPY . .

# Establecer variable de entorno para producción
ENV NODE_ENV=production

# Compilar el frontend (React/Vite)
RUN npm run build

# Exponer el puerto
EXPOSE 3000

# Arrancar la aplicación (usamos tsx para correr server.ts directamente en producción, o compilarlo)
# Vite corre por defecto en el puerto 3000, nuestro express usa process.env.PORT || 3000
CMD ["npx", "tsx", "server.ts"]
