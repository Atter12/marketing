# EcomTools - Marketing Landing Pages

Suite de herramientas gratuitas para e-commerce con landing pages optimizadas.

## 🚀 Despliegue en Vercel

Este proyecto está listo para desplegarse en Vercel.

### Pasos para desplegar:

1. **Instalar Vercel CLI** (opcional, si quieres desplegar desde terminal):
   ```bash
   npm i -g vercel
   ```

2. **Desplegar desde la web de Vercel**:
   - Ve a [vercel.com](https://vercel.com)
   - Conecta tu repositorio de GitHub/GitLab/Bitbucket
   - O arrastra la carpeta del proyecto directamente
   - Vercel detectará automáticamente la configuración

3. **Desplegar desde terminal**:
   ```bash
   vercel
   ```

### 📁 Estructura del Proyecto

```
.
├── index.html              # Página principal con todas las herramientas
├── tiktok-downloader.html  # Landing page para descargar videos de TikTok
├── vercel.json             # Configuración de Vercel
├── .gitignore             # Archivos a ignorar en Git
└── README.md              # Este archivo
```

### 🌐 Rutas Disponibles

- `/` - Página principal (index.html)
- `/tiktok-downloader` - Descargador de TikTok (tiktok-downloader.html)
- `/tiktok-downloader.html` - Misma página, ruta alternativa

### ⚙️ Configuración

El archivo `vercel.json` está configurado para:
- Servir archivos HTML estáticos
- Manejar rutas limpias (sin .html)
- Redirigir correctamente todas las páginas

### 🔧 Próximos Pasos

1. ✅ Frontend listo para producción
2. ⏳ Backend API para funcionalidad de descarga
3. ⏳ Integración con servicios de extracción de videos

### 📝 Notas

- Todas las páginas son estáticas (HTML/CSS/JS)
- No requiere build process
- Compatible con Vercel Static Sites
- Optimizado para SEO y rendimiento

