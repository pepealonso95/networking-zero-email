# 🤖 Modelos Entrenados

## Descripción

Este directorio contiene los modelos de Machine Learning entrenados para la clasificación de emails.

## Archivos Excluidos de Git

Los modelos entrenados (archivos `.pkl`, `.joblib`) están excluidos del repositorio por su tamaño y para evitar incluir datos entrenados con información personal.

## Modelos Disponibles Después del Entrenamiento

### Modelo Principal
- **Archivo**: `bill_classifier.pkl`
- **Algoritmo**: Logistic Regression 
- **Features**: Selected Features (20 características)
- **Performance**: F1=0.825, ROC-AUC=0.966

### Modelos de Comparación
- `random_forest_model.pkl` - Random Forest + Enhanced Features
- `svm_model.pkl` - SVM + TF-IDF Features  
- `gradient_boosting_model.pkl` - GB + Combined Features

### Metadatos de Modelos
- `bill_classifier_info.json` - Información del modelo principal
- `model_comparison_results.json` - Resultados de todos los modelos

## Regenerar Modelos

Para recrear los modelos después de clonar el repositorio:

```bash
# 1. Obtener datos de entrenamiento (usar tus propios emails)
python scripts/download_gmail_emails.py

# 2. Clasificar con GPT (requiere OpenAI API key)
python scripts/classify_with_gpt.py --input data/my_emails.csv --output data/labeled_emails.csv

# 3. Entrenar todos los modelos
python scripts/compare_feature_variants.py

# 4. Entrenar modelo específico
python scripts/train_model.py --features selected --algorithm logistic_regression
```

## Uso de Modelos Pre-entrenados

```python
import pickle
import pandas as pd

# Cargar modelo
with open('models/bill_classifier.pkl', 'rb') as f:
    model = pickle.load(f)

# Clasificar nuevo email
email_features = extract_features(email_data)
prediction = model.predict([email_features])
confidence = model.predict_proba([email_features])
``` 