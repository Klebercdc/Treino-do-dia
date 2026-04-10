from fastapi import FastAPI, HTTPException

from services.exam_ocr.service import extract_payload, health_payload
from services.exam_ocr.schemas import ExtractRequest, ExtractResponse

app = FastAPI(title="kronia_exam_ocr")


@app.get("/")
@app.get("/api/exam_ocr")
def health():
    return health_payload()


@app.post("/", response_model=ExtractResponse)
@app.post("/api/exam_ocr", response_model=ExtractResponse)
def extract(payload: ExtractRequest):
    try:
        result = extract_payload(payload.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    return ExtractResponse(**result)
