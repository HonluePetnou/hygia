"""Agent de pharmacovigilance : interactions, doublons thérapeutiques, allergies."""
from __future__ import annotations

from typing import Any

from .agent import Agent
from .models import PRESCRIPTION_CREATED, DetectedIssue, Event, Source, raise_severity

# Classe thérapeutique par substance (table locale).
DRUG_CLASSES = {
    "warfarine": "AVK", "fluindione": "AVK", "acenocoumarol": "AVK",
    "ibuprofene": "AINS", "diclofenac": "AINS", "ketoprofene": "AINS", "naproxene": "AINS",
    "ramipril": "IEC", "perindopril": "IEC", "enalapril": "IEC", "lisinopril": "IEC",
    "amoxicilline": "PENICILLINE", "ampicilline": "PENICILLINE",
}
# Paire de classes -> (gravité de base, titre, proposition)
INTERACTIONS = {
    frozenset(("AVK", "AINS")): (
        "moderate", "Interaction majeure AVK + AINS (risque hémorragique)",
        "Remplacer l'AINS (ex. paracétamol) et contrôler l'INR."),
    frozenset(("IEC",)): (
        "low", "Doublon thérapeutique : deux IEC",
        "Arrêter l'un des deux inhibiteurs de l'enzyme de conversion."),
}
# Allergie déclarée -> classe contre-indiquée
ALLERGY_CLASSES = {"penicilline": "PENICILLINE"}


def normalize(text: str) -> str:
    """Minuscule sans accents."""
    return text.lower().translate(str.maketrans("éèêëàâùûüîïôç", "eeeeaauuuiioc")).strip()


def _source(item: dict[str, Any], excerpt: str) -> Source:
    doc = item["documentId"]
    return Source(doc if "/" in doc else f"DocumentReference/{doc}", excerpt, item.get("documentTitle"))


class PharmacovigilanceAgent(Agent):
    """Réagit à `prescription.created`.

    Payload : `patient {id, age}`, `prescription {drug, documentId}`,
    `activeMedications [{drug, documentId}]`, `allergies [{substance, documentId}]`,
    `observations [{code: "INR", value, targetHigh, documentId}]`.
    """

    name = "pharmacovigilance"
    event_type = PRESCRIPTION_CREATED

    def handle(self, event: Event) -> list[DetectedIssue]:
        p = event.payload
        new = p["prescription"]
        new_class = DRUG_CLASSES.get(normalize(new["drug"]))
        if new_class is None:
            return []
        pid = p["patient"]["id"]
        subject = pid if "/" in pid else f"Patient/{pid}"
        issues = []
        for med in p.get("activeMedications", []):
            issue = self._interaction(p, subject, new, new_class, med)
            if issue:
                issues.append(issue)
        issues.extend(self._allergies(p, subject, new, new_class))
        return issues

    def _interaction(
        self, p: dict[str, Any], subject: str, new: dict[str, Any], new_class: str, med: dict[str, Any]
    ) -> DetectedIssue | None:
        med_class = DRUG_CLASSES.get(normalize(med["drug"]))
        rule = INTERACTIONS.get(frozenset((new_class, med_class))) if med_class else None
        if rule is None:
            return None
        base, title, proposal = rule
        reasoning = [
            f"Nouvelle prescription : {new['drug']} (classe {new_class}).",
            f"Traitement en cours : {med['drug']} (classe {med_class}).",
            f"La table d'interactions classe l'association {med_class} + {new_class} : {title}.",
        ]
        sources = [_source(new, f"{new['drug']} prescrit"), _source(med, f"{med['drug']} en cours")]
        factors = self._context(p, sources)
        severity = raise_severity(base, len(factors))
        reasoning.append(
            f"Contexte aggravant ({' ; '.join(factors)}) : gravité relevée à « {severity} »."
            if factors else f"Aucun facteur aggravant : gravité « {severity} »."
        )
        return DetectedIssue(self.name, severity, title, reasoning, sources, proposal, subject)

    @staticmethod
    def _context(p: dict[str, Any], sources: list[Source]) -> list[str]:
        """Facteurs aggravants (âge ≥ 70, INR haut de cible) ; ajoute leurs sources."""
        factors = []
        age = p["patient"].get("age")
        if age is not None and age >= 70:
            factors.append(f"patient de {age} ans, seuil de 70 ans atteint")
        for obs in p.get("observations", []):
            if obs.get("code") == "INR" and obs["value"] >= obs["targetHigh"] - 0.3:
                factors.append(f"INR à {obs['value']}, haut de cible (≤ {obs['targetHigh']})")
                sources.append(_source(obs, f"INR {obs['value']}"))
        return factors

    def _allergies(
        self, p: dict[str, Any], subject: str, new: dict[str, Any], new_class: str
    ) -> list[DetectedIssue]:
        out = []
        for allergy in p.get("allergies", []):
            if ALLERGY_CLASSES.get(normalize(allergy["substance"])) != new_class:
                continue
            reasoning = [
                f"Nouvelle prescription : {new['drug']} (classe {new_class}).",
                f"Allergie documentée : {allergy['substance']}.",
                f"{new['drug']} appartient à la classe contre-indiquée par cette allergie.",
            ]
            out.append(DetectedIssue(
                self.name, "high", f"Allergie connue ({allergy['substance']}) : {new['drug']}", reasoning,
                [_source(new, f"{new['drug']} prescrit"), _source(allergy, f"Allergie : {allergy['substance']}")],
                "Annuler la prescription et choisir une autre classe thérapeutique.", subject))
        return out
