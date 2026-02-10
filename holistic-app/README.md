# Holistic Marketing App

Dashboard de clientes, gastos, cobros y garantías. Incluye landing de Crédito en `/credito`.

## Desarrollo local

```bash
cd holistic-app
npm install
npm run dev
```

## Deploy en Vercel (subdominio separado)

1. **Opción A – Proyecto separado en Vercel**
   - Crea un nuevo proyecto en [vercel.com](https://vercel.com)
   - Conecta el mismo repo
   - En **Settings → General → Root Directory** pon: `holistic-app`
   - Deploy
   - Añade el dominio `app.marketingconholistic.com` (o el subdominio que uses)

2. **Opción B – Monorepo**
   - Si el repo raíz ya está en Vercel, crea un segundo proyecto apuntando al mismo repo
   - Root Directory: `holistic-app`
   - Build: automático (Vite)

## Rutas

- `/` — Dashboard
- `/credito` — Landing de Crédito
