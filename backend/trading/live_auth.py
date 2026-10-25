"""
Robinhood MCP OAuth 2.1 + PKCE Authentication & Token Manager.

Implements the official Python MCP SDK ``OAuthClientProvider`` and ``TokenStorage``
interface for unattended authentication and automatic token refresh against
https://agent.robinhood.com/mcp/trading.

Tokens are stored outside the repository at:
    %USERPROFILE%\\.strategicalpha\\robinhood_oauth.json
"""

from __future__ import annotations

import asyncio
import http.server
import json
import logging
import os
import sys
import threading
import time
import urllib.parse
import webbrowser
from typing import Any, Dict, Optional

from pydantic import AnyUrl

from mcp.client.auth.oauth2 import (
    AuthorizationCodeResult,
    OAuthClientProvider,
    TokenStorage,
)
from mcp.shared.auth import (
    OAuthClientInformationFull,
    OAuthClientMetadata,
    OAuthToken,
)

from trading import config
from trading import state

logger = logging.getLogger("LiveAuth")


class FileTokenStorage(TokenStorage):
    """
    Implements the MCP SDK TokenStorage protocol, persisting OAuth tokens and
    dynamic client registration data to an external secure file.
    """

    def __init__(self, token_path: Optional[str] = None):
        self.token_path = token_path or config.get_settings().token_path

    def _ensure_dir(self) -> None:
        folder = os.path.dirname(self.token_path)
        os.makedirs(folder, exist_ok=True)

    def _find_mcp_remote_files(self) -> tuple[Optional[str], Optional[str]]:
        import glob
        mcp_auth_dir = os.path.expanduser("~/.mcp-auth/mcp-remote-v1")
        if not os.path.exists(mcp_auth_dir):
            return None, None
        tf = glob.glob(os.path.join(mcp_auth_dir, "*_tokens.json"))
        cf = glob.glob(os.path.join(mcp_auth_dir, "*_client_info.json"))
        return (tf[0] if tf else None, cf[0] if cf else None)

    def _read_data(self) -> Dict[str, Any]:
        candidates = [
            self.token_path,
            os.path.expanduser("~/.strategicalpha/robinhood_oauth.json"),
            "/root/.strategicalpha/robinhood_oauth.json",
        ]
        target = next((p for p in candidates if p and os.path.exists(p)), None)
        if not target:
            return {}
        try:
            with open(target, "r", encoding="utf-8") as f:
                return json.load(f) or {}
        except Exception as e:
            logger.error(f"Failed to read token file {target}: {e}")
            return {}

    def _write_data(self, data: Dict[str, Any]) -> None:
        self._ensure_dir()
        tmp = self.token_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, self.token_path)
        try:
            os.chmod(self.token_path, 0o600)
        except Exception:
            pass

    async def get_tokens(self) -> Optional[OAuthToken]:
        data = self._read_data()
        token_dict = data.get("tokens")
        if not token_dict:
            # Fall back to IDE's mcp-remote tokens if available
            tf, _ = self._find_mcp_remote_files()
            if tf and os.path.exists(tf):
                try:
                    with open(tf, "r", encoding="utf-8") as f:
                        token_dict = json.load(f)
                    if token_dict:
                        data["tokens"] = token_dict
                        data["tokens_source"] = tf
                        self._write_data(data)
                        logger.info(f"Loaded and synced Robinhood OAuth tokens from {tf}")
                except Exception as e:
                    logger.warning(f"Failed to load tokens from {tf}: {e}")

        if not token_dict:
            return None
        try:
            return OAuthToken.model_validate(token_dict)
        except Exception as e:
            logger.warning(f"Failed to parse stored tokens: {e}")
            return None

    async def set_tokens(self, tokens: OAuthToken) -> None:
        data = self._read_data()
        tokens_json = tokens.model_dump(mode="json")
        data["tokens"] = tokens_json
        data["tokens_saved_at"] = time.time()
        self._write_data(data)
        logger.info(f"Updated OAuth tokens stored at {self.token_path}")

        # Also keep mcp-remote file updated if present
        tf, _ = self._find_mcp_remote_files()
        if tf and os.path.exists(tf):
            try:
                with open(tf, "w", encoding="utf-8") as f:
                    json.dump(tokens_json, f, indent=2)
                logger.info(f"Mirrored refreshed OAuth tokens to {tf}")
            except Exception as e:
                logger.warning(f"Could not mirror tokens to {tf}: {e}")

    async def get_client_info(self) -> Optional[OAuthClientInformationFull]:
        data = self._read_data()
        client_dict = data.get("client_info")
        if not client_dict:
            # Fall back to IDE's mcp-remote client info if available
            _, cf = self._find_mcp_remote_files()
            if cf and os.path.exists(cf):
                try:
                    with open(cf, "r", encoding="utf-8") as f:
                        client_dict = json.load(f)
                    if client_dict:
                        data["client_info"] = client_dict
                        self._write_data(data)
                        logger.info(f"Loaded and synced Robinhood OAuth client info from {cf}")
                except Exception as e:
                    logger.warning(f"Failed to load client info from {cf}: {e}")

        if not client_dict:
            return None
        try:
            return OAuthClientInformationFull.model_validate(client_dict)
        except Exception as e:
            logger.warning(f"Failed to parse stored client_info: {e}")
            return None

    async def set_client_info(self, client_info: OAuthClientInformationFull) -> None:
        data = self._read_data()
        client_json = client_info.model_dump(mode="json")
        data["client_info"] = client_json
        self._write_data(data)
        logger.info(f"Updated client information stored at {self.token_path}")

        _, cf = self._find_mcp_remote_files()
        if cf and os.path.exists(cf):
            try:
                with open(cf, "w", encoding="utf-8") as f:
                    json.dump(client_json, f, indent=2)
            except Exception:
                pass


