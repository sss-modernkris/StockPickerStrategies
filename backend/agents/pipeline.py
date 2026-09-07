"""
Automated AI Trading Pipeline
Connects the Backtester Agent and Broker Agent into a seamless linear workflow
with autonomous 24x7 scheduled execution at 2:00 PM Market Time (EST/EDT) on trading days
and Robinhood MCP Sandbox integration.
"""

import datetime
import logging
import os
import sys
import threading
import time
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from agents.backtester_agent import BacktesterAgent
from agents.broker_agent import BrokerAgent

logger = logging.getLogger("TradingPipeline")
MARKET_TIMEZONE = ZoneInfo("America/New_York")

class TradingPipeline:
    """Linear Automated Data Pipeline orchestrating the Backtester Agent and Broker Agent with 24x7 auto-scheduler."""

    def __init__(self):
        self.backtester = BacktesterAgent()
        self.broker = BrokerAgent()
        self.is_running = False
        self.last_run_time: Optional[str] = None
        self.last_report: Optional[Dict[str, Any]] = None
        self.last_trigger_source: Optional[str] = None
        
        # Schedule configuration: 2:00 PM Eastern Time (Market Time)
        self.scheduled_hour = 14
        self.scheduled_minute = 0
        self.scheduled_time_est = f"{self.scheduled_hour:02d}:{self.scheduled_minute:02d}"
        
        # Scheduler state
        self.scheduler_enabled = True
        self.last_scheduled_date: Optional[str] = None
        self._scheduler_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        
        # Start the autonomous background scheduler daemon
        self.start_scheduler()
        logger.info(f"TradingPipeline initialized. 24x7 Daily Trigger scheduled for {self.scheduled_time_est} EST/EDT (Trading Days).")

    def start_scheduler(self):
        """Starts the autonomous 24x7 background scheduler thread if not already running."""
        if self._scheduler_thread is not None and self._scheduler_thread.is_alive():
            logger.info("Pipeline scheduler thread is already active.")
            return

        self._stop_event.clear()
        self._scheduler_thread = threading.Thread(
            target=self._scheduler_loop,
            name="AutonomousPipelineScheduler",
            daemon=True
        )
        self._scheduler_thread.start()
        logger.info("Autonomous Pipeline Scheduler daemon thread started.")

    def stop_scheduler(self):
        """Stops the autonomous background scheduler thread gracefully."""
        self._stop_event.set()
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            self._scheduler_thread.join(timeout=2.0)
        logger.info("Autonomous Pipeline Scheduler stopped.")

    def _scheduler_loop(self):
        """
        Continuous background worker loop checking Eastern Market Time every 15 seconds.
        Triggers run_pipeline() at 2:00 PM EST (14:00) on active trading days (Monday-Friday).
        """
        logger.info(f"[SCHEDULER] Started monitoring clock for daily trigger at {self.scheduled_time_est} EST...")
        
        while not self._stop_event.is_set():
            try:
                if self.scheduler_enabled and not self.is_running:
                    now_ny = datetime.datetime.now(MARKET_TIMEZONE)
                    today_str = now_ny.strftime("%Y-%m-%d")
                    is_weekday = now_ny.weekday() < 5  # 0=Mon, 4=Fri
                    
                    # Target trigger condition:
                    # 1. Trading day (Monday through Friday)
                    # 2. Reached or passed 14:00 (within trigger window 14:00-14:15)
                    # 3. Has NOT already executed today
                    if (
                        is_weekday
                        and now_ny.hour == self.scheduled_hour
                        and now_ny.minute >= self.scheduled_minute
                        and self.last_scheduled_date != today_str
                    ):
                        self.last_scheduled_date = today_str
                        logger.info(
                            f"[SCHEDULER] >>> Trigger condition met! Starting scheduled execution for trading date {today_str} at {now_ny.strftime('%H:%M:%S %Z')} <<<"
                        )
                        # Run pipeline in a separate thread so scheduler loop remains responsive
                        exec_thread = threading.Thread(
                            target=self.run_pipeline,
                            args=("AUTOMATIC_SCHEDULED",),
                            name="ScheduledPipelineWorker",
                            daemon=True
                        )
                        exec_thread.start()

            except Exception as e:
                logger.error(f"[SCHEDULER] Error in scheduler loop: {e}", exc_info=True)

            # Wait 15 seconds before next evaluation (or until stopped)
            self._stop_event.wait(timeout=15.0)

    def get_next_run_time(self) -> str:
        """Calculates the upcoming scheduled execution timestamp in Eastern Market Time."""
        now_ny = datetime.datetime.now(MARKET_TIMEZONE)
        today_target = now_ny.replace(hour=self.scheduled_hour, minute=self.scheduled_minute, second=0, microsecond=0)
        
        # Check if today is a weekday and the scheduled time hasn't passed yet
        if now_ny.weekday() < 5 and now_ny < today_target and self.last_scheduled_date != now_ny.strftime("%Y-%m-%d"):
            next_run = today_target
        else:
            # Advance to the next trading day
            candidate = today_target + datetime.timedelta(days=1)
            while candidate.weekday() >= 5:  # Skip Saturday (5) and Sunday (6)
                candidate += datetime.timedelta(days=1)
            next_run = candidate

        tz_abbr = now_ny.strftime("%Z")
        return next_run.strftime(f"%Y-%m-%d %H:%M:%S {tz_abbr}")

    def run_pipeline(self, trigger_source: str = "MANUAL_TRIGGER") -> Dict[str, Any]:
        """
        Executes the linear workflow:
        Step 1: Backtester Agent screens universe (Dow, Nasdaq, S&P) and generates ranked signals.
        Step 2: Broker Agent evaluates portfolio, executes sell liquidations, and places stock/option buys in Robinhood Sandbox.
        """
        if self.is_running:
            logger.warning("Pipeline is already executing. Ignoring concurrent execution request.")
            return {
                "success": False,
                "error": "Pipeline is already running.",
                "stage": "Lock"
            }

        start_time_ny = datetime.datetime.now(MARKET_TIMEZONE)
        self.is_running = True
        self.last_trigger_source = trigger_source
        
        logger.info(f"================== [PIPELINE START - Trigger: {trigger_source}] ==================")
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

            end_time_ny = datetime.datetime.now(MARKET_TIMEZONE)
            duration = round((end_time_ny - start_time_ny).total_seconds(), 2)
            tz_abbr = start_time_ny.strftime("%Z")

            pipeline_report = {
                "success": True,
                "pipeline_name": "Autonomous Daily Backtest & Sandbox Rebalance Pipeline",
                "trigger_source": trigger_source,
                "execution_timestamp": start_time_ny.strftime(f"%Y-%m-%d %H:%M:%S {tz_abbr}"),
                "total_duration_sec": duration,
                "schedule_target": f"{self.scheduled_time_est} EST/EDT (Trading Days)",
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

            self.last_run_time = start_time_ny.strftime(f"%Y-%m-%d %H:%M:%S {tz_abbr}")
            self.last_report = pipeline_report

            logger.info(f"================== [PIPELINE SUCCESS - {duration}s ({trigger_source})] ==================")
            return pipeline_report

        except Exception as e:
            logger.error(f"Pipeline execution encountered an exception: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.datetime.now(MARKET_TIMEZONE).strftime("%Y-%m-%d %H:%M:%S %Z")
            }
        finally:
            self.is_running = False

    def get_status(self) -> Dict[str, Any]:
        """Returns the health, 24x7 autonomous scheduler state, and next trigger time."""
        scheduler_alive = self._scheduler_thread is not None and self._scheduler_thread.is_alive()
        next_run = self.get_next_run_time() if self.scheduler_enabled else "Scheduler Paused"
        
        return {
            "pipeline_active": True,
            "is_running": self.is_running,
            "scheduler_enabled": self.scheduler_enabled,
            "scheduler_running": scheduler_alive,
            "scheduled_time_est": f"{self.scheduled_time_est} EST/EDT",
            "schedule_description": "Autonomous execution every Trading Day at 2:00 PM Market Time (EST/EDT)",
            "next_run_time_est": next_run,
            "last_run_time": self.last_run_time,
            "last_trigger_source": self.last_trigger_source,
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
    print("Status:", p.get_status())
    report = p.run_pipeline("CLI_TEST")
    import json
    print(json.dumps(report, indent=2))
