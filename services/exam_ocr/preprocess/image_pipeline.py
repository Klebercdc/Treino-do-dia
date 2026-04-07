import cv2
import numpy as np

def preprocess_image(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    upscale = cv2.resize(gray, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC)
    denoise = cv2.fastNlMeansDenoising(upscale, None, 12, 7, 21)
    thresh = cv2.adaptiveThreshold(denoise, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 35, 11)
    padded = cv2.copyMakeBorder(thresh, 16, 16, 16, 16, cv2.BORDER_CONSTANT, value=255)
    return padded
