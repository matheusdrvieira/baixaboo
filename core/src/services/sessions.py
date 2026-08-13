import base64
import hashlib
import hmac
import ipaddress
import secrets
import time

from fastapi import Request, Response

from ..config import settings
from ..errors import ServiceError

SESSION_COOKIE = "baixaboo_session"
SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
TRUSTED_PROXY_NETWORKS = tuple(
    ipaddress.ip_network(cidr)
    for cidr in (
        "127.0.0.0/8",
        "::1/128",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "fc00::/7",
    )
)


def session_for_request(request: Request) -> tuple[str, str | None]:
    session_id = read_session(request)
    if session_id is not None:
        return session_id, None

    session_id = secrets.token_urlsafe(32)
    issued_at = int(time.time())
    payload = f"{session_id}.{issued_at}"
    return session_id, f"{payload}.{signature(payload)}"


def require_session(request: Request) -> str:
    session_id = read_session(request)
    if session_id is None:
        raise ServiceError("unavailable", 404)
    return session_id


def read_session(request: Request) -> str | None:
    cookie = request.cookies.get(SESSION_COOKIE)
    if cookie is None:
        return None
    try:
        payload, received_signature = cookie.rsplit(".", 1)
        session_id, issued_at_text = payload.rsplit(".", 1)
        issued_at = int(issued_at_text)
    except (TypeError, ValueError):
        return None

    now = int(time.time())
    if not 32 <= len(session_id) <= 64:
        return None
    if issued_at > now + 60 or now - issued_at > SESSION_MAX_AGE_SECONDS:
        return None
    if not hmac.compare_digest(received_signature, signature(payload)):
        return None
    return session_id


def set_session_cookie(response: Response, value: str) -> None:
    secure = settings.frontend_url.scheme == "https"
    response.set_cookie(
        key=SESSION_COOKIE,
        value=value,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )


def client_ip(request: Request) -> str:
    direct_ip = request.client.host if request.client is not None else "unknown"
    normalized_direct_ip = normalize_ip(direct_ip)
    if normalized_direct_ip is None:
        return "unknown"
    if not is_trusted_proxy(normalized_direct_ip):
        return normalized_direct_ip

    forwarded_chain = forwarded_addresses(request)
    for address in reversed(forwarded_chain):
        if not is_trusted_proxy(address):
            return address
    return forwarded_chain[0] if forwarded_chain else normalized_direct_ip


def forwarded_addresses(request: Request) -> list[str]:
    forwarded = request.headers.get("Forwarded")
    if forwarded:
        addresses = [
            address
            for entry in forwarded.split(",")
            if (address := forwarded_for_address(entry)) is not None
        ]
        if addresses:
            return addresses

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        addresses = [
            normalized
            for value in forwarded_for.split(",")
            if (normalized := normalize_ip(value)) is not None
        ]
        if addresses:
            return addresses

    real_ip = request.headers.get("X-Real-IP")
    normalized_real_ip = normalize_ip(real_ip) if real_ip else None
    return [normalized_real_ip] if normalized_real_ip is not None else []


def forwarded_for_address(entry: str) -> str | None:
    for parameter in entry.split(";"):
        key, separator, value = parameter.strip().partition("=")
        if separator and key.lower() == "for":
            candidate = value.strip().strip('"')
            if candidate.startswith("[") and "]" in candidate:
                candidate = candidate[1:candidate.index("]")]
            elif candidate.count(":") == 1:
                candidate = candidate.rsplit(":", 1)[0]
            return normalize_ip(candidate)
    return None


def is_trusted_proxy(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return any(
        address.version == network.version and address in network
        for network in TRUSTED_PROXY_NETWORKS
    )


def normalize_ip(value: str) -> str | None:
    try:
        return ipaddress.ip_address(value.strip()).compressed
    except ValueError:
        return None


def signature(payload: str) -> str:
    digest = hmac.new(
        settings.session_secret.get_secret_value().encode(),
        payload.encode(),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")
