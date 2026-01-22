# API de Acortador de Links

Esta carpeta contiene los endpoints de la API para el acortador de links.

## Endpoints

### 1. `/api/url-shortener/shorten`
**Método:** POST  
**Descripción:** Acorta una URL y la guarda en la base de datos

**Request Body:**
```json
{
  "originalUrl": "https://ejemplo.com/pagina-muy-larga",
  "customAlias": "mi-link", // opcional
  "userId": "user123" // opcional
}
```

**Response (éxito):**
```json
{
  "success": true,
  "data": {
    "shortUrl": "https://tudominio.com/abc123",
    "alias": "abc123",
    "originalUrl": "https://ejemplo.com/pagina-muy-larga",
    "createdAt": "2024-01-15T10:30:00Z",
    "expiresAt": null,
    "clicks": 0,
    "qrScans": 0
  }
}
```

### 2. `/api/url-shortener/redirect`
**Método:** GET  
**Descripción:** Redirige desde una URL acortada a la URL original

**Query Parameters:**
- `alias`: El alias de la URL acortada

**Response:**
- Redirección 302 a la URL original
- O 404 si el alias no existe
- O 410 si el link ha expirado

### 3. `/api/url-shortener/stats`
**Método:** GET  
**Descripción:** Obtiene estadísticas de una URL acortada

**Query Parameters:**
- `alias`: El alias de la URL acortada

**Response:**
```json
{
  "success": true,
  "data": {
    "alias": "abc123",
    "originalUrl": "https://ejemplo.com",
    "shortUrl": "https://tudominio.com/abc123",
    "clicks": 150,
    "qrScans": 25,
    "createdAt": "2024-01-15T10:30:00Z",
    "topReferrers": [...],
    "clicksByDay": [...]
  }
}
```

## Estructura de Base de Datos

### Colección: `shortUrls`

```javascript
{
  _id: ObjectId,
  alias: String, // único
  originalUrl: String,
  userId: String, // opcional
  createdAt: Date,
  expiresAt: Date, // opcional
  clicks: Number,
  qrScans: Number,
  analytics: [
    {
      timestamp: Date,
      ip: String,
      userAgent: String,
      referer: String
    }
  ]
}
```

## Variables de Entorno

```env
SHORT_DOMAIN=tudominio.com
DATABASE_URL=mongodb://...
# o
DATABASE_URL=postgresql://...
```

## Implementación Pendiente

1. **Conexión a Base de Datos**
   - MongoDB con Mongoose
   - O PostgreSQL con Prisma
   - O Vercel KV (Redis) para almacenamiento simple

2. **Validaciones**
   - Verificar que el alias no exista
   - Validar formato de URL
   - Rate limiting

3. **Features Adicionales**
   - Expiración de links
   - Contraseña para acceder
   - Píxeles de seguimiento
   - Redirección programada

4. **Seguridad**
   - Validar URLs maliciosas
   - Rate limiting por IP
   - Autenticación para usuarios

## Integración con Frontend

El frontend (`url-shortener.html`) está preparado para conectarse a estos endpoints. Solo necesita:

1. Actualizar la función `shortenForm.addEventListener('submit')` para hacer POST a `/api/url-shortener/shorten`
2. Actualizar `testLinkBtn` para usar `/api/url-shortener/redirect`
3. Actualizar las estadísticas para usar `/api/url-shortener/stats`