def get_token_storage() -> FileTokenStorage:
    return FileTokenStorage()


class _AuthCallbackServer:
    """Temporary local HTTP server to receive OAuth 2.1 redirect code."""

    def __init__(self, port: int = 33418):
        self.port = port
        self.code: Optional[str] = None
        self.state: Optional[str] = None
        self.server: Optional[http.server.HTTPServer] = None
        self.thread: Optional[threading.Thread] = None
        self.received_event = threading.Event()

    def start(self):
        handler_self = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                parsed = urllib.parse.urlparse(self.path)
                params = urllib.parse.parse_qs(parsed.query)
                if "code" in params:
                    handler_self.code = params["code"][0]
                    handler_self.state = params.get("state", [None])[0]
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    html = (
                        "<html><body style='font-family:sans-serif; text-align:center; padding:40px; background:#0B0E14; color:#FFF;'>"
                        "<h2 style='color:#00C805;'>Robinhood MCP Authentication Successful</h2>"
                        "<p>Authorization code received. You may close this browser tab and return to the application.</p>"
                        "</body></html>"
                    )
                    self.wfile.write(html.encode("utf-8"))
                    handler_self.received_event.set()
                else:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Missing authorization code in redirect.")

            def log_message(self, format, *args):
                pass  # Suppress default noisy stdio logging

        self.server = http.server.HTTPServer(("127.0.0.1", self.port), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        logger.info(f"Local OAuth redirect callback listener active on http://127.0.0.1:{self.port}/callback")

    def wait_for_code(self, timeout_sec: float = 180.0) -> Optional[tuple[str, Optional[str]]]:
        if self.received_event.wait(timeout=timeout_sec):
            return self.code, self.state
        return None

    def stop(self):
        if self.server:
            try:
                self.server.shutdown()
                self.server.server_close()
            except Exception:
                pass


def build_oauth_provider(
    redirect_port: Optional[int] = None,
    interactive: bool = False
) -> OAuthClientProvider:
    """Creates configured OAuthClientProvider with redirect and callback handlers."""
    settings = config.get_settings()
    port = redirect_port or settings.oauth_callback_port
    redirect_uri = f"http://127.0.0.1:{port}/callback"

    client_metadata = OAuthClientMetadata(
        client_name="Strategic Alpha AI Trading Agent",
        redirect_uris=[AnyUrl(redirect_uri)],
        grant_types=["authorization_code", "refresh_token"],
        application_type="native",
    )

    storage = get_token_storage()
    cb_server: Optional[_AuthCallbackServer] = None

    async def redirect_handler(auth_url: str) -> None:
        logger.info(f"Opening browser for Robinhood OAuth authorization:\n{auth_url}")
        print("\n" + "=" * 70)
        print("ROBINHOOD OAUTH AUTHORIZATION REQUIRED")
        print("Opening browser for login and Agentic account selection:")
        print(f"URL: {auth_url}")
        print("=" * 70 + "\n")
        try:
            webbrowser.open(auth_url)
        except Exception as e:
            logger.warning(f"Could not open browser automatically: {e}")

    async def callback_handler() -> AuthorizationCodeResult:
        nonlocal cb_server
        if cb_server is None:
            cb_server = _AuthCallbackServer(port=port)
            cb_server.start()

        # Run wait in threadpool so asyncio event loop isn't blocked
        loop = asyncio.get_running_loop()
        res = await loop.run_in_executor(None, cb_server.wait_for_code, 180.0)
        cb_server.stop()

        if not res or not res[0]:
            raise TimeoutError("Timed out waiting for Robinhood OAuth redirect callback (180s).")

        code, auth_state = res
        return AuthorizationCodeResult(code=code, state=auth_state)

    return OAuthClientProvider(
        server_url=settings.mcp_url,
        client_metadata=client_metadata,
        storage=storage,
        redirect_handler=redirect_handler if interactive else None,
        callback_handler=callback_handler if interactive else None,
    )


async def check_auth_health() -> Dict[str, Any]:
    """Returns detailed status of stored OAuth tokens and authentication health."""
    storage = get_token_storage()
    tokens = await storage.get_tokens()
    settings = config.get_settings()

    if not tokens or not tokens.access_token:
        return {
            "authenticated": False,
            "status": "NOT_AUTHENTICATED",
            "message": "No OAuth tokens found. Run 'python -m trading.live_auth login' to authenticate.",
            "token_path": storage.token_path,
            "token_file_exists": os.path.exists(storage.token_path),
            "mcp_url": settings.mcp_url,
            "configured_account": config.mask_account(settings.agentic_account_number),
        }

    token_data = storage._read_data()
    saved_at = token_data.get("tokens_saved_at", 0)
    expires_in = tokens.expires_in or 86400
    now = time.time()
    expired = (now - saved_at) > expires_in if saved_at else False
    remaining_sec = max(0, int(expires_in - (now - saved_at))) if saved_at else None

    return {
        "authenticated": not expired,
        "status": "TOKEN_VALID" if not expired else "TOKEN_EXPIRED",
        "has_refresh_token": bool(tokens.refresh_token),
        "expires_in_sec": expires_in,
        "seconds_remaining": remaining_sec,
        "token_path": storage.token_path,
        "token_file_exists": True,
        "scope": tokens.scope,
        "mcp_url": settings.mcp_url,
        "configured_account": config.mask_account(settings.agentic_account_number),
    }


async def interactive_login(port: int = 33418) -> bool:
    """Executes the interactive browser OAuth login flow."""
    print("Initiating Robinhood MCP OAuth 2.1 login flow...")
    provider = build_oauth_provider(redirect_port=port, interactive=True)
    cb_server = _AuthCallbackServer(port=port)
    cb_server.start()

    try:
        from mcp.shared._httpx_utils import create_mcp_http_client
        async with create_mcp_http_client(auth=provider) as client:
            resp = await client.get(config.get_settings().mcp_url)
            logger.info(f"Handshake response: {resp.status_code}")

        health = await check_auth_health()
        print("\nLogin successful!")
        print(f"Tokens saved to: {health.get('token_path')}")
        print(f"Status: {health.get('status')}")
        return True
    except Exception as e:
        logger.error(f"OAuth login failed: {e}", exc_info=True)
        print(f"\nOAuth login failed: {e}")
        state.trip_breaker(f"OAuth interactive login failed: {e}")
        return False
    finally:
        cb_server.stop()


def main():
    """CLI helper: python -m trading.live_auth [login|status|tools]"""
    args = sys.argv[1:]
    cmd = args[0].lower() if args else "status"

    if cmd == "login":
        asyncio.run(interactive_login())
    elif cmd == "status":
        health = asyncio.run(check_auth_health())
        print(json.dumps(health, indent=2))
    elif cmd == "tools":
        from trading.live_client import get_live_client
        client = get_live_client()
        try:
            tools = client.list_raw_tools()
            print(f"Discovered {len(tools)} tools from Robinhood MCP.")
            print(json.dumps([t.get("name") for t in tools], indent=2))
        except Exception as e:
            print(f"Tool discovery failed: {e}")
    else:
        print("Usage: python -m trading.live_auth [login | status | tools]")


if __name__ == "__main__":
    main()
