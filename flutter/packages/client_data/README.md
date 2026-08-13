# Poko client data

Local-first persistence boundary. Drift supplies the cross-platform SQLite
connection; Phase 3 owns schema, migrations, outbox, repositories, and consent
enforcement. Importing this package performs no I/O.
