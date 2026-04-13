import asyncio
import os
from ib_insync import IB, util
import logging
import random

logger = logging.getLogger(__name__)

class IBClient:
    def __init__(self):
        logger.info("Initializing Interactive Brokers Handler")
        util.startLoop()
        self.ib = None
        self.connected = False

    def connect(self, host=None, port=None, client_id=1):
        """
        Connects to IB Gateway or TWS.
        Uses environment variables IB_GATEWAY_HOST and IB_GATEWAY_PORT if available.
        """
        target_host = host or os.getenv('IB_GATEWAY_HOST', 'ib-gateway')
        target_port = int(port or os.getenv('IB_GATEWAY_PORT', '4002'))

        print("Target host: ", target_host)
        print("Target port: ", target_port)
        
        # Use a consistent clientId for simple apps
        c_id = client_id
        
        try:
            # In startLoop() mode, we can keep the same IB() object or recreate it
            if self.ib is None:
                logger.info("Creating new IB client")
                self.ib = IB()
            else:
                logger.info("Using existing IB client")

            logger.info(f"Attempting synchronous connection to IB at {target_host}:{target_port}")
            self.ib.connect(target_host, target_port, clientId=c_id)
            
            if self.ib.isConnected():
                self.connected = True
                logger.info(f"Successfully connected to IB at {target_host}:{target_port}")
                return True, "Connected successfully"
            else:
                return False, "Failed to establish connection to IB-Gateway"
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to connect to IB: {error_msg}")
            self.connected = False
            return False, error_msg

    def is_connected(self):
        return self.ib and self.ib.isConnected()

    def disconnect(self):
        if self.connected and self.ib:
            self.ib.disconnect()
            self.connected = False

    def get_portfolio_summary(self):
        """
        Retrieves Dashboard information from IB including summary, positions, and orders.
        """
        if not self.is_connected():
            return None
        
        # Refresh account values
        acc_values = self.ib.accountValues()
        
        summary = {
            "unrealized_pnl": 0.0,
            "realized_pnl": 0.0,
            "buying_power": 0.0,
            "cash_available": 0.0,
            "invested_capital": 0.0,
            "total_equity": 0.0,
            "holdings": [],
            "orders": []
        }
        
        for v in acc_values:
            if v.tag == 'UnrealizedPnL':
                summary["unrealized_pnl"] = float(v.value)
            elif v.tag == 'RealizedPnL':
                summary["realized_pnl"] = float(v.value)
            elif v.tag == 'BuyingPower':
                summary["buying_power"] = float(v.value)
            elif v.tag == 'CashBalance':
                summary["cash_available"] = float(v.value)
            elif v.tag == 'NetLiquidation':
                summary["total_equity"] = float(v.value)
            elif v.tag == 'StockMarketValue':
                summary["invested_capital"] = float(v.value)
        
        # Add Positions
        try:
            portfolio = self.ib.portfolio()
            for p in portfolio:
                summary["holdings"].append({
                    "ticker": p.contract.symbol,
                    "total_quantity": p.position,
                    "avg_buy_price": p.averageCost,
                    "current_price": p.marketPrice,
                    "total_value": p.marketValue,
                    "unrealized_pnl": p.unrealizedPNL
                })
        except Exception as e:
            logger.error(f"Failed to fetch IB positions: {str(e)}")

        # Add Orders
        summary["orders"] = self.get_orders()
                
        return summary

    def place_order(self, ticker: str, action: str, quantity: float, price: float):
        """
        Places a Limit Order in IB.
        action: 'BUY' or 'SELL'
        """
        if not self.is_connected():
            return False, "IB not connected"
            
        try:
            from ib_insync import Stock, LimitOrder
            
            # Create contract
            contract = Stock(ticker.upper(), 'SMART', 'USD')
            self.ib.qualifyContracts(contract)
            
            # Create order
            # Note: quantity must be positive for both BUY and SELL; action determines direction
            order = LimitOrder(action.upper(), abs(quantity), price)
            
            # Place order
            trade = self.ib.placeOrder(contract, order)
            
            logger.info(f"Order placed: {action} {quantity} {ticker} @ {price}")
            return True, f"Order placed: {trade.order.action} {trade.order.totalQuantity} {ticker}"
            
        except Exception as e:
            logger.error(f"Failed to place order: {str(e)}")
            return False, str(e)

    def get_orders(self):
        """
        Retrieves recent orders/trades from IB.
        """
        if not self.is_connected():
            return []
            
        try:
            # ib.trades() returns Trade objects which include Order and OrderStatus
            trades = self.ib.trades()
            orders_data = []
            
            for t in trades:
                # Get the most recent timestamp from logs if available
                last_time = ""
                if t.log:
                    # Sort logs by time just in case, though usually they are in order
                    last_time = str(t.log[-1].time)
                
                orders_data.append({
                    "order_id": t.order.orderId,
                    "account": t.order.account or "N/A",
                    "ticker": t.contract.symbol,
                    "action": t.order.action,
                    "total_quantity": t.order.totalQuantity,
                    "filled": t.orderStatus.filled,
                    "remaining": t.orderStatus.remaining,
                    "status": t.orderStatus.status,
                    "price": t.order.lmtPrice if t.order.orderType == 'LMT' else (t.order.auxPrice or 0.0),
                    "avg_fill_price": t.orderStatus.avgFillPrice,
                    "last_update": last_time
                })
            
            # Sort by last_update or order_id descending
            orders_data.sort(key=lambda x: x['order_id'], reverse=True)
            return orders_data
        except Exception as e:
            logger.error(f"Failed to fetch IB orders: {str(e)}")
            return []
