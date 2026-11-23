"""
Automated AI Trading Pipeline
Connects the Backtester Agent and Broker Agent into a seamless linear workflow
with autonomous 24x7 two-phase scheduled execution:
  - 11:00 AM EST: Automatic Morning Sell (liquidates held shares from prior session)
  - 14:00 EST: Afternoon Buy (Backtester screening & Broker capital allocation)
with Robinhood MCP Sandbox and Live execution.
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
from trading import approval, ledger, market_calendar, state

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
        
        # Two-Phase Daily Schedule configuration (Eastern Market Time)
        # Phase 1: Morning Sell @ 11:00 AM EST (liquidates yesterday's holdings automatically)
        self.morning_sell_hour = 11
        self.morning_sell_minute = 0
        self.morning_sell_time_est = f"{self.morning_sell_hour:02d}:{self.morning_sell_minute:02d}"

        # Phase 2: Afternoon Buy @ 2:00 PM (14:00) EST (screens universe & buys top setups)
        self.afternoon_buy_hour = 14
        self.afternoon_buy_minute = 0
        self.afternoon_buy_time_est = f"{self.afternoon_buy_hour:02d}:{self.afternoon_buy_minute:02d}"

        # Backward compatibility aliases
        self.scheduled_hour = self.afternoon_buy_hour
        self.scheduled_minute = self.afternoon_buy_minute
        self.scheduled_time_est = self.afternoon_buy_time_est
        
        # Scheduler state
        self.scheduler_enabled = True
        self.last_morning_sell_date: Optional[str] = None
        self.last_afternoon_buy_date: Optional[str] = None
        self.last_scheduled_date: Optional[str] = None
        self.last_morning_sell_time: Optional[str] = None
        self.last_morning_sell_report: Optional[Dict[str, Any]] = None
        self._last_token_check = 0.0
        self._scheduler_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        
        # Start the autonomous background scheduler daemon
        self.start_scheduler()
        logger.info(
            f"TradingPipeline initialized. Two-Phase Daily Schedule: "
            f"Morning Sell @ {self.morning_sell_time_est} EST (Auto) | "
            f"Afternoon Buy @ {self.afternoon_buy_time_est} EST (Trading Days)."
        )

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
        Two-Phase Daily Schedule on active trading days (Monday-Friday):
        - 11:00 AM EST (11:00): Automatic Morning Sell (liquidates currently held shares from prior session).
        - 14:00 EST (14:00): Afternoon Buy (runs Backtester screening & Broker capital allocation).
        """
        logger.info(
            f"[SCHEDULER] Started monitoring clock for Two-Phase Daily Schedule: "
            f"Morning Sell @ {self.morning_sell_time_est} EST | Afternoon Buy @ {self.afternoon_buy_time_est} EST..."
        )
        
        while not self._stop_event.is_set():
            try:
                if self.scheduler_enabled and not self.is_running:
                    now_ny = datetime.datetime.now(MARKET_TIMEZONE)
                    today_str = now_ny.strftime("%Y-%m-%d")
                    is_market_day = market_calendar.is_trading_day(now_ny.date())
                    
                    # Proactive OAuth Token Refresh Heartbeat (Every 30 minutes in Live modes)
                    if (
                        time.time() - self._last_token_check > 1800
                        and state.get_mode() in ("LIVE_SHADOW", "LIVE_APPROVAL", "LIVE_AUTONOMOUS")
                    ):
                        self._last_token_check = time.time()
                        try:
                            from trading.token_refresh import ensure_valid_token
                            ensure_valid_token(buffer_seconds=7200)
                        except Exception as te:
                            logger.debug(f"[SCHEDULER] Periodic token refresh check error: {te}")

                    if is_market_day:
                        # 1. Morning Sell Trigger @ 11:00 AM EST (Window: 11:00 - 11:15)
                        if (
                            now_ny.hour == self.morning_sell_hour
                            and now_ny.minute >= self.morning_sell_minute
                            and self.last_morning_sell_date != today_str
                        ):
                            self.last_morning_sell_date = today_str
                            logger.info(
                                f"[SCHEDULER] >>> Morning Sell Condition Met! Triggering 11:00 AM Sell for date {today_str} at {now_ny.strftime('%H:%M:%S %Z')} <<<"
                            )
                            sell_thread = threading.Thread(
                                target=self.run_morning_sell,
                                args=("AUTOMATIC_SCHEDULED_11AM",),
                                name="ScheduledMorningSellWorker",
                                daemon=True
                            )
                            sell_thread.start()

                        # 2. Afternoon Buy Trigger @ 14:00 EST (Window: 14:00 - 14:15)
                        elif (
                            now_ny.hour == self.afternoon_buy_hour
                            and now_ny.minute >= self.afternoon_buy_minute
                            and self.last_afternoon_buy_date != today_str
                        ):
                            self.last_afternoon_buy_date = today_str
                            self.last_scheduled_date = today_str
                            logger.info(
                                f"[SCHEDULER] >>> Afternoon Buy Condition Met! Triggering 14:00 EST Pipeline for date {today_str} at {now_ny.strftime('%H:%M:%S %Z')} <<<"
                            )
                            buy_thread = threading.Thread(
                                target=self.run_pipeline,
                                args=("AUTOMATIC_SCHEDULED_2PM",),
                                name="ScheduledAfternoonBuyWorker",
                                daemon=True
                            )
                            buy_thread.start()

            except Exception as e:
                logger.error(f"[SCHEDULER] Error in scheduler loop: {e}", exc_info=True)

            self._stop_event.wait(timeout=15.0)

    def get_next_run_time(self) -> str:
        """Calculates the upcoming scheduled execution timestamp in Eastern Market Time (NYSE calendar aware)."""
        now_ny = datetime.datetime.now(MARKET_TIMEZONE)
        today_date = now_ny.date()
        is_today_trading = market_calendar.is_trading_day(today_date)
        today_str = now_ny.strftime("%Y-%m-%d")

        target_11am = now_ny.replace(hour=self.morning_sell_hour, minute=self.morning_sell_minute, second=0, microsecond=0)
        target_2pm = now_ny.replace(hour=self.afternoon_buy_hour, minute=self.afternoon_buy_minute, second=0, microsecond=0)

        tz_abbr = now_ny.strftime("%Z")

        # Case 1: Today is a trading day and 11:00 AM Morning Sell has not yet run
        if is_today_trading and now_ny < target_11am and self.last_morning_sell_date != today_str:
            return f"{target_11am.strftime(f'%Y-%m-%d %H:%M:%S {tz_abbr}')} (Morning Sell)"

        # Case 2: Today is a trading day and 14:00 Afternoon Buy has not yet run
        if is_today_trading and now_ny < target_2pm and self.last_afternoon_buy_date != today_str:
            return f"{target_2pm.strftime(f'%Y-%m-%d %H:%M:%S {tz_abbr}')} (Afternoon Buy)"

        # Case 3: Both phases finished today, or non-trading day -> Next trading day @ 11:00 AM Morning Sell
        next_date = market_calendar.next_trading_day(today_date)
        next_run = datetime.datetime.combine(
            next_date,
            datetime.time(self.morning_sell_hour, self.morning_sell_minute),
            tzinfo=MARKET_TIMEZONE
        )
        return f"{next_run.strftime(f'%Y-%m-%d %H:%M:%S {tz_abbr}')} (Morning Sell)"

    def run_morning_sell(self, trigger_source: str = "MANUAL_TRIGGER") -> Dict[str, Any]:
        """
        Executes the Morning Sell Phase @ 11:00 AM EST:
        Liquidates currently held shares brought in yesterday's market session.
        CRITICAL RULE: Irrespective of Operating Mode (Approval or Auto), selling is automatic
        without waiting for user approval.
        """
        if self.is_running:
            logger.warning("[MORNING SELL] Pipeline is currently busy. Ignoring concurrent request.")
            return {
                "success": False,
                "error": "Pipeline is already running.",
                "phase": "MORNING_SELL"
            }

        if state.kill_switch_active():
            logger.warning("[MORNING SELL] Execution blocked: Emergency Kill Switch is engaged.")
            return {
                "success": False,
                "error": "Emergency Kill Switch is engaged.",
                "phase": "MORNING_SELL"
            }

        start_time_ny = datetime.datetime.now(MARKET_TIMEZONE)
        tz_abbr = start_time_ny.strftime("%Z")
        self.is_running = True
        try:
            report = self.broker.execute_morning_sell(trigger_source=trigger_source)
            self.last_morning_sell_time = start_time_ny.strftime(f"%Y-%m-%d %H:%M:%S {tz_abbr}")
            self.last_morning_sell_report = report
            return report
        except Exception as e:
            logger.error(f"[MORNING SELL] Error executing morning sell: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "phase": "MORNING_SELL"
            }
        finally:
            self.is_running = False

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

        # Pre-flight Guardrail Check: Emergency Kill Switch
        if state.kill_switch_active():
            logger.warning("[PIPELINE GUARD] Pipeline execution blocked: Emergency Kill Switch is active.")
            return {
                "success": False,
                "error": "Execution blocked: Emergency Kill Switch is engaged.",
                "stage": "Emergency Kill Switch"
            }

        current_mode = state.get_mode()
        start_time_ny = datetime.datetime.now(MARKET_TIMEZONE)
        self.is_running = True
        self.last_trigger_source = trigger_source
        
        logger.info(f"================== [PIPELINE START - Mode: {current_mode} | Trigger: {trigger_source}] ==================")
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
                "pipeline_name": f"Autonomous Daily Backtest & {current_mode} Execution Pipeline",
                "trading_mode": current_mode,
                "trigger_source": trigger_source,
                "execution_timestamp": start_time_ny.strftime(f"%Y-%m-%d %H:%M:%S {tz_abbr}"),
                "total_duration_sec": duration,
                "phase": "AFTERNOON_BUY",
                "schedule_target": f"Morning Sell: {self.morning_sell_time_est} EST (Auto) | Afternoon Buy: {self.afternoon_buy_time_est} EST (Trading Days)",
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

            # If running in LIVE_APPROVAL mode, queue plan for manual operator approval
            if current_mode == "LIVE_APPROVAL":
                pending = approval.save_pending_plan(pipeline_report, source=trigger_source)
                pipeline_report["pending_approval_plan"] = pending.get("plan_id")
                pipeline_report["stage_2_broker"]["execution_summary"] += f" [QUEUED FOR APPROVAL: {pending.get('plan_id')} (15m TTL)]"

            # Log to live audit ledger
            ledger.get_ledger().append(
                ledger.EV_RUN,
                trigger=trigger_source,
                mode=current_mode,
                duration_sec=duration,
                recommendations_count=len(backtest_result.get("ranked_recommendations", []))
            )

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
        current_mode = state.get_mode()
        broker_status = f"CONNECTED_{current_mode}"
        
        return {
            "pipeline_active": True,
            "is_running": self.is_running,
            "trading_mode": current_mode,
            "kill_switch_active": state.kill_switch_active(),
            "circuit_breaker": state.breaker_state(),
            "scheduler_enabled": self.scheduler_enabled,
            "scheduler_running": scheduler_alive,
            "scheduled_time_est": f"{self.afternoon_buy_time_est} EST/EDT",
            "morning_sell_time_est": f"{self.morning_sell_time_est} EST/EDT",
            "afternoon_buy_time_est": f"{self.afternoon_buy_time_est} EST/EDT",
            "schedule_description": f"Two-Phase Daily Schedule: {self.morning_sell_time_est} EST Automatic Morning Sell | {self.afternoon_buy_time_est} EST Afternoon Buy (Trading Days)",
            "next_run_time_est": next_run,
            "last_run_time": self.last_run_time,
            "last_morning_sell_time": self.last_morning_sell_time,
            "last_morning_sell_summary": self.last_morning_sell_report.get("summary") if self.last_morning_sell_report else None,
            "last_trigger_source": self.last_trigger_source,
            "has_report": self.last_report is not None,
            "last_summary": self.last_report.get("stage_2_broker", {}).get("execution_summary") if self.last_report else "No pipeline runs yet.",
            "pending_plan": approval.get_pending_plan(),
            "agents": {
                "backtester": {
                    "name": self.backtester.name,
                    "status": "READY",
                    "strategy": "Strategy 1 - 1 Week Momentum (5 Filters)"
                },
                "broker": {
                    "name": self.broker.name,
                    "status": broker_status,
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
