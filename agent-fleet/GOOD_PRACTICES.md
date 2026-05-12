# Bonnes pratiques Python

Source : https://tainix.fr/article-technique/algorithmie-bonnes-pratiques-Python

---

## 1. Noms de variables clairs et significatifs

Utiliser le `snake_case`. Pas d'abréviations, pas de limite de longueur.

```python
# ❌
a = 90
b = 45
c = a - b

# ✅
total_match_time = 90
half_time_duration = 15
effective_play_time = total_match_time - half_time_duration
```

---

## 2. Constantes en majuscules

Python n'a pas de `const`. Convention : majuscules + underscores, au niveau du module.

```python
# ❌
circle_area = 3.14159 * radius ** 2

# ✅
PI = 3.14159
circle_area = PI * radius ** 2
```

---

## 3. Utiliser la bonne boucle

`for` quand le nombre d'itérations est connu. `while` réservé aux cas où la condition de sortie est dynamique.

```python
# ❌ (risque de boucle infinie)
i = 0
while i < 11:
    print(f"Joueur numéro {i} est sur le terrain.")
    i += 1

# ✅
for i in range(11):
    print(f"Joueur numéro {i} est sur le terrain.")
```

---

## 4. Éviter les `else` inutiles (early return)

Sortir tôt plutôt qu'imbriquer des branches.

```python
# ❌
def check_qualification(score):
    if score >= 10:
        print("Qualifié.")
    else:
        print("Non qualifié.")

# ✅
def check_qualification(score):
    if score < 10:
        print("Non qualifié.")
        return
    print("Qualifié.")
```

---

## 5. Fonctions pour réutiliser le code

Extraire toute opération répétée en fonction nommée.

```python
# ❌
athlete1_speed_kmh = (100 / 9.58) * 3.6
athlete2_speed_kmh = (100 / 9.80) * 3.6

# ✅
def calculate_speed_kmh(distance_meters, time_seconds):
    return (distance_meters / time_seconds) * 3.6

athlete1_speed_kmh = calculate_speed_kmh(100, 9.58)
athlete2_speed_kmh = calculate_speed_kmh(100, 9.80)
```

---

## 6. Commenter le pourquoi, pas le quoi

Écrire les commentaires avant de coder pour clarifier l'intention. Ne pas décrire ce que le code fait déjà lisiblement.

---

## 7. Diviser les problèmes en sous-problèmes

Chaque fonction = une responsabilité. Facilite les tests unitaires et la maintenance.

```python
# ❌ Fonction monolithique
def get_team_statistics(team):
    total_points = 0
    total_assists = 0
    for player in team:
        total_points += player['points']
        total_assists += player['assists']
    average_points = total_points / len(team)
    average_assists = total_assists / len(team)
    print(f"Points moyens : {average_points}")
    print(f"Passes décisives moyennes : {average_assists}")

# ✅ Sous-fonctions
def calculate_total(team, stat):
    return sum(player[stat] for player in team)

def calculate_average(total, count):
    return total / count if count else 0

def display_team_statistics(average_points, average_assists):
    print(f"Points moyens : {average_points}")
    print(f"Passes décisives moyennes : {average_assists}")

def get_team_statistics(team):
    total_points = calculate_total(team, 'points')
    total_assists = calculate_total(team, 'assists')
    average_points = calculate_average(total_points, len(team))
    average_assists = calculate_average(total_assists, len(team))
    display_team_statistics(average_points, average_assists)
```

---

## 8. Tester avec des cas variés

Définir les cas nominaux ET les cas limites (zéro, None, chaîne vide, valeurs négatives). Les bugs se cachent dans les cas particuliers.

---

## 9. Lisibilité > concision

Un code court n'est pas un objectif. Préférer la clarté aux one-liners obscurs.

```python
# ❌ Condensé, peu lisible
total_score = sum([p['points'] for p in players if p['trophies'] > 2])

# ✅ Clair
total_score = 0
for player in players:
    if player['trophies'] > 2:
        total_score += player['points']
```
