import sys

KEYS = {
    'nav.epidemiology': ('Carte épidémiologique', 'Epidemiology map'),
    'epidemiology.title': ('Veille épidémiologique', 'Epidemiological surveillance'),
    'epidemiology.subtitle': ('Cas par pathologie et par district sanitaire, mis à jour en continu', 'Cases by pathology and health district, updated continuously'),
    'epidemiology.pseudonymized': ('Données pseudonymisées', 'Pseudonymized data'),
    'epidemiology.pathologies': ('Pathologie', 'Pathology'),
    'epidemiology.pathology.choléra': ('Choléra', 'Cholera'),
    'epidemiology.pathology.paludisme': ('Paludisme', 'Malaria'),
    'epidemiology.pathology.rougeole': ('Rougeole', 'Measles'),
    'epidemiology.pathology.dengue': ('Dengue', 'Dengue'),
    'epidemiology.pathology.mpox': ('Mpox', 'Mpox'),
    'epidemiology.period': ('Période', 'Period'),
    'epidemiology.period.0': ('Semaine en cours', 'Current week'),
    'epidemiology.period.1': ('Il y a 1 semaine', '1 week ago'),
    'epidemiology.period.2': ('Il y a 2 semaines', '2 weeks ago'),
    'epidemiology.period.3': ('Il y a 3 semaines', '3 weeks ago'),
    'epidemiology.region': ('Région', 'Region'),
    'epidemiology.region.all': ('Tout le Cameroun', 'All of Cameroon'),
    'epidemiology.region.extreme-nord': ('Extrême-Nord', 'Far North'),
    'epidemiology.region.nord': ('Nord', 'North'),
    'epidemiology.region.adamaoua': ('Adamaoua', 'Adamawa'),
    'epidemiology.region.est': ('Est', 'East'),
    'epidemiology.region.centre': ('Centre', 'Centre'),
    'epidemiology.region.littoral': ('Littoral', 'Littoral'),
    'epidemiology.region.ouest': ('Ouest', 'West'),
    'epidemiology.region.nord-ouest': ('Nord-Ouest', 'North-West'),
    'epidemiology.region.sud-ouest': ('Sud-Ouest', 'South-West'),
    'epidemiology.region.sud': ('Sud', 'South'),
    'epidemiology.map.title': ('{pathology} · semaine {week}', '{pathology} · week {week}'),
    'epidemiology.map.summary': ('{cases} cas notifiés · {regions} régions', '{cases} cases reported · {regions} regions'),
    'epidemiology.map.label': ('Carte du Cameroun : cas par district sanitaire', 'Map of Cameroon: cases by health district'),
    'epidemiology.map.tooltip': ('{district} : {cases} cas · {level}', '{district}: {cases} cases · {level}'),
    'epidemiology.live.live': ('Temps réel', 'Live'),
    'epidemiology.live.connecting': ('Connexion…', 'Connecting…'),
    'epidemiology.live.offline': ('Hors ligne', 'Offline'),
    'epidemiology.live.received': ('{count} nouveaux cas reçus', '{count} new cases received'),
    'epidemiology.legend.title': ('Niveau par district', 'Level by district'),
    'epidemiology.legend.outbreak': ('Foyer anormal (> moyenne + 2σ)', 'Abnormal outbreak (> mean + 2σ)'),
    'epidemiology.legend.rise': ('Hausse à surveiller', 'Rise to watch'),
    'epidemiology.legend.expected': ('Niveau attendu', 'Expected level'),
    'epidemiology.outbreak.title': ('Foyer anormal détecté', 'Abnormal outbreak detected'),
    'epidemiology.outbreak.text': ('{pathology} · district de santé de {district} : {cases} cas cette semaine pour {expected} attendus. Seuil d’alerte (moyenne mobile + 2 écarts-types) : {threshold}.', '{pathology} · health district of {district}: {cases} cases this week against {expected} expected. Alert threshold (moving average + 2 standard deviations): {threshold}.'),
    'epidemiology.outbreak.none': ('Aucun foyer anormal cette semaine pour ce filtre.', 'No abnormal outbreak this week for this filter.'),
    'epidemiology.outbreak.notify': ('Notifier la délégation', 'Notify the delegation'),
    'epidemiology.outbreak.notified': ('Délégation notifiée', 'Delegation notified'),
    'epidemiology.outbreak.notifyError': ('La notification a échoué, réessayez.', 'Notification failed, please try again.'),
    'epidemiology.chart.title': ('{district} · 12 dernières semaines', '{district} · last 12 weeks'),
    'epidemiology.chart.subtitle': ('Cas hebdomadaires et seuil d’alerte', 'Weekly cases and alert threshold'),
    'epidemiology.chart.label': ('Courbe des cas hebdomadaires de {district} avec le seuil d’alerte', 'Weekly cases curve for {district} with the alert threshold'),
    'epidemiology.chart.cases': ('Cas', 'Cases'),
    'epidemiology.chart.threshold': ('Seuil (moy. + 2σ)', 'Threshold (mean + 2σ)'),
    'epidemiology.chart.empty': ('Aucune donnée pour ce filtre.', 'No data for this filter.'),
    'epidemiology.districts.title': ('Districts les plus touchés', 'Most affected districts'),
    'epidemiology.districts.empty': ('Aucun cas pour ce filtre.', 'No cases for this filter.'),
    'epidemiology.districts.cases': ('{count} cas', '{count} cases'),
    'epidemiology.footer': ('Aucune donnée identifiante : agrégats calculés sur la branche analytique pseudonymisée. Détection des foyers exécutée par l’instance coordinatrice élue (bail DynamoDB).', 'No identifying data: aggregates computed on the pseudonymized analytics branch. Outbreak detection runs on the elected coordinator instance (DynamoDB lease).'),
    'epidemiology.forbidden': ('Cet écran est réservé au profil analyste.', 'This screen is reserved for the analyst profile.'),
    'epidemiology.error': ('Les données de veille sont indisponibles pour le moment.', 'Surveillance data is unavailable right now.'),
}


def quote(text):
    return "'" + text.replace('\\', '\\\\').replace("'", "\\'") + "'"


root = sys.argv[1]
for index, name in enumerate(('fr.ts', 'en.ts')):
    path = f'{root}/{name}'
    source = open(path, encoding='utf-8').read()
    pos = source.index('} as const;') if index == 0 else source.rindex('};')
    lines = ''.join(f'  {quote(k)}: {quote(v[index])},\n' for k, v in KEYS.items())
    open(path, 'w', encoding='utf-8').write(source[:pos] + lines + source[pos:])
