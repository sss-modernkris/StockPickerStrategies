"""
Trading Client Factory.

Resolves and instantiates the appropriate TradingClient based on the active
TRADING_MODE setting (from runtime state or .env configuration):
- SANDBOX: SandboxClient (in-process simulation, 0% risk)
- LIVE_SHADOW: ShadowClient (real account reads, shadow order ledger)
- LIVE_APPROVAL: ShadowClient for pipeline plan building -> LiveExecutionGateway upon manual approval
- LIVE_AUTONOMOUS: LiveExecutionGateway (real orders guarded by 9 institutional checks)
"""

from __future__ import annotations

import logging
from typing import Optional

from trading import state
from trading.client_protocol import TradingClient
from trading.sandbox_client import SandboxClient

logger = logging.getLogger("TradingFactory")


def get_trading_client(mode_override: Optional[str] = None) -> TradingClient:
    """
    Returns the appropriate TradingClient instance conforming to TradingClient protocol.
    """
    mode = (mode_override or state.get_mode()).strip().upper()

    if mode == "SANDBOX":
        return SandboxClient()

    elif mode == "LIVE_SHADOW":
        from trading.shadow_client import ShadowClient
        return ShadowClient()

    elif mode == "LIVE_APPROVAL":
        # In LIVE_APPROVAL, the automated pipeline uses ShadowClient to calculate
        # the proposed rebalance plan without committing capital until approved by user.
        from trading.shadow_client import ShadowClient
        return ShadowClient()

    elif mode == "LIVE_AUTONOMOUS":
        from trading.live_gateway import LiveExecutionGateway
        return LiveExecutionGateway(mode="LIVE_AUTONOMOUS")

    else:
        logger.warning(f"Unrecognized trading mode '{mode}'. Falling back safely to SandboxClient.")
        return SandboxClient()
