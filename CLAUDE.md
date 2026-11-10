# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Backend Express 5 + Socket.IO + PostgreSQL para una app de registro de horas/gastos (clientes → centros → proyectos → registros de usuarios). Proyecto ESM (`"type": "module"`), sin build, sin linter y sin tests (`npm test` solo falla a propósito). El código, los nombres y los mensajes de error están en español.

## Comandos

- Arrancar en local: `node .` (entrada `index.js`, puerto `process.env.port` o `8081`).
- Para que las cookies funcionen sobre HTTP en local hay que poner `NODE_ENV=development` (si no, se emiten con `secure:true`).
- Docker: `docker build -t backend .` y luego el comando de `docker.txt` (mapea `8080:8081`, usa `DB_HOST=host.docker.internal` y `--env-file .env`).
- Probar endpoints a mano: `.request.rest` (extensión REST Client). Usa `8081` para local y `8080` para el contenedor.

## Configuración (`.env`)

`JWT_SECRET`, `JWT_SECRET_REFRESH`, `PASSWORD` (Postgres), `REGISTER_KEY`, `EMAIL_PASS`, `TURNSTILE_SECRET`, `DB_HOST` (opcional, por defecto `localhost`). La BD es fija: usuario `postgres`, base `grp`, puerto 5432 (`conexion.js`). A `PASSWORD` y `EMAIL_PASS` se les quitan las comillas simples con `replaceAll`.

## Arquitectura

- **`index.js`**: monta todo bajo el prefijo `/webapi/`. Define directamente los endpoints públicos/de auth (`register`, `login`, `usuario`, `refresh`, `gmail`, `recuperar`, `comprobar`, `cambiarclave`, `logout`), el servido estático de `uploads/perfiles` y los routers de `routes/`. Los limitadores de `express-rate-limit` (global y estricto) solo cuentan peticiones fallidas.
- **Routers (`routes/*.js`)**: se montan con middleware en `index.js`:
  - `clientes`, `centros`, `proyectos` → `authenticate, admin` (`admin` deja pasar los GET a cualquiera, pero exige administrador para el resto de métodos).
  - `registros`, `usuarios` → solo `authenticate`; cada handler comprueba si `req.user.administrador` o si el recurso es del propio usuario.
- **Autenticación (`funciones.js`)**: `jwtear()` firma un access token de 15 min y un refresh de 7 días, con payload `{id}`. `authenticate` acepta la cookie `token` o `Authorization: Bearer`, y en cada petición vuelve a leer `id, administrador` de la BD (solo usuarios con `operativo=true`). Los clientes de navegador (los que mandan cabecera `Origin`) reciben los tokens como cookies httpOnly; los demás los reciben en el JSON. La recuperación de contraseña usa JWT de un solo propósito (`authenticate_email`) que llevan un HMAC del código enviado por email.
- **Tiempo real (`conexion.js` + `socket.js`)**: un `pg.Client` aparte hace `LISTEN cambios`. Los triggers de la BD (no están en este repo) publican `{tabla, operacion, datos}` y el listener reenvía el evento por Socket.IO como `"<operacion>-<tabla>"` (por ejemplo `insert-registros`). Salas: cada socket entra en la sala de su `user.id` y los admins además en `administradores`. Los cambios de `registros`/`usuarios` solo van a los admins y al usuario afectado; los cambios de `usuarios` también mueven sockets dentro o fuera de `administradores`. Socket.IO va en la ruta `/webapi/socket.io`, solo con transporte websocket.
- **Fechas**: `adaptar()` reformatea las columnas `inicio`/`fin` a `YYYY-MM-DDTHH:mm` (hora local) antes de responder; los endpoints `.../ccpu` formatean en SQL con `to_char`. El tipo `numeric` (OID 1700) se convierte a float de forma global.
- **Convención de rutas**: el sufijo `/abierto-cerrado` devuelve también los elementos cerrados (`proyectos.fin` no nulo, usuarios no operativos); la versión sin sufijo filtra solo los abiertos/activos. `ccpu` = respuesta con joins a cliente, centro, proyecto y usuario.
- **Reglas de contraseña**: `comprobarClave()` (8 o más caracteres, mayúsculas y minúsculas, dígito, símbolo, sin espacios). Además no puede coincidir con la contraseña de ningún otro usuario (se compara con bcrypt contra todas). El primer usuario que se registra queda como administrador.
- Las fotos de perfil se suben con multer a `uploads/perfiles/` y se sirven en `/webapi/perfiles/<archivo>`.

## Notas

- Los orígenes CORS están repetidos en `index.js` y `socket.js`; hay que mantenerlos sincronizados.
- `node_modules/` está versionado en git.
