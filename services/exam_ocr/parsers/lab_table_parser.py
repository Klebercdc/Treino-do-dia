import pandas as pd

def rows_to_table(rows):
    if not rows:
        return []
    df = pd.DataFrame(rows)
    if df.empty:
        return []
    grouped = df.groupby(['page_num', 'block_num', 'line_num'])['text'].apply(lambda x: ' '.join(x.astype(str))).reset_index(name='line')
    return grouped.to_dict(orient='records')
