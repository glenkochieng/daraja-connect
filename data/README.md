# Data

This folder is a signpost. The project's datasets live next to the code that uses them:

| Data | Location |
|---|---|
| Synthetic mentors, mentees and relevance labels | [`ml-service/data/synthetic/`](../ml-service/data/synthetic/) |
| Aviation mentoring taxonomy and glossary | [`ml-service/data/taxonomy/`](../ml-service/data/taxonomy/) |
| Kenya Airways public vocabulary and page snapshots | [`ml-service/data/kq_public/`](../ml-service/data/kq_public/) |
| Expert rating kit | [`ml-service/ratings/`](../ml-service/ratings/) |
| Sample articles, events and updates for the web app | [`server/src/seed/`](../server/src/seed/) |

What each dataset is, where it came from and its limits: [docs/datasets.md](../docs/datasets.md).

## Rules for adding data

1. **Never commit real personal data.** Real profiles, rating sheets or exports go in `data/real/` (or `ml-service/data/real/`, `ml-service/ratings/real/`), which are gitignored.
2. **Never commit secrets** such as connection strings or keys inside data files.
3. **Keep large files out of git.** Anything over a few megabytes, and model artefacts (`*.pkl`, `*.joblib`, `*.onnx`, `*.parquet`), are gitignored; regenerate them with the scripts instead.
4. **Record provenance.** New public data needs its source URL, the date it was collected and why it may be used, in the folder's README or `SOURCES.md`.
5. **Label synthetic data.** Anything generated must say so wherever it could be mistaken for real people.
