#!/usr/bin/env python3
"""Importa a TACO 4ª edição oficial da NEPA/UNICAMP para JSON.

Fonte oficial:
https://www.nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/Taco-4a-Edicao.xlsx

O script lê a planilha oficial, extrai a aba principal de composição centesimal
e grava um JSON pronto para consumo por `src/lib/nutrition/tacoDatabase.js`.
"""

from __future__ import annotations

import argparse
import json
import re
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


OFFICIAL_XLSX_URL = (
    "https://www.nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/"
    "Taco-4a-Edicao.xlsx"
)

FIELD_BY_COLUMN = {
    3: "umidade",
    4: "energia_kcal",
    5: "energia_kj",
    6: "proteina_g",
    7: "lipidios_g",
    8: "colesterol_mg",
    9: "carboidrato_g",
    10: "fibra_g",
    11: "cinzas_g",
    12: "calcio_mg",
    13: "magnesio_mg",
    15: "manganes_mg",
    16: "fosforo_mg",
    17: "ferro_mg",
    18: "sodio_mg",
    19: "potassio_mg",
    20: "cobre_mg",
    21: "zinco_mg",
    22: "retinol_mcg",
    23: "re_mcg",
    24: "rae_mcg",
    25: "tiamina_mg",
    26: "riboflavina_mg",
    27: "piridoxina_mg",
    28: "niacina_mg",
    29: "vitamina_c_mg",
}

ALIASES_BY_CODE = {
    1: ["Arroz integral cozido"],
    3: ["Arroz branco cozido"],
    7: ["Aveia"],
    52: ["Pão integral"],
    53: ["Pão francês"],
    88: ["Batata-doce cozida"],
    91: ["Batata inglesa cozida"],
    182: ["Banana"],
    221: ["Maçã"],
    377: ["Patinho grelhado"],
    410: ["Frango grelhado"],
    458: ["Leite"],
    461: ["Queijo minas frescal"],
    488: ["Ovo de galinha"],
    551: ["Tapioca"],
    561: ["Feijão carioca cozido"],
    567: ["Feijão preto cozido"],
}


def _cell_text(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(t.text or "" for t in cell.iterfind(".//{*}t"))

    value = cell.find("{*}v")
    if value is None or value.text is None:
        return ""

    raw = value.text
    if cell_type == "s":
        try:
            return shared_strings[int(raw)]
        except (ValueError, IndexError):
            return ""
    return raw


def _column_index(reference: str) -> int:
    letters = re.sub(r"[^A-Z]", "", reference.upper())
    index = 0
    for char in letters:
      index = index * 26 + (ord(char) - 64)
    return index


def _parse_number(raw: str) -> Any:
    text = (raw or "").strip()
    if not text or text.upper() in {"NA", "TR"}:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return int(value) if value.is_integer() else value


def _download_if_needed(source: str | None) -> Path:
    if source and source.startswith(("http://", "https://")):
        tmp = Path(tempfile.mkdtemp(prefix="taco-import-")) / "taco.xlsx"
        urllib.request.urlretrieve(source, tmp)
        return tmp

    if source:
        path = Path(source)
        if path.exists():
            return path

    tmp = Path(tempfile.mkdtemp(prefix="taco-import-")) / "taco.xlsx"
    urllib.request.urlretrieve(OFFICIAL_XLSX_URL, tmp)
    return tmp


def load_taco_foods(xlsx_path: Path) -> list[dict[str, Any]]:
    with zipfile.ZipFile(xlsx_path) as workbook:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            shared_root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            for si in shared_root.findall("{*}si"):
                text = "".join(t.text or "" for t in si.iterfind(".//{*}t"))
                shared_strings.append(text)

        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        rows = sheet.findall(".//{*}sheetData/{*}row")

        current_category = None
        foods: list[dict[str, Any]] = []

        for row in rows:
            row_index = int(row.attrib.get("r", "0"))
            if row_index >= 689:
                break

            cells: dict[int, str] = {}
            for cell in row.findall("{*}c"):
                cells[_column_index(cell.attrib["r"])] = _cell_text(cell, shared_strings)

            first = (cells.get(1) or "").strip()
            second = (cells.get(2) or "").strip()

            if row_index >= 4 and first and not first.isdigit() and not second and first not in {
                "Número do",
                "Alimento",
                "Descrição dos alimentos",
                "Legenda",
            }:
                current_category = first
                continue

            if not first.isdigit():
                continue

            codigo = int(first)
            item = {
                "taco_id": f"TACO_{codigo:04d}",
                "codigo_taco": codigo,
                "nome": second,
                "categoria": current_category,
            }

            for col, field in FIELD_BY_COLUMN.items():
                item[field] = _parse_number(cells.get(col, ""))

            item["vitamina_e_mcg"] = None

            aliases = ALIASES_BY_CODE.get(codigo)
            if aliases:
                item["aliases"] = aliases

            foods.append(item)

    return foods


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa a TACO 4ª edição para JSON.")
    parser.add_argument(
        "--source",
        default=OFFICIAL_XLSX_URL,
        help="Caminho local ou URL do arquivo .xlsx oficial da TACO.",
    )
    parser.add_argument(
        "--output",
        default="src/lib/nutrition/tacoDatabase.json",
        help="Arquivo JSON de saída.",
    )
    args = parser.parse_args()

    xlsx_path = _download_if_needed(args.source)
    foods = load_taco_foods(xlsx_path)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(foods, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "source": str(xlsx_path),
        "output": str(output_path),
        "foods": len(foods),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
