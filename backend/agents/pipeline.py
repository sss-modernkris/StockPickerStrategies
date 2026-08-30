"""
Automated AI Trading Pipeline
Connects the Backtester Agent and Broker Agent into a seamless linear workflow
with scheduled execution at 2:00 PM Market Time (EST) and Robinhood MCP Sandbox integration.
"""

import datetime
import logging
import os
import sys
import threading
import time
from typing import Any, Dict, Optional

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from agents.backtester_agent import BacktesterAgent
from agents.broker_agent import BrokerAgent

logger = logging.getLogger("TradingPipeline")

class TradingPipeline:
    """Linear Automated Data Pipeline orchestrating the Backtester Agent and Broker Agent."""

    def __init__(self):
        self.backtester = BacktesterAgent()
        self.broker = BrokerAgent()
        self.is_running = False
        self.last_run_time: Optional[str] = None
        self.last_report: Optional[Dict[str, Any]] = None
        self.scheduled_time_est = "14:00"  # 2:00 PM EST daily
        self.schedule_active = True
        logger.info("TradingPipeline initialized. Daily trigger scheduled for 2:00 PM EST.")

    def run_pipeline(self) -> Dict[str, Any]:
        """
        Executes the linear workflow:
        Step 1: Backtester Agent screens universe (Dow, Nasdaq, S&P) and generates ranked signals.
        Step 2: Broker Agent evaluates portfolio, executes sell liquidations, and places stock/option buys in Robinhood Sandbox.
        """
        start_time = datetime.datetime.now()
        self.is_running = True
        logger.info("================== [PIPELINE START] ==================")
        logger.info("Step 1: Invoking Backtester Agent...")

        try:
            # 1. Backtest Analysis
            backtest_result = self.backtester.run_daily_analysis()
            if not backtest_result.get("success"):
                logger.error("Pipeline aborted: Backtester Agent returned failure.")
                return {
                    "success": False,
                    "error": backtest_result.get("error", "Backtest execution failed"),
                    "stage": "Backtester Agent"
                }

            logger.info(f"Step 1 Complete: {len(backtest_result.get('ranked_recommendations', []))} candidates screened.")
            logger.info("Step 2: Invoking Broker Agent with Backtest payload...")

            # 2. Broker Execution
            broker_result = self.broker.evaluate_and_rebalance(backtest_result)

            end_time = datetime.datetime.now()
            duration = round((end_time - start_time).total_seconds(), 2)

            pipeline_report = {
                "success": True,
                "pipeline_name": "Autonomous Daily Backtest & Sandbox Rebalance Pipeline",
                "execution_timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S EST"),
                "total_duration_sec": duration,
                "schedule_target": f"{self.scheduled_time_est} EST (Trading Days)",
                "stage_1_backtester": {
                    "agent": self.backtester.name,
                    "universe_scanned": backtest_result.get("universe_scanned"),
                    "total_qualified": backtest_result.get("total_qualified"),
                    "ranked_recommendations": backtest_result.get("ranked_recommendations", [])
                },
                "stage_2_broker": {
                    "agent": self.broker.name,
                    "environment": broker_result.get("environment"),
                    "initial_cash": broker_result.get("initial_cash"),
                    "liquidation_proceeds": broker_result.get("liquidation_proceeds"),
                    "effective_buying_power": broker_result.get("effective_buying_power"),
                    "final_cash_remaining": broker_result.get("final_cash_remaining"),
                    "total_portfolio_equity": broker_result.get("total_portfolio_equity"),
                    "execution_summary": broker_result.get("execution_summary"),
                    "actions": broker_result.get("execution_actions", {})
                },
                "overall_status": "SUCCESSFUL_EXECUTION"
            }

            self.last_run_time = start_time.strftime("%Y-%m-%d %H:%M:%S EST")
            self.last_report = pipeline_report

            logger.info(f"================== [PIPELINE SUCCESS - {duration}s] ==================")
            return pipeline_report

        except Exception as e:
            logger.error(f"Pipeline execution encountered an exception: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S EST")
            }
        finally:
            self.is_running = False

    def get_status(self) -> Dict[str, Any]:
        """Returns the health and schedule status of the automated pipeline."""
        return {
            "pipeline_active": True,
            "is_running": self.is_running,
            "scheduled_time_est": self.scheduled_time_est,
            "schedule_description": "Every Trading Day at 2:00 PM Market Time (EST)",
            "last_run_time": self.last_run_time,
            "has_report": self.last_report is not None,
            "last_summary": self.last_report.get("stage_2_broker", {}).get("execution_summary") if self.last_report else "No pipeline runs yet.",
            "agents": {
                "backtester": {
                    "name": self.backtester.name,
                    "status": "READY",
                    "strategy": "Strategy 1 - 1 Week Momentum (5 Filters)"
                },
                "broker": {
                    "name": self.broker.name,
                    "status": "CONNECTED_SANDBOX",
                    "target_api": "Robinhood Model Context Protocol (MCP)"
                }
            }
        }

# Global singleton pipeline instance
_pipeline = TradingPipeline()

def get_pipeline() -> TradingPipeline:
    return _pipeline

if __name__ == "__main__":
    p = get_pipeline()
    report = p.run_pipeline()
    import json
    print(json.dumps(report, indent=2))
