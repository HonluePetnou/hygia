"""Ajoute `src/` au chemin d'import (importé en premier par chaque test)."""
import pathlib
import sys

SRC = str(pathlib.Path(__file__).resolve().parent.parent / "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)
