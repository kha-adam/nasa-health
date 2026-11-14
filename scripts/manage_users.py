#!/usr/bin/env python3
"""Manage Project BLUE login accounts (backend/data/users.json).

    python scripts/manage_users.py init                 # (re)create the demo accounts
    python scripts/manage_users.py set-password vance   # prompt for a new password
    python scripts/manage_users.py list

The demo passwords below are public (they are in the README). Change them with
``set-password`` before showing the app to anyone outside the team.
"""

from __future__ import annotations

import argparse
import getpass
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from core.auth import USERS_PATH, hash_password  # noqa: E402

DEMO_ACCOUNTS = [
    {"username": "vance", "display_name": "Cmdr. Elena Vance", "role": "astronaut", "astronaut_id": "astro-vance",
     "password": "blue-vance-2035"},
    {"username": "chen", "display_name": "Eng. Marcus Chen", "role": "astronaut", "astronaut_id": "astro-chen",
     "password": "blue-chen-2035"},
    {"username": "lin", "display_name": "Spec. Maya Lin", "role": "astronaut", "astronaut_id": "astro-lin",
     "password": "blue-lin-2035"},
    {"username": "surgeon", "display_name": "Flight Surgeon · Mission Control", "role": "flight_surgeon",
     "astronaut_id": None, "password": "blue-surgeon-2035"},
]


def write(users: list[dict]) -> None:
    USERS_PATH.write_text(json.dumps(users, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init")
    sub.add_parser("list")
    sp = sub.add_parser("set-password")
    sp.add_argument("username")
    args = parser.parse_args()

    if args.cmd == "init":
        users = []
        for a in DEMO_ACCOUNTS:
            entry = {k: v for k, v in a.items() if k != "password"}
            entry["password_hash"] = hash_password(a["password"])
            users.append(entry)
        write(users)
        print(f"[ok] wrote {len(users)} demo accounts to {USERS_PATH}")
        return

    users = json.loads(USERS_PATH.read_text())
    if args.cmd == "list":
        for u in users:
            print(f"{u['username']:10s} {u['role']:15s} {u.get('astronaut_id') or '-':12s} {u['display_name']}")
        return

    match = next((u for u in users if u["username"] == args.username.lower()), None)
    if match is None:
        raise SystemExit(f"unknown user {args.username}")
    pw = getpass.getpass("New password: ")
    if len(pw) < 10:
        raise SystemExit("password must be at least 10 characters")
    if pw != getpass.getpass("Repeat: "):
        raise SystemExit("passwords do not match")
    match["password_hash"] = hash_password(pw)
    write(users)
    print(f"[ok] password updated for {match['username']}")


if __name__ == "__main__":
    main()
