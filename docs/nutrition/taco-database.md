# TACO 4ª Edição

Fonte oficial usada por este repositório:

- NEPA/UNICAMP: https://www.nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/Taco-4a-Edicao.xlsx

Artefatos no repositório:

- `src/lib/nutrition/tacoDatabase.json`
- `src/lib/nutrition/tacoDatabase.js`
- `src/lib/nutrition/tacoService.js`
- `scripts/import-taco-database.py`

Como regenerar:

```bash
python3 scripts/import-taco-database.py \
  --source data/taco/Taco-4a-Edicao.xlsx \
  --output src/lib/nutrition/tacoDatabase.json
```

Se você não quiser armazenar a planilha no repositório, o importador também aceita a URL oficial da NEPA no parâmetro `--source`.

Observações:

- A edição 4 da TACO usada aqui totaliza 597 alimentos.
- Os campos ausentes na planilha ficam como `null`.
- A planilha oficial desta edição não publica vitamina E na aba importada; por isso o campo fica como `vitamina_e_mg: null`.
- `aliases` são apenas facilitadores de busca e não alteram a composição nutricional.
