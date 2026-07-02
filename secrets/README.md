# Secrets

Runtime secrets are not stored in plain text.

Recommended flow:

```bash
cp .env.example .env
# edit .env for local development
```

For shared or production values, use SOPS with age:

```bash
cp .sops.yaml.example .sops.yaml
# replace the age recipient in .sops.yaml
sops --encrypt .env > secrets/prod.enc.env
sops --decrypt secrets/prod.enc.env > .env
```

Keep age private keys outside the repository. Use one recipient per developer or
deployment target so access can be rotated without rewriting the whole project.
