"""
Automated Robinhood MCP Token Refresh Manager.

Proactively monitors access token expiration and silently rotates tokens
against https://api.robinhood.com/oauth2/token/ using the OAuth 2.1 refresh_token.
Ensures unattended autonomous trading pipelines never expire or trip circuit breakers.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import time
from typing import Any, Dict, Optional

import requests

from trading import config
from trading.live_auth import get_token_storage

logger = logging.getLogger("TokenRefresh")

ROBINHOOD_TOKEN_ENDPOINT = "https://api.robinhood.com/oauth2/token/"


def get_jwt_exp(jwt_token: str) -> Optional[float]:
    """Decodes the JWT payload to extract the standard 'exp' timestamp."""
    try:
        parts = jwt_token.split(".")
        if len(parts) >= 2:
            padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded))
            exp = payload.get("exp")
            if exp:
                return float(exp)
    except Exception as e:
        logger.debug(f"Could not parse JWT exp claim: {e}")
    return None


def get_token_status() -> Dict[str, Any]:
    """Evaluates stored token validity and expiration without making network calls."""
    storage = get_token_storage()
    data = storage._read_data()
    tokens = data.get("tokens") or {}
    if not tokens and (data.get("access_token") or data.get("accessToken")):
        tokens = data

    access_token = tokens.get("access_token") or tokens.get("accessToken")
    refresh_token = tokens.get("refresh_token") or tokens.get("refreshToken")
    client_info = data.get("client_info") or {}
    client_id = client_info.get("client_id") or client_info.get("clientId")

    if not access_token:
        return {
            "has_token": False,
            "expired": True,
            "seconds_remaining": 0,
            "can_refresh": False,
            "reason": "No access_token found in storage"
        }

    now = time.time()
    exp = get_jwt_exp(access_token)

    if not exp and "expires_at" in tokens:
        exp_ms = tokens["expires_at"]
        exp = exp_ms / 1000.0 if exp_ms > 1e11 else exp_ms

    if not exp:
        saved_at = data.get("tokens_saved_at") or 0
        expires_in = tokens.get("expires_in") or 86400
        if saved_at:
            exp = saved_at + expires_in

    seconds_remaining = max(0, int(exp - now)) if exp else 0
    is_expired = now >= exp if exp else False

    return {
        "has_token": True,
        "expired": is_expired,
        "expires_at_epoch": exp,
        "seconds_remaining": seconds_remaining,
        "can_refresh": bool(refresh_token and client_id),
        "refresh_token_available": bool(refresh_token),
        "client_id": client_id,
        "token_path": storage.token_path
    }


def refresh_tokens_now() -> Dict[str, Any]:
    """
    Directly exchanges the stored refresh_token for a fresh access_token + refresh_token pair
    via Robinhood's authoritative OAuth 2.1 token endpoint.
    Persists updated tokens across all candidate storage locations.
    """
    storage = get_token_storage()
    data = storage._read_data()
    tokens = data.get("tokens") or {}
    if not tokens and (data.get("access_token") or data.get("accessToken")):
        tokens = data

    refresh_token = tokens.get("refresh_token") or tokens.get("refreshToken")
    client_info = data.get("client_info") or {}
    client_id = client_info.get("client_id") or client_info.get("clientId")

    if not refresh_token:
        err = "Cannot refresh tokens: No refresh_token found in storage."
        logger.error(err)
        return {"success": False, "error": err, "reauth_required": True}

    if not client_id:
        err = "Cannot refresh tokens: No client_id found in storage."
        logger.error(err)
        return {"success": False, "error": err, "reauth_required": True}

    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
    }

    try:
        logger.info(f"Dispatching silent OAuth refresh to {ROBINHOOD_TOKEN_ENDPOINT}...")
        resp = requests.post(ROBINHOOD_TOKEN_ENDPOINT, data=payload, timeout=15)
        
        if resp.status_code == 200:
            new_data = resp.json()
            new_access = new_data.get("access_token")
            new_refresh = new_data.get("refresh_token") or refresh_token
            expires_in = new_data.get("expires_in", 86400)

            # Update in-memory storage dictionary
            if "tokens" in data and isinstance(data["tokens"], dict):
                data["tokens"]["access_token"] = new_access
                data["tokens"]["refresh_token"] = new_refresh
                data["tokens"]["expires_in"] = expires_in
                data["tokens"]["token_type"] = new_data.get("token_type", "Bearer")
                data["tokens"]["scope"] = new_data.get("scope", "internal")
            else:
                data["access_token"] = new_access
                data["refresh_token"] = new_refresh
                data["expires_in"] = expires_in
                data["token_type"] = new_data.get("token_type", "Bearer")

            data["tokens_saved_at"] = time.time()

            # Save to primary storage path
            storage._write_data(data)

            # Mirror to workspace _data folder to ensure Docker and IDE sync
            workspace_paths = [
                os.path.join(config.LIVE_DATA_DIR, "robinhood_oauth.json"),
                os.path.join(config.PROJECT_ROOT, "_data", "robinhood_oauth.json"),
            ]
            for wp in workspace_paths:
                try:
                    os.makedirs(os.path.dirname(wp), exist_ok=True)
                    with open(wp, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                except Exception as e:
                    logger.debug(f"Could not mirror refreshed token to {wp}: {e}")

            new_exp = get_jwt_exp(new_access)
            logger.info(f"OAuth token refreshed successfully! Next expiry: {new_exp} ({expires_in}s TTL).")
            return {
                "success": True,
                "message": "Token refreshed successfully.",
                "expires_in": expires_in,
                "reauth_required": False
            }
        else:
            err_msg = f"Robinhood token endpoint rejected refresh (HTTP {resp.status_code}): {resp.text}"
            logger.error(err_msg)
            # 400 or 401 with invalid_grant means user must re-login
            reauth = resp.status_code in (400, 401)
            return {"success": False, "error": err_msg, "reauth_required": reauth}

    except Exception as e:
        err_msg = f"Network or execution error refreshing token: {e}"
        logger.error(err_msg, exc_info=True)
        return {"success": False, "error": err_msg, "reauth_required": False}


def ensure_valid_token(buffer_seconds: int = 7200) -> Dict[str, Any]:
    """
    Checks if token is expiring within buffer_seconds (default 2 hours).
    If expiring or expired, automatically executes silent refresh.
    Returns status dict indicating whether a valid token is guaranteed ready.
    """
    status = get_token_status()
    
    if not status.get("has_token"):
        return {
            "valid": False,
            "action": "NONE",
            "message": "No tokens stored. Interactive login required.",
            "reauth_required": True
        }

    # If token has more than buffer_seconds left, it is fully valid
    if not status.get("expired") and status.get("seconds_remaining", 0) > buffer_seconds:
        return {
            "valid": True,
            "action": "NONE",
            "seconds_remaining": status.get("seconds_remaining"),
            "reauth_required": False
        }

    # Token is expired or approaching expiry -> Refresh it
    logger.info(f"Token is expiring or expired ({status.get('seconds_remaining')}s remaining). Triggering proactive refresh...")
    refresh_res = refresh_tokens_now()
    
    if refresh_res.get("success"):
        return {
            "valid": True,
            "action": "REFRESHED",
            "message": "Token refreshed successfully.",
            "reauth_required": False
        }
    else:
        return {
            "valid": False,
            "action": "FAILED_REFRESH",
            "error": refresh_res.get("error"),
            "reauth_required": refresh_res.get("reauth_required", False)
        }
