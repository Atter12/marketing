# Instalación del Acortador de Links con Supabase

## Paso 1: Configurar Supabase

1. Ve a tu proyecto en Supabase
2. Abre el SQL Editor
3. Ejecuta el contenido del archivo `schema.sql` para crear las tablas necesarias

## Paso 2: Configurar Variables de Entorno en Vercel

Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega:

```
DIRECT_URL=tu_direct_url_de_supabase
DATABASE_URL=tu_database_url_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
PUBLIC_SUPABASE_URL=tu_supabase_url
SHORT_DOMAIN=tudominio.com (opcional, por defecto usa el dominio actual)
```

### Dónde encontrar estas variables:

- **PUBLIC_SUPABASE_URL**: En Supabase → Settings → API → Project URL
- **PUBLIC_SUPABASE_ANON_KEY**: En Supabase → Settings → API → anon public key
- **SUPABASE_SERVICE_ROLE_KEY**: En Supabase → Settings → API → service_role secret key
- **DATABASE_URL**: En Supabase → Settings → Database → Connection string (URI)
- **DIRECT_URL**: En Supabase → Settings → Database → Connection string (Direct connection)

## Paso 3: Instalar Dependencias

```bash
npm install @supabase/supabase-js
```

O si ya está en package.json:
```bash
npm install
```

## Paso 4: Desplegar

```bash
vercel --prod
```

## Paso 5: Probar

1. Ve a `https://tudominio.com/url-shortener.html`
2. Acorta una URL
3. Prueba el link acortado: `https://tudominio.com/tu-alias`

## Estructura de Archivos

```
api/
  url-shortener/
    ├── shorten.js      # POST - Acortar URL
    ├── redirect.js     # GET - Redirigir desde alias
    ├── stats.js        # GET - Obtener estadísticas
    ├── supabase.js     # Helper de conexión a Supabase
    ├── schema.sql      # Estructura de base de datos
    ├── README.md       # Documentación de API
    └── INSTALL.md      # Este archivo
```

## Troubleshooting

### Error: "Supabase credentials not configured"
- Verifica que todas las variables de entorno estén configuradas en Vercel
- Asegúrate de haber hecho redeploy después de agregar las variables

### Error: "relation does not exist"
- Ejecuta el schema.sql en Supabase SQL Editor
- Verifica que las tablas se hayan creado correctamente

### Las redirecciones no funcionan
- Verifica que la ruta en vercel.json esté correcta
- Asegúrate de que el patrón regex no esté capturando otras rutas

### Los clicks no se registran
- Verifica que la función `increment_url_clicks` se haya creado en Supabase
- Revisa los logs de Vercel para ver errores

## Próximos Pasos

Una vez que todo funcione, puedes:
1. Agregar autenticación de usuarios
2. Implementar expiración de links
3. Agregar píxeles de seguimiento
4. Crear dashboard de analytics más completo
