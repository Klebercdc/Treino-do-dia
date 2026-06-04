-- Adiciona coluna exam_date em lab_reports
-- Populada pelo pipeline OCR com a data real do exame extraída do documento.
-- Exames anteriores ficam NULL e aparecem por último na ordenação (NULLS LAST).

ALTER TABLE lab_reports
  ADD COLUMN IF NOT EXISTS exam_date DATE;

-- Índice para ordenação eficiente por usuário + data do exame
CREATE INDEX IF NOT EXISTS idx_lab_reports_exam_date
  ON lab_reports (user_id, exam_date DESC NULLS LAST);
