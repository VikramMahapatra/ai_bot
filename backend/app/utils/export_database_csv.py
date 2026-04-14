import sqlite3
import pandas as pd

conn = sqlite3.connect("./chatbot.db")

tables = pd.read_sql("SELECT name FROM sqlite_master WHERE type='table';", conn)

with pd.ExcelWriter("output.xlsx") as writer:
    for table in tables['name']:
        df = pd.read_sql(f"SELECT * FROM {table}", conn)
        df.to_excel(writer, sheet_name=table, index=False)

conn.close()