#!/usr/bin/env python3
"""
KRONIA TRANSFORMS — Pipeline ETL de Partida Fria (v2)
======================================================
Resolve o Cold Start importando dados públicos reais:

  1. EXERCÍCIOS  → yuhonas/free-exercise-db (GitHub, JSON)
                   Captura TODOS os campos: instruções, imagem,
                   nível, equipamento, mecânica, músculos.

  2. LOGS        → Simula sessões com distribuição realista de RPE/carga
                   usando os exercícios importados como âncora.

  3. EXPORT      → Gera seed_preview.json com PRs e exercícios
                   prontos para usar em prompts de IA ou debug.

Uso:
  pip install requests pandas supabase python-dotenv
  python etl/seed_kronia.py

Variáveis de ambiente necessárias (.env ou export):
  SUPABASE_URL           → URL do projeto Supabase
  SUPABASE_SERVICE_KEY   → Service Role Key (NÃO a anon key)
  NUM_USUARIOS           → Quantos usuários sintéticos criar (padrão: 5)
  NUM_SEMANAS            → Semanas de histórico a gerar (padrão: 8)
"""

import os
import sys
import json
import random
import logging
from datetime import date, timedelta
from urllib.request import urlopen

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Configuração ──────────────────────────────────────────────
load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("kronia-etl")

SUPABASE_URL         = os.getenv("SUPABASE_URL", "SUA_SUPABASE_URL_AQUI")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "SUA_SERVICE_KEY_AQUI")
NUM_USUARIOS         = int(os.getenv("NUM_USUARIOS", "5"))
NUM_SEMANAS          = int(os.getenv("NUM_SEMANAS", "8"))
BATCH_SIZE           = 200

FREE_EXERCISE_DB_URL = (
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
)
FREE_EXERCISE_IMG_BASE = (
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
)

# Mapeamento muscle → grupo em PT
MUSCLE_MAP = {
    "abdominals":   "Abdômen",
    "abductors":    "Abdutores",
    "adductors":    "Adutores",
    "biceps":       "Bíceps",
    "calves":       "Panturrilha",
    "chest":        "Peito",
    "forearms":     "Antebraço",
    "glutes":       "Glúteos",
    "hamstrings":   "Isquiotibiais",
    "lats":         "Costas",
    "lower back":   "Lombar",
    "middle back":  "Costas",
    "neck":         "Pescoço",
    "quadriceps":   "Quadríceps",
    "shoulders":    "Ombros",
    "traps":        "Trapézio",
    "triceps":      "Tríceps",
}

VALID_LEVELS    = {"beginner", "intermediate", "expert"}
VALID_FORCES    = {"push", "pull", "static"}
VALID_MECHANICS = {"compound", "isolation"}


# ── PASSO 1: Carregar exercícios do GitHub ─────────────────────

def fetch_exercises() -> pd.DataFrame:
    log.info("Buscando exercícios em %s", FREE_EXERCISE_DB_URL)
    with urlopen(FREE_EXERCISE_DB_URL, timeout=30) as resp:
        raw = json.loads(resp.read().decode("utf-8"))

    records = []
    for ex in raw:
        name = (ex.get("name") or "").strip()
        if not name:
            continue

        primary = ex.get("primaryMuscles") or []
        muscle_group = MUSCLE_MAP.get(
            (primary[0] if primary else "").lower(), "Geral"
        )

        secondary = [
            MUSCLE_MAP.get(m.lower(), m.title())
            for m in (ex.get("secondaryMuscles") or [])
        ]

        # Imagem principal: URL direta no GitHub raw
        images = ex.get("images") or []
        image_url = (
            f"{FREE_EXERCISE_IMG_BASE}/{ex['id']}/0.jpg" if images else None
        )

        level     = ex.get("level") if ex.get("level") in VALID_LEVELS else None
        force_raw = ex.get("force") or ""
        force     = force_raw if force_raw in VALID_FORCES else None
        mechanic  = ex.get("mechanic") if ex.get("mechanic") in VALID_MECHANICS else None
        equipment = ex.get("equipment") or None
        instructions = ex.get("instructions") or []

        records.append({
            "name":              name,
            "muscle_group":      muscle_group,
            "secondary_muscles": secondary or None,
            "image_url":         image_url,
            "level":             level,
            "force_type":        force,
            "mechanic":          mechanic,
            "equipment":         equipment,
            "instructions":      instructions or None,
            "source":            "free-exercise-db",
        })

    df = pd.DataFrame(records).drop_duplicates(subset=["name"])
    log.info("  %d exercícios únicos carregados", len(df))
    return df


def upsert_exercises(sb: Client, df: pd.DataFrame) -> dict:
    """Insere exercícios em lotes. Retorna dict name → UUID."""
    total = len(df)
    inserted = 0
    for start in range(0, total, BATCH_SIZE):
        batch = df.iloc[start: start + BATCH_SIZE]
        rows = []
        for r in batch.to_dict(orient="records"):
            # Converte listas Python → tipos compatíveis com Supabase
            row = {k: v for k, v in r.items() if v is not None}
            if "secondary_muscles" in row and isinstance(row["secondary_muscles"], list):
                row["secondary_muscles"] = row["secondary_muscles"]
            if "instructions" in row and isinstance(row["instructions"], list):
                row["instructions"] = row["instructions"]
            rows.append(row)
        sb.table("exercises").upsert(rows, on_conflict="name").execute()
        inserted += len(rows)
        log.info("  Exercícios enviados: %d / %d", inserted, total)

    resp = sb.table("exercises").select("id, name").execute()
    return {row["name"]: row["id"] for row in resp.data}


