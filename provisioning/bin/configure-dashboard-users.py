#!/usr/bin/env python3
"""Allinea le credenziali delle dashboard fra Traefik e Terraform.

Le password non possono essere ricavate dagli htpasswd. Questo comando le
chiede senza eco, verifica quelle gia' distribuite al bordo e scrive la copia
root-only che Terraform usa per creare le stesse utenze in Elasticsearch.
Su una nuova installazione crea anche gli htpasswd mancanti.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from typing import NoReturn


AUDIENCES = {
    "esercizio": "esercizio",
    "evento": "evento",
}


def fail(message: str) -> NoReturn:
    print(f"errore: {message}", file=sys.stderr)
    raise SystemExit(1)


def read_entries(path: Path) -> list[tuple[str, str]]:
    if not path.is_file() or path.stat().st_size == 0:
        return []
    entries: list[tuple[str, str]] = []
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw:
            continue
        if ":" not in raw:
            fail(f"riga {number} non valida in {path}")
        username, digest = raw.split(":", 1)
        if not username or not digest or any(c in username for c in ':\r\n'):
            fail(f"riga {number} non valida in {path}")
        if any(existing == username for existing, _ in entries):
            fail(f"utenza duplicata {username} in {path}")
        entries.append((username, raw))
    if not entries:
        fail(f"nessuna utenza valida in {path}")
    return entries


def password_for_existing(path: Path, username: str) -> str:
    password = getpass.getpass(f"Password dashboard {username}: ")
    check = subprocess.run(
        ["htpasswd", "-vi", str(path), username],
        input=password + "\n",
        text=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if check.returncode != 0:
        fail(f"la password non corrisponde a {username} in {path}")
    return password


def password_and_hash_for_new(username: str) -> tuple[str, str]:
    password = getpass.getpass(f"Nuova password dashboard {username}: ")
    confirmation = getpass.getpass(f"Ripeti la password dashboard {username}: ")
    if not password:
        fail(f"password vuota per {username}")
    if password != confirmation:
        fail(f"le password di {username} non coincidono")
    result = subprocess.run(
        ["htpasswd", "-niB", username],
        input=password + "\n",
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0 or ":" not in result.stdout:
        fail(f"generazione htpasswd fallita per {username}")
    return password, result.stdout.strip()


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o400)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def command_path(command: str) -> str | None:
    for directory in os.environ.get("PATH", os.defpath).split(os.pathsep):
        candidate = Path(directory) / command
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Crea o verifica gli utenti dashboard e genera le variabili Terraform"
    )
    parser.add_argument("secrets_dir", type=Path)
    args = parser.parse_args()

    if os.geteuid() != 0:
        fail("eseguire con sudo per mantenere i file leggibili solo da root")
    if not command_path("htpasswd"):
        fail("htpasswd non installato (pacchetto apache2-utils)")

    args.secrets_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(args.secrets_dir, 0o700)

    variables: dict[str, dict[str, str]] = {}
    audience_lines: dict[str, list[str]] = {}
    audience_paths: dict[str, Path] = {}
    missing_htpasswd: set[str] = set()
    changed_htpasswd = False

    for audience, default_username in AUDIENCES.items():
        path = args.secrets_dir / f"dashboard_users_{audience}"
        audience_paths[audience] = path
        entries = read_entries(path)
        values: dict[str, str] = {}
        lines: list[str] = []
        if entries:
            for username, line in entries:
                values[username] = password_for_existing(path, username)
                lines.append(line)
        else:
            password, line = password_and_hash_for_new(default_username)
            values[default_username] = password
            lines.append(line)
            missing_htpasswd.add(audience)
        variables[f"utenze_{audience}"] = values
        audience_lines[audience] = lines

    duplicated = set(variables["utenze_esercizio"]) & set(variables["utenze_evento"])
    if duplicated:
        fail("utenze presenti in entrambe le platee: " + ", ".join(sorted(duplicated)))

    # Nessun file viene cambiato finche' tutte le password non sono state
    # raccolte e verificate: un errore sulla seconda platea non deve lasciare
    # la prima configurata a meta'.
    for audience in missing_htpasswd:
        atomic_write(audience_paths[audience], "\n".join(audience_lines[audience]) + "\n")
        changed_htpasswd = True

    union = audience_lines["esercizio"] + audience_lines["evento"]
    union_path = args.secrets_dir / "dashboard_users"
    expected_union = "\n".join(union) + "\n"
    current_union = union_path.read_text(encoding="utf-8") if union_path.is_file() else ""
    if current_union != expected_union:
        atomic_write(union_path, expected_union)
        changed_htpasswd = True

    tfvars_path = args.secrets_dir / "dashboard_users.tfvars.json"
    atomic_write(tfvars_path, json.dumps(variables, indent=2, ensure_ascii=False) + "\n")

    print(f"creato {tfvars_path} (0400, password non mostrate)")
    if changed_htpasswd:
        print("gli htpasswd sono cambiati: riapplicare lo stack prima del bootstrap")
    else:
        print("htpasswd invariati: e' sufficiente rieseguire fleet-bootstrap.service")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
