"""Agents package initialization"""
try:
    from .backtester_agent import BacktesterAgent
    from .broker_agent import BrokerAgent
    from .pipeline import TradingPipeline, get_pipeline
except ImportError:
    from agents.backtester_agent import BacktesterAgent
    from agents.broker_agent import BrokerAgent
    from agents.pipeline import TradingPipeline, get_pipeline