# ── PASSO 2: Simular usuários e logs de treino ─────────────────

EXERCISES_POR_GRUPO = {
    "Peito":        ["Barbell Bench Press", "Incline Dumbbell Press", "Cable Crossover", "Push-Up"],
    "Costas":       ["Pull-Up", "Barbell Row", "Lat Pulldown", "Seated Cable Row"],
    "Ombros":       ["Overhead Press", "Lateral Raise", "Front Raise"],
    "Bíceps":       ["Barbell Curl", "Dumbbell Curl", "Hammer Curl"],
    "Tríceps":      ["Tricep Rope Pushdown", "Skull Crusher", "Dips - Triceps Version"],
    "Quadríceps":   ["Barbell Squat", "Leg Press", "Leg Extension"],
    "Isquiotibiais":["Romanian Deadlift", "Leg Curl", "Good Morning"],
    "Glúteos":      ["Hip Thrust", "Glute Bridge", "Cable Pull Through"],
    "Panturrilha":  ["Standing Calf Raises", "Seated Calf Raise"],
    "Abdômen":      ["Crunch", "Plank", "Leg Raises"],
}

DIVISOES_SEMANAIS = [
    ["Peito", "Tríceps", "Ombros"],
    ["Costas", "Bíceps"],
    ["Quadríceps", "Isquiotibiais", "Glúteos", "Panturrilha"],
]

PESO_BASE = {
    "Peito": 80, "Costas": 75, "Ombros": 50,
    "Bíceps": 30, "Tríceps": 40,
    "Quadríceps": 100, "Isquiotibiais": 70,
    "Glúteos": 80, "Panturrilha": 60, "Abdômen": 0,
}


def gerar_rpe(semana: int, total: int) -> float:
    base = 5.5 + (semana / total) * 2.5   # 5.5 → 8.0
    return round(max(4.0, min(10.0, base + random.gauss(0, 0.4))), 1)


def gerar_peso(grupo: str, semana: int, total: int) -> float:
    base = PESO_BASE.get(grupo, 60)
    if base == 0:
        return 0.0
    progressao = 1 + (semana / total) * 0.15   # +15% ao longo do período
    return round(base * progressao * random.uniform(0.9, 1.1), 1)


def simular_logs(sb: Client, exercise_map: dict, n_usuarios: int, n_semanas: int):
    import uuid as _uuid

    hoje = date.today()
    user_ids = [
        str(_uuid.uuid5(_uuid.NAMESPACE_DNS, f"kronia-seed-user-{i}"))
        for i in range(n_usuarios)
    ]

    all_workout_rows = []
    all_log_rows     = []
    pr_rows          = []

    # Coleta PRs por exercício para exportar
    pr_por_exercicio = {}

    for u_idx, uid in enumerate(user_ids):
        log.info("Gerando dados para usuário seed %d/%d", u_idx + 1, n_usuarios)
        dias_treinados = set()
        best_per_exercise = {}   # exercise_name → {"weight_kg","reps","rpe","one_rm_kg"}

        for semana in range(n_semanas):
            inicio_semana = hoje - timedelta(weeks=(n_semanas - semana))
            dias_semana   = random.sample(range(7), 3)

            for d_idx, dia_offset in enumerate(sorted(dias_semana)):
                data_treino = inicio_semana + timedelta(days=dia_offset)
                if data_treino in dias_treinados or data_treino > hoje:
                    continue
                dias_treinados.add(data_treino)

                divisao  = DIVISOES_SEMANAIS[d_idx % len(DIVISOES_SEMANAIS)]
                duracao  = random.randint(45, 90)
                workout_id = str(_uuid.uuid4())

                all_workout_rows.append({
                    "id":               workout_id,
                    "user_id":          uid,
                    "date":             data_treino.isoformat(),
                    "duration_minutes": duracao,
                })

                for grupo in divisao:
                    candidatos = [
                        e for e in EXERCISES_POR_GRUPO.get(grupo, [])
                        if e in exercise_map
                    ]
                    if not candidatos:
                        continue

                    # 2–3 exercícios por grupo
                    escolhidos = random.sample(candidatos, min(len(candidatos), random.randint(2, 3)))

                    for ex_nome in escolhidos:
                        ex_id  = exercise_map[ex_nome]
                        peso   = gerar_peso(grupo, semana, n_semanas)
                        rpe    = gerar_rpe(semana, n_semanas)
                        reps   = random.randint(6, 12)
                        sets_n = random.randint(3, 5)

                        for _ in range(sets_n):
                            all_log_rows.append({
                                "workout_id":  workout_id,
                                "exercise_id": ex_id,
                                "weight_kg":   peso,
                                "reps":        reps,
                                "rpe":         rpe,
                            })

                        # Atualiza melhor performance (PR)
                        one_rm = round(peso / (1.0278 - 0.0278 * reps), 2) if reps <= 10 and peso > 0 else None
                        prev = best_per_exercise.get(ex_nome)
                        if one_rm and (prev is None or one_rm > prev["one_rm_kg"]):
                            best_per_exercise[ex_nome] = {
                                "user_id":     uid,
                                "exercise_id": ex_id,
                                "weight_kg":   peso,
                                "reps":        reps,
                                "one_rm_kg":   one_rm,
                                "recorded_at": data_treino.isoformat(),
                                "source":      "etl-seed",
                            }
                            # Coleta para exportação
                            if ex_nome not in pr_por_exercicio or one_rm > pr_por_exercicio[ex_nome]["one_rm_kg"]:
                                pr_por_exercicio[ex_nome] = {
                                    "exercise": ex_nome,
                                    "weight_kg": peso,
                                    "reps":      reps,
                                    "one_rm_kg": one_rm,
                                }

        pr_rows.extend(best_per_exercise.values())

    _batch_insert(sb, "workouts",      all_workout_rows)
    _batch_insert(sb, "workout_logs",  all_log_rows)
    _batch_insert(sb, "personal_records", pr_rows)

    log.info(
        "Seed: %d treinos | %d logs | %d PRs | %d usuários",
        len(all_workout_rows), len(all_log_rows), len(pr_rows), n_usuarios,
    )
    return pr_por_exercicio


