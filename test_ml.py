import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.services.finance_client import fetch_ticker_data
from backend.strategies.machine_learning import evaluate_ml_engine
import pandas as pd

data = fetch_ticker_data("AAPL")
df = data["history"]
df['Ret_6m'] = df['Close'].pct_change(periods=126)
df['Ret_1m'] = df['Close'].pct_change(periods=21)
df['Momentum'] = df['Ret_6m'] - df['Ret_1m']
df['Daily_Ret'] = df['Close'].pct_change()
df['Volatility'] = df['Daily_Ret'].rolling(window=126).std() * (252**0.5)

pe = data.get("info", {}).get("trailingPE", 15)
roe = data.get("info", {}).get("returnOnEquity", 0.10)
df['Value'] = pe / df['Close'] * df['Close'].mean()
df['Quality'] = roe * df['Close'] / df['Close'].mean()

df['Fwd_30d_Ret'] = df['Close'].pct_change(periods=21).shift(-21)
ml_df = df.dropna(subset=['Momentum', 'Volatility', 'Value', 'Quality', 'Fwd_30d_Ret']).copy()
median_ret = ml_df['Fwd_30d_Ret'].median()
ml_df['Target'] = (ml_df['Fwd_30d_Ret'] > median_ret).astype(int)

print(f"Target distribution mean: {ml_df['Target'].mean()}")

from sklearn.metrics import accuracy_score
res, prob, factor = evaluate_ml_engine(data)
model = res.justifications # wait, we can't extract the model easily. Let's just do it directly here.

from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from xgboost import XGBClassifier

features = ['Value', 'Quality', 'Momentum', 'Volatility']
X = ml_df[features]
y = ml_df['Target']
imputer = SimpleImputer(strategy='median')
scaler = StandardScaler()
X_imputed = imputer.fit_transform(X)
X_scaled = scaler.fit_transform(X_imputed)

model = XGBClassifier(n_estimators=100, max_depth=3, random_state=42, eval_metric='logloss')
model.fit(X_scaled, y)
print(f"Train Accuracy: {accuracy_score(y, model.predict(X_scaled))}")

last_row = df.iloc[-1:]
current_features = last_row[['Value', 'Quality', 'Momentum', 'Volatility']]
curr_scaled = scaler.transform(imputer.transform(current_features))
print(f"Raw predict_proba: {model.predict_proba(curr_scaled)}")

