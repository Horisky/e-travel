import os
import json
import secrets
import hashlib
from typing import Any, Dict, Optional

try:
    from psycopg_pool import ConnectionPool
except Exception:  # pragma: no cover
    ConnectionPool = None

DATABASE_URL = os.getenv('DATABASE_URL', '')
JWT_SECRET = os.getenv('JWT_SECRET', '')
JWT_EXPIRE_MINUTES = int(os.getenv('JWT_EXPIRE_MINUTES', '10080'))

_pool = None

def get_pool():
    global _pool
    if not DATABASE_URL:
        return None
    if _pool is None:
        if ConnectionPool is None:
            raise RuntimeError("psycopg_pool not installed")
        _pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=5)
    return _pool


def hash_password(password: str, salt: Optional[str] = None) -> Dict[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return {"salt": salt, "hash": dk.hex()}


def verify_password(password: str, salt: str, pw_hash: str) -> bool:
    calc = hash_password(password, salt)["hash"]
    return secrets.compare_digest(calc, pw_hash)


def create_user(email: str, password: str) -> None:
    pool = get_pool()
    if pool is None:
        raise RuntimeError("DATABASE_URL not set")
    pw = hash_password(password)
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into users (email, password_hash, password_salt)
                values (%s, %s, %s)
                """,
                (email.lower(), pw["hash"], pw["salt"]),
            )


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    pool = get_pool()
    if pool is None:
        return None
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select id, email, password_hash, password_salt from users where email=%s", (email.lower(),))
            row = cur.fetchone()
            if not row:
                return None
            return {"id": row[0], "email": row[1], "password_hash": row[2], "password_salt": row[3]}


def update_password(email: str, new_password: str) -> None:
    pool = get_pool()
    if pool is None:
        raise RuntimeError("DATABASE_URL not set")
    pw = hash_password(new_password)
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update users set password_hash=%s, password_salt=%s where email=%s",
                (pw["hash"], pw["salt"], email.lower()),
            )


def store_code(email: str, code: str, purpose: str) -> None:
    pool = get_pool()
    if pool is None:
        raise RuntimeError("DATABASE_URL not set")
    pw = hash_password(code)
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into auth_codes (email, code_hash, code_salt, purpose, expires_at)
                values (%s, %s, %s, %s, now() + interval '10 minutes')
                """,
                (email.lower(), pw["hash"], pw["salt"], purpose),
            )


def verify_code(email: str, code: str, purpose: str) -> bool:
    pool = get_pool()
    if pool is None:
        raise RuntimeError("DATABASE_URL not set")
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, code_hash, code_salt
                from auth_codes
                where email=%s and purpose=%s and expires_at > now()
                order by created_at desc limit 1
                """,
                (email.lower(), purpose),
            )
            row = cur.fetchone()
            if not row:
                return False
            code_ok = verify_password(code, row[2], row[1])
            if code_ok:
                cur.execute("delete from auth_codes where id=%s", (row[0],))
            return code_ok


def save_preferences(user_id: str, prefs: Dict[str, Any]) -> None:
    pool = get_pool()
    if pool is None:
        return
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into user_preferences (user_id, data)
                values (%s, %s)
                on conflict (user_id) do update set data=excluded.data, updated_at=now()
                """,
                (user_id, json.dumps(prefs, ensure_ascii=False)),
            )


def load_preferences(user_id: str) -> Optional[Dict[str, Any]]:
    pool = get_pool()
    if pool is None:
        return None
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select data from user_preferences where user_id=%s", (user_id,))
            row = cur.fetchone()
            if not row:
                return None
            data = row[0]
            if isinstance(data, (dict, list)):
                return data
            return json.loads(data)


def save_plan(user_id: str, plan: Dict[str, Any]) -> None:
    pool = get_pool()
    if pool is None:
        return
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into user_plans (user_id, data)
                values (%s, %s)
                """,
                (user_id, json.dumps(plan, ensure_ascii=False)),
            )
            cur.execute(
                """
                delete from user_plans
                where id in (
                    select id from user_plans
                    where user_id=%s
                    order by created_at desc offset 10
                )
                """,
                (user_id,),
            )


def save_search_history(user_id: str, query: Dict[str, Any], result: Dict[str, Any]) -> None:
    pool = get_pool()
    if pool is None:
        return
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into user_search_history (user_id, query, result)
                values (%s, %s, %s)
                """,
                (
                    user_id,
                    json.dumps(query, ensure_ascii=False),
                    json.dumps(result, ensure_ascii=False),
                ),
            )
            cur.execute(
                """
                delete from user_search_history
                where id in (
                    select id from user_search_history
                    where user_id=%s
                    order by created_at desc offset 10
                )
                """,
                (user_id,),
            )


def load_search_history(user_id: str, limit: int = 10) -> list[Dict[str, Any]]:
    pool = get_pool()
    if pool is None:
        return []
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, query, result, created_at
                from user_search_history
                where user_id=%s
                order by created_at desc
                limit %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall() or []
            items = []
            for row in rows:
                query = row[1]
                result = row[2]
                if isinstance(query, str):
                    query = json.loads(query)
                if isinstance(result, str):
                    result = json.loads(result)
                items.append(
                    {
                        "id": str(row[0]),
                        "query": query,
                        "result": result,
                        "created_at": row[3].isoformat() if row[3] else None,
                    }
                )
            return items