def _batch_insert(sb: Client, table: str, rows: list):
    if not rows:
        return
    total = len(rows)
    for start in range(0, total, BATCH_SIZE):
        batch = rows[start: start + BATCH_SIZE]
        try:
            sb.table(table).insert(batch, ignore_duplicates=True).execute()
        except Exception as e:
            log.warning("  Lote %s falhou (offset %d): %s", table, start, e)
    log.info("  %s: %d linhas", table, total)


# ── PASSO 3: Exportar preview para IA / debug ─────────────────

def exportar_preview(df_exercises: pd.DataFrame, pr_por_exercicio: dict):
    preview = {
        "total_exercicios": len(df_exercises),
        "grupos_musculares": sorted(df_exercises["muscle_group"].unique().tolist()),
        "equipamentos": sorted(df_exercises["equipment"].dropna().unique().tolist()),
        "niveis": sorted(df_exercises["level"].dropna().unique().tolist()),
        "exercicios_exemplo": df_exercises.head(10)[[
            "name", "muscle_group", "level", "equipment", "mechanic", "force_type"
        ]].to_dict(orient="records"),
        "personal_records_seed": list(pr_por_exercicio.values()),
    }

    output_path = os.path.join(os.path.dirname(__file__), "seed_preview.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(preview, f, ensure_ascii=False, indent=2)

    log.info("Preview exportado → %s", output_path)
    log.info("═══ PRs gerados (use em prompts de IA) ═══")
    for ex, pr in list(pr_por_exercicio.items())[:10]:
        log.info("  %-35s  %5.1f kg × %d reps  →  1RM ~%.1f kg",
                 ex, pr["weight_kg"], pr["reps"], pr["one_rm_kg"])
    if len(pr_por_exercicio) > 10:
        log.info("  ... e mais %d exercícios em seed_preview.json", len(pr_por_exercicio) - 10)


# ── PASSO 4: Validação ACWR ────────────────────────────────────

def validar_acwr(sb: Client):
    log.info("Validando View acwr_diario…")
    try:
        resp = sb.table("acwr_diario").select("*").limit(5).execute()
        if resp.data:
            for row in resp.data:
                log.info(
                    "  user=%.8s…  acwr=%s  zona=%s  último=%s",
                    row.get("user_id", ""),
                    row.get("acwr"),
                    row.get("zona_risco"),
                    row.get("ultimo_treino"),
                )
        else:
            log.warning("  View vazia — verifique NUM_SEMANAS.")
    except Exception as e:
        log.error("  Falha ao consultar acwr_diario: %s", e)


# ── MAIN ──────────────────────────────────────────────────────

def main():
    if SUPABASE_URL == "SUA_SUPABASE_URL_AQUI":
        log.error("Configure SUPABASE_URL e SUPABASE_SERVICE_KEY antes de rodar.")
        sys.exit(1)

    log.info("═══ KRONIA ETL v2 — Partida Fria ═══")
    sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # 1 — Exercícios completos
    df_ex = fetch_exercises()
    exercise_map = upsert_exercises(sb, df_ex)
    log.info("Dicionário: %d exercícios no banco", len(exercise_map))

    # 2 — Logs + PRs simulados
    pr_por_exercicio = simular_logs(sb, exercise_map, NUM_USUARIOS, NUM_SEMANAS)

    # 3 — Exporta preview JSON
    exportar_preview(df_ex, pr_por_exercicio)

    # 4 — Valida ACWR
    validar_acwr(sb)

    log.info("═══ ETL concluído ═══")


if __name__ == "__main__":
    main()
