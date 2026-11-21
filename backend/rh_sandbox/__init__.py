"""Robinhood MCP Sandbox package (internal simulation only).

Renamed from ``backend/mcp`` so the official ``mcp`` Python SDK can be imported
by the live trading client (``backend/trading``).
"""
from rh_sandbox.rh_mcp_server import get_sandbox, handle_mcp_request
from rh_sandbox.mcp_client import RobinhoodMCPClient
