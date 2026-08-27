# deploy-field

Add or repair a public route for the field app (or any PM2/host-port app) on
this VPS.

## When to use

- `field.cortexbuildpro.com` returns 404 or 502.
- You want to expose a new host-port app at a public domain.
- You need to change the upstream port or domain of an existing app.

## Steps

1. Verify the upstream service is listening on the expected port:
   ```bash
   ss -tlnp | grep ':3005'
   curl -s http://127.0.0.1:3005/api/health
   ```

2. Create or edit the file-provider router:
   ```bash
   # /docker/traefik/conf/field.yml
   http:
     routers:
       field:
         rule: "Host(`field.cortexbuildpro.com`)"
         entryPoints: [websecure]
         service: field
         tls: { certResolver: letsencrypt }
     services:
       field:
         loadBalancer:
           servers:
             - url: "http://127.0.0.1:3005"
   ```

3. Validate Traefik can load the file provider (it watches the directory live):
   ```bash
   docker exec traefik-traefik-1 traefik healthcheck
   ```

4. Test the public edge:
   ```bash
   curl -sI https://field.cortexbuildpro.com/api/health
   ```

## Notes

- Traefik's file provider is watched automatically; a container restart is
  normally not required.
- If **every** public route returns 502, Traefik may have a stale Docker socket
  bind mount. Restart it: `docker restart traefik-traefik-1`.
- PM2 apps use `ecosystem.config.cjs`; reload with:
  `pm2 reload cortexbuild-field --update-env`.
