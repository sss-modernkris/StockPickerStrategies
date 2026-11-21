"""
Sandbox Trading Client.

Wraps the in-process Robinhood MCP Sandbox implementation and conforms to the
TradingClient protocol with environment = "ROBINHOOD_MCP_SANDBOX".
"""

import logging
from typing import Any, Dict
from rh_sandbox.mcp_client import RobinhoodMCPClient

logger = logging.getLogger("SandboxClient")


class SandboxClient(RobinhoodMCPClient):
    """Client for dispatching calls to Robinhood MCP Sandbox tools (simulation)."""

    def __init__(self, use_in_process: bool = True):
        super().__init__(use_in_process=use_in_process)
        self.environment = "ROBINHOOD_MCP_SANDBOX"
        logger.info("SandboxClient initialized with environment=ROBINHOOD_MCP_SANDBOX.")
