#!/usr/bin/env python3
"""Regressioni leggere per il configuratore delle utenze dashboard."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "provisioning/bin/configure-dashboard-users.py"
SPEC = importlib.util.spec_from_file_location("configure_dashboard_users", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def generated(username: str) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess([], 0, stdout=f"{username}:$2y$05$hash\n", stderr="")


class DashboardUsersCheck(unittest.TestCase):
    def invoke(self, destination: str, passwords: list[str], results: list[object]) -> int:
        with (
            patch.object(MODULE.os, "geteuid", return_value=0),
            patch.object(MODULE, "command_path", return_value="/usr/bin/htpasswd"),
            patch.object(MODULE.sys, "argv", [str(SCRIPT), destination]),
            patch.object(MODULE.getpass, "getpass", side_effect=passwords),
            patch.object(MODULE.subprocess, "run", side_effect=results),
        ):
            return MODULE.main()

    def test_fresh_then_existing(self) -> None:
        with tempfile.TemporaryDirectory() as destination:
            self.assertEqual(
                self.invoke(
                    destination,
                    ["Exercise123", "Exercise123", "Event456", "Event456"],
                    [generated("esercizio"), generated("evento")],
                ),
                0,
            )
            tfvars = Path(destination) / "dashboard_users.tfvars.json"
            self.assertEqual(
                json.loads(tfvars.read_text(encoding="utf-8")),
                {
                    "utenze_esercizio": {"esercizio": "Exercise123"},
                    "utenze_evento": {"evento": "Event456"},
                },
            )
            self.assertEqual(tfvars.stat().st_mode & 0o777, 0o400)
            self.assertEqual(
                self.invoke(
                    destination,
                    ["Exercise123", "Event456"],
                    [subprocess.CompletedProcess([], 0), subprocess.CompletedProcess([], 0)],
                ),
                0,
            )

    def test_second_password_failure_leaves_no_partial_files(self) -> None:
        with tempfile.TemporaryDirectory() as destination:
            with self.assertRaises(SystemExit):
                self.invoke(
                    destination,
                    ["Exercise123", "Exercise123", "Event456", "different"],
                    [generated("esercizio")],
                )
            self.assertEqual(list(Path(destination).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
