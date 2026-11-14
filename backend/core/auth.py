"""Login, sessions and access rules for Project BLUE.

* Accounts live in ``backend/data/users.json`` (override with BLUE_USERS_FILE)
  with PBKDF2-SHA256 password hashes — no database. Use
  ``scripts/manage_users.py`` to change passwords.
* Sessions are random tokens kept in process memory and sent as an httpOnly,
  SameSite=Lax cookie. Restarting the server logs everyone out.
* Repeated failed logins lock the username for a few minutes.

Access rules (enforced server-side on every route):
* an astronaut sees only their own profile, telemetry, BLUE chats and reports;
* a flight surgeon sees every crew member's physical and environment data but
  never mental-health reports, mental highlights or private (behavioural)
  metrics, and cannot talk to BLUE on anyone's behalf.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from schemas import SessionUser

USERS_PATH = Path(os.environ.get("BLUE_USERS_FILE", Path(__file__).resolve().parent.parent / "data" / "users.json"))

COOKIE_NAME = "blue_session"
SESSION_TTL_S = int(os.environ.get("BLUE_SESSION_TTL_S", 8 * 3600))
MAX_FAILURES = 5
FAILURE_WINDOW_S = 300
LOCKOUT_S = 300
PBKDF2_ITERATIONS = 200_000


# --------------------------------------------------------------------------
# Password hashing
# --------------------------------------------------------------------------


def hash_password(password: str, *, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"pbkdf2_sha256${iterations}${b64(salt)}${b64(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algo, iters, salt_b64, hash_b64 = encoded.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(hash_b64)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iters))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest, expected)


# Verified against when the username is unknown so response time doesn't reveal it.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16), iterations=PBKDF2_ITERATIONS)


# --------------------------------------------------------------------------
# Accounts
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Account:
    user: SessionUser
    password_hash: str


_accounts: dict[str, Account] = {}


def load_users(path: Path = USERS_PATH) -> None:
    raw = json.loads(path.read_text())
    _accounts.clear()
    for item in raw:
        user = SessionUser(
            username=item["username"].lower(),
            display_name=item["display_name"],
            role=item["role"],
            astronaut_id=item.get("astronaut_id"),
        )
        if user.role == "astronaut" and user.astronaut_id is None:
            raise ValueError(f"astronaut account {user.username} has no astronaut_id")
        _accounts[user.username] = Account(user=user, password_hash=item["password_hash"])


# --------------------------------------------------------------------------
# Login throttling
# --------------------------------------------------------------------------


class LockedOut(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after


_lock = threading.Lock()
_failures: dict[str, list[float]] = {}
_locked_until: dict[str, float] = {}


def _check_lock(username: str, now: float) -> None:
    until = _locked_until.get(username, 0)
    if until > now:
        raise LockedOut(int(until - now) + 1)


def _record_failure(username: str, now: float) -> None:
    recent = [t for t in _failures.get(username, []) if now - t < FAILURE_WINDOW_S]
    recent.append(now)
    _failures[username] = recent
    if len(recent) >= MAX_FAILURES:
        _locked_until[username] = now + LOCKOUT_S
        _failures.pop(username, None)


def authenticate(username: str, password: str) -> SessionUser | None:
    """Return the user for valid credentials. Raises LockedOut when throttled."""
    key = username.strip().lower()
    now = time.monotonic()
    with _lock:
        _check_lock(key, now)
    account = _accounts.get(key)
    ok = verify_password(password, account.password_hash if account else _DUMMY_HASH) and account is not None
    with _lock:
        if not ok:
            _record_failure(key, now)
            return None
        _failures.pop(key, None)
    return account.user


# --------------------------------------------------------------------------
# Sessions
# --------------------------------------------------------------------------

_sessions: dict[str, tuple[SessionUser, float]] = {}


def create_session(user: SessionUser) -> str:
    token = secrets.token_urlsafe(32)
    with _lock:
        now = time.time()
        for t in [t for t, (_, exp) in _sessions.items() if exp <= now]:
            del _sessions[t]
        _sessions[token] = (user, now + SESSION_TTL_S)
    return token


def session_user(token: str | None) -> SessionUser | None:
    if not token:
        return None
    with _lock:
        entry = _sessions.get(token)
        if entry is None:
            return None
        user, expires = entry
        if expires <= time.time():
            del _sessions[token]
            return None
        return user


def end_session(token: str | None) -> None:
    if token:
        with _lock:
            _sessions.pop(token, None)


def reset_state() -> None:
    """Testing helper: forget sessions and throttling."""
    with _lock:
        _sessions.clear()
        _failures.clear()
        _locked_until.clear()


# --------------------------------------------------------------------------
# Access rules
# --------------------------------------------------------------------------


def can_view(user: SessionUser, astronaut_id: str) -> bool:
    if user.role == "flight_surgeon":
        return True
    return user.astronaut_id == astronaut_id


def can_see_private(user: SessionUser, astronaut_id: str) -> bool:
    """Mental-health reports, BLUE chats and behavioural metrics."""
    return user.role == "astronaut" and user.astronaut_id == astronaut_id


if USERS_PATH.exists():
    load_users()
