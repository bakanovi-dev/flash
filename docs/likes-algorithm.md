# Алгоритм лайков и персонализации

## Поведение кнопки лайка

- Только лайк (без дизлайка, без счётчиков)
- Повторное нажатие снимает лайк
- Дизлайк и скип обрабатываются отдельно через `/api/v1/events` (без UI)

---

## Коллекции MongoDB

### `likes`
```json
{
  "user_id": "1",
  "card_id": ObjectId,
  "created_at": datetime
}
```
Уникальный индекс: `(user_id, card_id)`.

### `user_profiles`
```json
{
  "user_id": "1",
  "cefr_target": "B2",
  "like_count": 11,
  "interest_weights": {
    "domain:arts.series": 1.2,
    "domain:entertainment.humor": 0.8,
    "emotion:sarcasm": 0.7,
    "register:colloquial": 0.5,
    "cefr:B2": 1.1,
    "length:medium": 0.4
  },
  "updated_at": datetime
}
```

---

## Ключи весов (Weight Keys)

Каждая карточка вносит вклад по всем осям тегов:

| Ось | Пример ключа |
|-----|-------------|
| Домен | `domain:arts.series` |
| Эмоция | `emotion:sarcasm` |
| Регистр | `register:colloquial` |
| CEFR уровень | `cefr:B2` |
| Длина фразы | `length:short` / `length:medium` / `length:long` |

**Длина:** short ≤10 слов, medium 11–20, long >20.

Поле `quote_length` (число слов) хранится в документе reel.

---

## Дельты весов

| Событие | Дельта |
|---------|--------|
| like    | +0.1   |
| dislike | −0.1   |
| skip    | −0.05  |
| flip    | 0.0    |

---

## Два режима ленты

### До 10 лайков — CEFR-прокcимити

Приоритет отдаётся карточкам близкого уровня к `cefr_target` пользователя:

```
score = max(0.0, 1.0 - abs(card_level_idx - target_idx) * 0.35)
```

Индексы: A1=0, A2=1, B1=2, B2=3, C1=4, C2=5.

Пример при target=B2 (idx=3):
- B2 → 1.0
- B1 / C1 → 0.65
- A2 / C2 → 0.30
- A1 → 0.0

### После 10 лайков — взвешенный скоринг

```python
score = sum(interest_weights.get(key, 0.0) for key in weight_keys(card))
```

Алгоритм:
1. Взять `limit * 3` кандидатов из MongoDB по курсору (cursor-based pagination через `rand`)
2. Скорить каждую карточку в Python по сумме весов
3. Вернуть топ `limit` по убыванию score
4. Курсор продвигается до `rand` последней карточки в полном наборе (не в топ-limit)

---

## Эндпоинт лайка

```
POST /api/v1/likes/{card_id}?user_id=1
```

**Ответ:** `{"liked": true}` или `{"liked": false}` (если снят)

**Логика:**
- Если лайк уже есть → удалить из `likes`, вычесть дельту из весов, `like_count -= 1`
- Если лайка нет → добавить в `likes`, прибавить дельту к весам, `like_count += 1`
- Обновить `updated_at` в `user_profiles`

Лайк **не дублируется** через `/api/v1/events`. События dislike/skip обновляют веса через `/api/v1/events`.

---

## Пример скоринга

**interest_weights пользователя** (после 10 лайков, онбординг B2, arts.series):
```
domain:arts.series     → 1.2
domain:business.corp   → 0.5
emotion:sarcasm        → 0.7
register:colloquial    → 0.6
cefr:B2                → 1.1
length:medium          → 0.4
```

**Карточка A** (arts.series + sarcasm + colloquial + B2 + medium):
```
score = 1.2 + 0.7 + 0.6 + 1.1 + 0.4 = 4.0
```

**Карточка B** (science.physics + neutral + formal + B2 + long):
```
score = 0.0 + 0.0 + 0.0 + 1.1 + 0.0 = 1.1
```

Карточка A вытесняет B в топ.

---

## Что нужно добавить в схему reel

Поле `quote_length: int` — число слов в `quote_en`. Заполняется пайплайном при сохранении:
```python
"quote_length": len(quote_en.split())
```

Для существующих 934 карточек нужен backfill-скрипт.
