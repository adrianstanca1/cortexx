# Encrypted environment vault

This repo stores its environment variables in an encrypted file: `.env.vault`.
It is encrypted with [age](https://github.com/FiloSottile/age) and can only be
decrypted with the private key kept at `~/.config/cortexx/age.key` on the VPS.

## Why?

- `.env` itself is gitignored and never committed.
- The encrypted `.env.vault` can be committed or backed up safely without
  exposing secrets.
- The private age key lives outside the repo, so a leaked repo clone is useless
  without the key.

## Quick commands

```bash
# Decrypt .env.vault into .env in the repo root
npm run vault:decrypt

# Or decrypt to a specific path
./scripts/decrypt-env.sh /path/to/.env

# Load secrets into the current shell (useful for one-off commands)
eval "$(npm run vault:load --silent)"
```

## How it works

1. `.env.vault` is an age-encrypted file containing all environment variables.
2. `scripts/decrypt-env.sh` decrypts it to `.env` using the private key at
   `~/.config/cortexx/age.key`.
3. `scripts/load-env.sh` decrypts it and emits `export KEY="value"` lines so
   they can be sourced into a shell.

## Adding or changing a secret

```bash
# Decrypt to a temp file
age -d -i ~/.config/cortexx/age.key -o .env.tmp .env.vault

# Edit .env.tmp
nano .env.tmp

# Re-encrypt
age -r $(age-keygen -y ~/.config/cortexx/age.key) -o .env.vault .env.tmp

# Securely delete the temp file
shred -u .env.tmp
```

## Security notes

- Never commit `.env`, `.env.local`, `.env.*.local`, or `*.age.key`.
- Back up `~/.config/cortexx/age.key` to a password manager or offline backup.
  If you lose this key, the vault cannot be decrypted.
- Rotating a leaked secret still requires updating GitHub/app dashboards and
  then re-encrypting the vault. Encryption does not revoke a secret that has
  already been exposed.
