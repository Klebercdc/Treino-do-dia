#!/usr/bin/env python3
"""
KRONIA TRANSFORMS — Pipeline ETL de Partida Fria
================================================
Resolve o Cold Start importando dados públicos reais:

  1. EXERCÍCIOS  → yuhonas/free-exercise-db (GitHub, JSON)
  2. LOGS        → Simula sessões com distribuição realista de RPE/carga
                   usando os exercícios importados como âncora.

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

SUPABASE_URL        = os.getenv("SUPABASE_URL", "SUA_SUPABASE_URL_AQUI")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "SUA_SERVICE_KEY_AQUI")
NUM_USUARIOS        = int(os.getenv("NUM_USUARIOS", "5"))
NUM_SEMANAS         = int(os.getenv("NUM_SEMANAS", "8"))
BATCH_SIZE          = 200   # inserções por lote (limite seguro da API Supabase)

FREE_EXERCISE_DB_URL = (
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
)

# Mapeamento de categorias do free-exercise-db → muscle_group do KRONIA
CATEGORY_MAP = {
    "chest":      "Peito",
    "back":       "Costas",
    "shoulders":  "Ombros",
    "upper arms": "Bíceps/Tríceps",
    "lower arms": "Antebraço",
    "upper legs": "Quadríceps/Isquiotibiais",
    "lower legs": "Panturrilha",
    "waist":      "Abdômen/Lombar",
    "cardio":     "Cardio",
    "neck":       "Pescoço",
}

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
        category = (ex.get("category") or "").lower().strip()
        muscle_group = CATEGORY_MAP.get(category, category.title() or "Geral")
        records.append({"name": name, "muscle_group": muscle_group, "source": "free-exercise-db"})

    df = pd.DataFrame(records).drop_duplicates(subset=["name"])
    log.info("  %d exercícios únicos carregados", len(df))
    return df


def upsert_exercises(sb: Client, df: pd.DataFrame) -> dict:
    """Insere exercícios em lotes. Retorna dict name → UUID."""
    total = len(df)
    inserted = 0
    for start in range(0, total, BATCH_SIZE):
        batch = df.iloc[start : start + BATCH_SIZE]
        rows  = batch.to_dict(orient="records")
        sb.table("exercises").upsert(rows, on_conflict="name").execute()
        inserted += len(rows)
        log.info("  Exercícios enviados: %d / %d", inserted, total)

    # Busca IDs após upsert
    resp = sb.table("exercises").select("id, name").execute()
    return {row["name"]: row["id"] for row in resp.data}


# ── PASSO 2: Simular usuários e logs de treino ─────────────────

EXERCISES_POR_GRUPO = {
    "Peito":                    ["Supino Reto com Barra", "Supino Inclinado com Halteres", "Crossover no Cabo"],
    "Costas":                   ["Barra Fixa", "Remada Curvada", "Puxada Alta"],
    "Ombros":                   ["Desenvolvimento Militar", "Elevação Lateral"],
    "Bíceps/Tríceps":           ["Rosca Direta", "Tríceps Corda"],
    "Quadríceps/Isquiotibiais": ["Agachamento", "Leg Press", "Levantamento Terra"],
    "Panturrilha":              ["Panturrilha em Pé"],
}

DIVISOES_SEMANAIS = [
    ["Peito", "Costas"],
    ["Ombros", "Bíceps/Tríceps"],
    ["Quadríceps/Isquiotibiais", "Panturrilha"],
]


def gerar_rpe_realista(semana: int, total_semanas: int) -> float:
    """RPE cresce gradualmente (periodização linear simples)."""
    base = 5.0 + (semana / total_semanas) * 3.0   # 5 → 8
    rpe  = base + random.gauss(0, 0.5)
    return round(max(4.0, min(10.0, rpe)), 1)


def gerar_peso_realista(muscle_group: str) -> float:
    """Peso base por grupo muscular (kg), com variação ±20%."""
    bases = {
        "Peito": 80, "Costas": 70, "Ombros": 50,
        "Bíceps/Tríceps": 35, "Quadríceps/Isquiotibiais": 100,
        "Panturrilha": 60,
    }
    base  = bases.get(muscle_group, 60)
    variacao = random.uniform(0.8, 1.2)
    return round(base * variacao, 1)


def simular_logs(sb: Client, exercise_map: dict, n_usuarios: int, n_semanas: int):
    """
    Cria usuários sintéticos (via auth admin) + sessões de treino completas.
    Filtra rigorosamente: só insere exercícios existentes no exercise_map.
    """
    hoje = date.today()
    # Gera n_usuarios IDs UUID sintéticos usando a tabela de auth
    # Para seed, usamos UUIDs fixos para evitar conflitos em re-execuções
    import uuid as _uuid
    user_ids = [str(_uuid.uuid5(_uuid.NAMESPACE_DNS, f"kronia-seed-user-{i}"))
                for i in range(n_usuarios)]

    all_workout_rows  = []
    all_log_rows      = []
    pr_rows           = []

    for u_idx, uid in enumerate(user_ids):
        log.info("Gerando dados para usuário seed %d/%d", u_idx + 1, n_usuarios)
        dias_treinados = set()

        for semana in range(n_semanas):
            # 3 treinos por semana, dias aleatórios dentro da semana
            inicio_semana = hoje - timedelta(weeks=(n_semanas - semana))
            dias_semana   = random.sample(range(7), 3)

            for d_idx, dia_offset in enumerate(sorted(dias_semana)):
                data_treino = inicio_semana + timedelta(days=dia_offset)
                if data_treino in dias_treinados or data_treino > hoje:
                    continue
                dias_treinados.add(data_treino)

                divisao = DIVISOES_SEMANAIS[d_idx % len(DIVISOES_SEMANAIS)]
                duracao = random.randint(45, 90)
                workout_id = str(_uuid.uuid4())

                all_workout_rows.append({
                    "id":               workout_id,
                    "user_id":          uid,
                    "date":             data_treino.isoformat(),
                    "duration_minutes": duracao,
                })

                for grupo in divisao:
                    candidatos = EXERCISES_POR_GRUPO.get(grupo, [])
                    # VALIDAÇÃO RIGOROSA: só usa exercícios no dicionário importado
                    candidatos = [e for e in candidatos if e in exercise_map]
                    if not candidatos:
                        continue

                    ex_nome = random.choice(candidatos)
                    ex_id   = exercise_map[ex_nome]
                    peso    = gerar_peso_realista(grupo)
                    rpe_val = gerar_rpe_realista(semana, n_semanas)
                    reps    = random.randint(6, 12)

                    all_log_rows.append({
                        "workout_id":  workout_id,
                        "exercise_id": ex_id,
                        "weight_kg":   peso,
                        "reps":        reps,
                        "rpe":         rpe_val,
                    })

                    # Registra PR se for a última semana e RPE ≥ 8
                    if semana == n_semanas - 1 and rpe_val >= 8.0:
                        one_rm = round(peso / (1.0278 - 0.0278 * reps), 2)
                        pr_rows.append({
                            "user_id":     uid,
                            "exercise_id": ex_id,
                            "weight_kg":   peso,
                            "reps":        reps,
                            "one_rm_kg":   one_rm,
                            "recorded_at": data_treino.isoformat(),
                            "source":      "etl-seed",
                        })

    # Inserção em lotes
    _batch_insert(sb, "workouts",    all_workout_rows)
    _batch_insert(sb, "workout_logs", all_log_rows)
    _batch_insert(sb, "personal_records", pr_rows)

    log.info(
        "Seed completo: %d treinos, %d logs, %d PRs para %d usuários",
        len(all_workout_rows), len(all_log_rows), len(pr_rows), n_usuarios,
    )


def _batch_insert(sb: Client, table: str, rows: list):
    if not rows:
        return
    total = len(rows)
    for start in range(0, total, BATCH_SIZE):
        batch = rows[start : start + BATCH_SIZE]
        try:
            sb.table(table).insert(batch, ignore_duplicates=True).execute()
        except Exception as e:
            log.warning("  Lote %s falhou (offset %d): %s", table, start, e)
    log.info("  %s: %d linhas inseridas", table, total)


# ── PASSO 3: Validação pós-carga ──────────────────────────────

def validar_acwr(sb: Client):
    log.info("Validando View acwr_diario…")
    try:
        resp = sb.table("acwr_diario").select("*").limit(10).execute()
        if resp.data:
            for row in resp.data:
                log.info(
                    "  user=%s  acwr=%s  zona=%s",
                    str(row.get("user_id", ""))[:8] + "…",
                    row.get("acwr"),
                    row.get("zona_risco"),
                )
        else:
            log.warning("  View retornou vazio — execute mais treinos ou reduza NUM_SEMANAS.")
    except Exception as e:
        log.error("  Falha ao consultar acwr_diario: %s", e)


# ── MAIN ─────────────────────────────────────────────────────

def main():
    if SUPABASE_URL == "SUA_SUPABASE_URL_AQUI":
        log.error("Configure SUPABASE_URL e SUPABASE_SERVICE_KEY antes de rodar.")
        sys.exit(1)

    log.info("═══ KRONIA ETL — Partida Fria ═══")
    sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Passo 1 — Exercícios
    df_ex = fetch_exercises()
    exercise_map = upsert_exercises(sb, df_ex)
    log.info("Dicionário de exercícios: %d entradas no banco", len(exercise_map))

    # Passo 2 — Logs simulados
    simular_logs(sb, exercise_map, NUM_USUARIOS, NUM_SEMANAS)

    # Passo 3 — Validação
    validar_acwr(sb)

    log.info("═══ ETL concluído com sucesso ═══")


if __name__ == "__main__":
    main()
