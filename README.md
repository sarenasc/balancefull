# balancefull
modernizacion de balance

## Despliegue actual

- Frontend: `http://172.20.20.5:3000`
- Backend API: `http://172.20.20.5:4001/api`

El frontend dockerizado consume la API publicada en `172.20.20.5:4001`, no en `localhost`. Si cambias la IP o el host del backend, actualiza en conjunto:

- `.env`
- `docker-compose.yaml`
- `docker/40-env-config.sh`

Luego reconstruye:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```
