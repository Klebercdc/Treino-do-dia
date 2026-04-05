# Workout Template Format

`/api/kronia/workout` so gera `workout_primary` quando o Supabase fornece um template referenciado valido em `workout_templates.templates`.

Sem esse formato, o backend retorna `workout_failsafe` com:
- `validationError: WORKOUT_TEMPLATE_MISSING`
- ou `validationError: INVALID_WORKOUT_TEMPLATE_SHAPE`

## Tabela

- tabela: `workout_templates`
- coluna usada: `templates` (`jsonb`)
- criterio atual: template mais recente do usuario por `updated_at desc`

## Formato aceito

O parser aceita:
- um array de templates
- ou um objeto com `templates: []`
- ou um objeto unico com `treinos`

Cada template valido precisa ter:
- `treinos`
- ao menos 1 exercicio valido por treino
- `evidenceReferences` ou `references` com pelo menos 1 referencia utilizavel

## Campos do template

```json
{
  "id": "hipertrofia-base-v1",
  "name": "Hipertrofia Base",
  "evidenceReferences": [
    {
      "title": "ACSM Position Stand",
      "source": "ACSM",
      "href": "https://example.org/acsm-position-stand",
      "level": "guideline"
    }
  ],
  "treinos": [
    {
      "nome": "Treino A",
      "grupo": "peito/triceps",
      "exercicios": [
        {
          "nome": "Supino reto com barra",
          "series": 4,
          "reps": "6-8",
          "descanso": "120s",
          "source_ref": "acsm-1"
        }
      ]
    }
  ]
}
```

## Campos obrigatorios por exercicio

- `nome`
- `series`
- `reps`
- `source_ref`

`descanso` e opcional, mas recomendado.

## Regras de validacao atuais

1. `treinos` precisa existir e ter pelo menos um item valido.
2. Cada treino precisa ter `exercicios`.
3. Cada exercicio precisa ter `nome`.
4. O backend normaliza:
   - `name` -> `nome`
   - `sets` -> `series`
   - `repeticoes` -> `reps`
   - `rest` -> `descanso`
   - `reference_id` -> `source_ref`
5. `evidenceReferences` aceita alias `references` e `scientificReferences`.

## Exemplo recomendado na coluna `templates`

Veja [workout-template.example.json](/root/Treino-do-dia/examples/workout-template.example.json).

## Resultado esperado

Se o JSON estiver valido e houver autenticacao/plano/permissoes:
- a rota responde `workout_primary`
- o app aplica o treino na tela

Se estiver faltando ou invalido:
- a rota responde `workout_failsafe`
- o app bloqueia a geracao
- nenhuma prescricao especulativa e criada
