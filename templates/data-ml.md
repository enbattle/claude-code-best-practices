# CLAUDE.md — Data Science / ML Pipeline

## Project Overview

<!-- FILL IN -->

**Stack:** Python 3.11+, Pandas / Polars, <!-- PyTorch / scikit-learn / XGBoost -->
**Status:** <!-- Research / Active development / Production -->

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Data processing | <!-- Pandas / Polars --> |
| ML framework | <!-- PyTorch / scikit-learn / XGBoost --> |
| Experiment tracking | <!-- MLflow / Weights & Biases / Neptune --> |
| Orchestration | <!-- Prefect / Airflow / Dagster --> |
| Feature store | <!-- Feast / Tecton / custom --> |
| Model serving | <!-- FastAPI / BentoML / TorchServe --> |
| Storage | <!-- S3 / GCS / local --> |
| Environment | <!-- Conda / uv + venv --> |

---

## Project Structure

```
data/
├── raw/                  # Immutable source data — never modified
├── interim/              # Intermediate transformation outputs
├── processed/            # Final, model-ready datasets
└── external/             # Third-party data sources
notebooks/
├── exploration/          # Experimental — not production code
└── reports/              # Finalized analysis notebooks
src/
├── data/
│   ├── ingestion.py      # Data loading and validation
│   ├── preprocessing.py  # Cleaning and transformation
│   └── features.py       # Feature engineering
├── models/
│   ├── train.py          # Training pipeline
│   ├── evaluate.py       # Evaluation and metrics
│   └── predict.py        # Inference
├── pipelines/            # Orchestrated end-to-end pipelines
└── utils/                # Shared utilities
configs/                  # YAML experiment configs (never hardcode hyperparams)
tests/
models/                   # Saved model artifacts (gitignored, use DVC/S3)
```

---

## Development Commands

```bash
# Environment setup
uv sync                   # or: conda env create -f environment.yml

# Run pipeline stages
python src/data/ingestion.py          # Ingest raw data
python src/data/preprocessing.py     # Clean and transform
python src/models/train.py           # Train model

# With config
python src/models/train.py --config configs/experiment_001.yaml

# Tests
pytest tests/                         # All tests
pytest tests/unit/                    # Unit tests only
pytest --cov=src                      # With coverage

# Type checking
mypy src/

# Lint and format
ruff check src/ && ruff format src/

# Notebook → script
jupytext --to py notebooks/analysis.ipynb
```

---

## Architecture & Key Patterns

### Data immutability
Raw data in `data/raw/` is **never modified**. Every transformation creates a new artifact in `data/interim/` or `data/processed/`. If something goes wrong, you can always re-run from the raw source.

### Reproducibility requirements
Every experiment must be reproducible. This means:
- Seed all random number generators: `random.seed`, `np.random.seed`, `torch.manual_seed`
- Log the seed value in experiment tracking
- Pin dependency versions in `requirements.lock` or `pyproject.toml`
- Version datasets with DVC or log the S3 path + hash in the run

### Configuration over code
**Never hardcode hyperparameters, file paths, or feature lists** in Python files. All of these go in YAML config files:

```yaml
# configs/experiment_001.yaml
model:
  type: xgboost
  n_estimators: 500
  max_depth: 6
  learning_rate: 0.05
data:
  train_path: data/processed/train.parquet
  test_path: data/processed/test.parquet
features:
  - age
  - income
  - tenure
```

Load configs with `OmegaConf` or `Hydra`.

### Pipeline principles
- Each pipeline stage is idempotent — re-running produces the same output
- Stages are independent — avoid hidden state between stages
- Log data shapes and sample statistics at each stage transition
- Validate data schemas at ingestion with Pandera or Great Expectations

### Notebooks vs. production code
Notebooks are for exploration and communication only — not production. When analysis is finalized:
1. Extract logic into `src/` modules
2. Write unit tests for the extracted functions
3. Keep the notebook as documentation, not as the execution path

---

## Data Quality Requirements

### Schema validation
Validate data shape at pipeline entry points:

```python
import pandera as pa

schema = pa.DataFrameSchema({
    "age": pa.Column(int, pa.Check.between(0, 120)),
    "income": pa.Column(float, pa.Check.ge(0)),
    "label": pa.Column(int, pa.Check.isin([0, 1])),
})

validated_df = schema.validate(df)
```

### Null handling
- Document expected null rates per column
- Never silently drop nulls — log counts and percentages
- Distinguish between "missing" and "zero" — they often mean different things

### Data leakage prevention
- The test set must never be seen during feature engineering or preprocessing
- Fit all scalers/encoders on training data only, then transform test data
- Time-series splits must respect temporal ordering — no random splits

---

## Testing Requirements

- **Unit tests**: Pure transformation functions, feature engineering logic
- **Data validation tests**: Schema checks, null rate bounds, value range assertions
- **Pipeline tests**: End-to-end smoke test with a small data sample (100 rows)
- **Model tests**: Check that predictions are in the expected output range, output shape is correct

```python
def test_preprocess_output_schema():
    df_input = load_fixture("small_sample.parquet")
    df_output = preprocess(df_input)
    assert set(EXPECTED_COLUMNS).issubset(df_output.columns)
    assert df_output.isnull().sum().sum() == 0
```

---

## Experiment Tracking

Every training run must log:
- Git commit hash
- Dataset version / path + hash
- All hyperparameters (from config)
- Training and validation metrics (per epoch for neural nets)
- Feature importances (for tree models)
- Model artifacts

```python
import mlflow

with mlflow.start_run():
    mlflow.log_params(config.model.__dict__)
    mlflow.log_metric("val_auc", val_auc)
    mlflow.sklearn.log_model(model, "model")
```

---

## Security & Privacy

- PII columns must be hashed or anonymized before leaving the secure perimeter
- Never log raw PII (names, emails, SSNs) in experiment tracking
- Access to production data requires approval — use anonymized samples for development
- Model outputs (predictions) on PII-linked data have the same handling requirements as the PII itself

---

## Environment Variables

```bash
# Storage
DATA_DIR=data/
MODEL_DIR=models/
S3_BUCKET=your-ml-bucket

# Experiment tracking
MLFLOW_TRACKING_URI=http://localhost:5000
# WANDB_API_KEY=

# Cloud credentials — use IAM roles in production, not keys
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
```

---

## AI Agent Behavior

- Never modify files in `data/raw/` — treat it as read-only
- When adding a new feature, add a corresponding unit test in `tests/unit/test_features.py`
- Hyperparameter changes go in `configs/`, not in `src/`
- Run `mypy src/` — data pipeline bugs often surface as type errors
- If a notebook is being converted to production code, extract the logic first, then write tests, then delete the notebook cell that duplicates it
