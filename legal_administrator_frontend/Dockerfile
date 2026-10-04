# ==========================================
# 1. ETAPA DE DESARROLLO (Vite Dev Server)
# ==========================================
FROM node:22-alpine AS dev
WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el código fuente
COPY . .

# Exponer el puerto por defecto de Vite
EXPOSE 5173

# Arrancar el servidor de desarrollo exponiéndolo a 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ==========================================
# 2. ETAPA DE BUILD (Compilación estática)
# ==========================================
FROM dev AS builder
RUN npm run build

# ==========================================
# 3. ETAPA DE PRODUCCIÓN (Nginx)
# ==========================================
FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
