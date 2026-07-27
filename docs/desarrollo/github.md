# Subir RRHH Mossaspa a GitHub

Repositorio creado:

`https://github.com/CristianRamirezSoto/RRHH-Mossa-SpA.git`

## Importante

No subir `.env.local`. Ya esta protegido por `.gitignore`.

## Pasos despues de instalar Git

Desde la carpeta del proyecto:

```powershell
git init
git add .
git commit -m "Publicacion inicial RRHH Mossaspa"
git branch -M main
git remote add origin https://github.com/CristianRamirezSoto/RRHH-Mossa-SpA.git
git push -u origin main
```

Si el remote ya existe:

```powershell
git remote set-url origin https://github.com/CristianRamirezSoto/RRHH-Mossa-SpA.git
git push -u origin main
```

## Despues de subir

1. Entrar a Vercel.
2. Importar el repositorio `RRHH-Mossa-SpA`.
3. Agregar variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_DOCUMENT_BUCKET`
   - `VITE_ADMIN_EMAIL`
   - `VITE_HR_WHATSAPP_NUMBER`
4. Deploy.
5. Copiar la URL final.
6. Agregar esa URL en Supabase Auth:
   - `Authentication > URL Configuration > Site URL`
   - `Authentication > URL Configuration > Redirect URLs`
