# Recommendation Engine — Math Spec & Starting Weights

> Companion to PLAN.md (§6–§9). This is the concrete, implementable specification:
> every formula, every default constant, and the tuning method. All constants are
> **starting points** to be tuned against the north-star funnel, and are versioned
> by `model_version`.

---

## 1. Notation

| Symbol | Meaning |
|---|---|
| `u` | the user (a Letterboxd profile) |
| `f` | a film in the corpus |
| `r_{u,f}` | user u's rating of f, on a 0–10 scale (Letterboxd ½–5 stars × 2) |
| `R_u` | set of films u has rated |
| `μ_u, σ_u` | mean and std of u's ratings |
| `z_{u,f}` | user-normalized rating of f (see §2) |
| `liked_{u,f}` | 1 if u hearted f, else 0 |
| `R_f, v_f` | film f's TMDB vote_average and vote_count |
| `C, m` | global mean rating and vote-count prior (see §3) |
| `Q_f` | film f's quality = weighted Bayesian rating, mapped to 0–1 |

**Convention:** every *component* score fed to the ranker is squashed to `[0,1]`;
every *affinity* (genre/director/era/...) is a signed value in `[-1,1]` that gets
mapped to `[0,1]` only at ranking time via `(x+1)/2`. Keep affinities signed
internally so "you dislike horror" is representable and explainable.

---

## 2. Per-user normalization

```
μ_u = mean(r_{u,f} for f in R_u)
σ_u = std(r_{u,f} for f in R_u)             # population std
z_{u,f} = (r_{u,f} − μ_u) / max(σ_u, σ_min)
```

- `σ_min = 1.0` (on the 0–10 scale) guards against users who rate everything the
  same (σ→0 would explode z).
- If `|R_u| < 5`, skip normalization (z = 0 for all) and fall back to a
  popularity-/quality-led cold-start ranking (§11).

The same normalization is applied to TMDB audience ratings so user-vs-audience
deltas are comparable: `z^{tmdb}_f = (R_f − C) / σ_tmdb`, with `σ_tmdb` the std of
`R_f` across the corpus.

---

## 3. Quality — weighted Bayesian rating

Raw `vote_average` is unreliable at low `vote_count`. Use the IMDb-style estimate:

```
WR_f = (v_f / (v_f + m)) · R_f  +  (m / (v_f + m)) · C
```

- `C` = mean `vote_average` across the corpus (recompute per corpus refresh; ~6.3).
- `m` = vote-count prior. **Start `m = 250`.** Higher `m` = more conservative
  (pulls obscure films toward the mean). Hidden Gems use a lower effective floor
  via a vote_count gate (§8), not by changing `m`.

Map to `[0,1]` for the ranker:
```
Q_f = clip((WR_f − WR_min) / (WR_max − WR_min), 0, 1)
```
with `WR_min, WR_max` = 5th/95th percentile of `WR` across the corpus (robust to
outliers), recomputed per refresh.

---

## 4. Bayesian shrinkage (used everywhere small samples appear)

Generic shrink-toward-zero estimator for any group `g` (genre, director, country…):

```
shrink(mean_z_g, n_g, k) = (n_g / (n_g + k)) · mean_z_g
```

- `n_g` = number of u's rated films in group g.
- `k` = shrinkage strength (the "how many films before I trust this group"). Per
  group type:

| Group | `k` | Rationale |
|---|---|---|
| Genre | 15 | Genres are broad; 10 war films should barely move. Kills prestige bias. |
| Director | 4 | Directors have small filmographies; trust faster but still guard 1-offs. |
| Country | 12 | Similar to genre. |
| Decade/era | 12 | — |
| Keyword | 8 | Sparser than genres. |

---

## 5. Genre affinity (the multi-factor model)

For each genre g in u's library, compute four signals, each centered so 0 = neutral.

### 5.1 Relative rating (shrunk)
```
A1_g = shrink(mean(z_{u,f} for f in g), n_g, k=15)
```
Captures "I rate films in this genre above/below my own average."

### 5.2 User-vs-audience delta
```
A2_g = shrink( mean(z_{u,f} − z^{tmdb}_f for f in g), n_g, 15 )
```
Separates "I genuinely love this genre" (positive) from "I only watch its
acclaimed canon" (≈0: you and the crowd agree because you cherry-picked).

### 5.3 Over/under-watching (engagement)
```
share_u(g)   = n_g / |R_u|
base(g)      = corpus films in g / corpus size
A3_g         = tanh( ln( (share_u(g)+ε) / (base(g)+ε) ) / s3 )
```
Log-ratio of how disproportionately u watches g, squashed to [-1,1]. `s3 = 1.5`
(scale), `ε = 1e-6`. This is the **comedy-paradox** term: someone who watches 40%
comedies gets a large positive A3 even if A1 is slightly negative.

### 5.4 Like rate
```
likerate_u(g) = mean(liked_{u,f} for f in g)
likerate_u    = mean(liked_{u,f} for f in R_u)
A4_g          = tanh( (likerate_u(g) − likerate_u) / s4 )      # s4 = 0.15
```

### 5.5 Blend
```
GenreAffinity_g = clip( β1·A1_g + β2·A2_g + β3·A3_g + β4·A4_g , -1, 1 )
```
Starting blend weights (sum need not = 1; clip handles range):

| | β1 (rel-rating) | β2 (vs-audience) | β3 (engagement) | β4 (likes) |
|---|---|---|---|---|
| value | 0.40 | 0.25 | 0.25 | 0.10 |

Store all four `A*_g` components alongside the blend for the profile UI and the
"Why this?" explanation.

---

## 6. Director affinity

```
DirectorAffinity_d = shrink( mean(z_{u,f} for f in d), n_d, k=4 )
```
Optionally add a small like-rate term mirroring §5.4 with weight 0.15. A film by
multiple credited directors takes the max affinity. Same pattern reused for actors
(used only in manual rabbit-hole search, not default ranking).

---

## 7. Era, country, runtime fit

These are **film-level fit scores** derived from u's bucket affinities.

### 7.1 Bucket affinity (era = decade, country)
```
BucketAffinity_b = shrink( mean(z_{u,f} for f in b), n_b, k=12 )
```

### 7.2 Film fit
- `eraFit_f`     = map BucketAffinity_{decade(f)} from [-1,1] → [0,1].
- `countryFit_f` = max over f's countries of map(BucketAffinity_country) → [0,1].
  (Co-productions: take the best-matching country.)

### 7.3 Runtime fit
Fit a Gaussian to u's rating-weighted runtime preference:
```
runtime_pref = Σ_f w_f·runtime_f / Σ_f w_f ,  w_f = max(z_{u,f}, 0)+0.1
runtime_sd   = weighted std (floor at 20 min)
runtimeFit_f = exp( −0.5 · ((runtime_f − runtime_pref)/runtime_sd)^2 )   # in [0,1]
```

### 7.4 Gap signal (for Explorer surface, not ranking)
```
gap(b) = base_corpus_share(b) − share_u(b)      # large positive = under-explored
```
Surface the top-gap decades/countries as "fill the gap" prompts.

---

## 8. Keyword overlap & content vector

### 8.1 Keyword IDF (corpus-level, precomputed)
```
idf(w) = ln( (N_corpus + 1) / (df(w) + 1) ) + 1
```
`df(w)` = #films tagged w. Stoplist (idf-driven + curated): drop keywords with
`df(w)/N_corpus > 0.25` (ubiquitous) and a manual list (post-credits scene, sequel,
bare city names, "based on novel", aspect-ratio tags, etc.). Mark `is_stoplisted`.

### 8.2 User keyword profile
```
KW_u(w) = Σ_{f in R_u} max(z_{u,f},0) · 1[w in f] · idf(w)
```
L2-normalize over w → unit vector `kw_u`. Top entries (post-stoplist) = the
displayed "themes."

### 8.3 Per-film keyword overlap
```
keywordOverlap_f = cosine( kw_u , kw_f )    # kw_f = idf-weighted, L2-normalized
```
Already in [0,1] (non-negative vectors).

### 8.4 Content feature vector (for ANN candidate retrieval only)
Concatenate, then L2-normalize, storing in pgvector:
- genres: multi-hot × 1.0
- keywords: idf-weighted, dimensionality-reduced (hashing to 512 dims or top-K
  global keywords) × 0.8
- top-D director one-hots (D≈2000 most-frequent corpus directors) × 1.0
- decade one-hot × 0.4
- country multi-hot × 0.5
- language one-hot × 0.3
- runtime bucket one-hot (10 buckets) × 0.3

User taste vector = z-weighted, like-boosted centroid of `R_u` film vectors:
```
taste_u = normalize( Σ_f (max(z_{u,f},0) + 0.5·liked_{u,f}) · vec_f )
```
This vector is **retrieval only** (find ~500 nearest candidates fast). Final
ranking uses the explainable components below, not this cosine.

---

## 9. Collaborative component (Phase 3)

1. Train ALS/SVD on MovieLens 25M → item factor matrix `P ∈ R^{n_items × d}`,
   `d = 64`. Persist factors keyed by tmdb_id (via links.csv) + per-item bias.
2. **Fold-in** the user via ridge regression on items they've rated that map to
   MovieLens:
```
let X = item factors of u's matched films (n_matched × d)
let y = (r_{u,f} − global_mean) for those films
p_u = (XᵀX + λI)^{-1} Xᵀ y          # λ = 10.0
```
3. Score any corpus film with factors: `cf_raw_f = p_u · P_f + bias_f`.
4. Map to [0,1] via min-max over the candidate set: `collaborative_f`.
5. **Gating:** if `n_matched < 20`, set `w_cf = 0` for this user (not enough signal
   to fold in reliably) and flag CF unavailable in the UI.

---

## 10. Final ranking

For each candidate f (after hard filters: watched / not-interested / adult / low
match-confidence / optionally watchlist removed):

```
RankScore_f =
    w_q  · Q_f
  + w_g  · map(GenreAffinity_genres(f))      # max or mean over f's genres → [0,1]
  + w_d  · map(DirectorAffinity_director(f))
  + w_k  · keywordOverlap_f
  + w_e  · eraFit_f
  + w_c  · countryFit_f
  + w_r  · runtimeFit_f
  + w_cf · collaborative_f
  − penalties_f
```
where `map(x) = (x+1)/2` for signed affinities.

`GenreAffinity_genres(f)`: use **mean** of the film's genre affinities, but if any
genre affinity < −0.5, apply a strong damp (a celebrated horror film still sinks
for a horror-averse user) — multiply the whole RankScore by `(1 − 0.5·|min_neg|)`.

### Penalties
```
penalties_f = pop_penalty_f + franchise_penalty_f
pop_penalty_f      = (surface-specific, see §11)
franchise_penalty_f= 0.05 per same-collection film already higher in the list
```

### Starting weights (the "balanced" preset)

| w_q | w_g | w_d | w_k | w_e | w_c | w_r | w_cf |
|---|---|---|---|---|---|---|---|
| 0.25 | 0.20 | 0.15 | 0.15 | 0.07 | 0.07 | 0.03 | 0.08 |

(Pre-CF, redistribute `w_cf` into `w_q`+`w_g` when CF is gated off.)

---

## 11. Surface presets (weight overrides + pool + penalty)

All values are deltas/overrides on the balanced preset.

| Surface | Candidate pool gate | Key weight changes | Pop penalty |
|---|---|---|---|
| **Blind Spots** | `WR_f` ≥ p70 AND `v_f` ≥ 1000 | w_q→0.35 | 0 (popularity fine) |
| **Hidden Gems** | `WR_f` ≥ p75 AND `v_f` ∈ [300, 5000] AND popularity ≤ p40 | w_q→0.20, w_k→0.20 | `+0.15·popularity_pct_f` (punish popular) |
| **Director Rabbit Hole** | films by chosen/top directors only | w_d→0.45, w_q→0.20 | 0 |
| **Mood** | base pool ∩ mood predicate (§12) | unchanged | inherits base |
| **Collaborative** | top-N by `cf_raw_f` (n_matched ≥ 20) | w_cf→0.35, w_g→0.15 | 0 |
| **Explorer / fill-gap** | films ∈ chosen decade/country bucket | unchanged | 0 |

**Cold start** (`|R_u| < 20`): force a quality-led preset
`w_q=0.6, w_g=0.25, w_k=0.15`, everything else 0; skip normalization.

---

## 12. Mood predicates

Each mood = a boolean predicate over genres + keywords (tunable). Examples:

| Mood | Predicate (genres / keywords) |
|---|---|
| Dark & intense | genre ∈ {Thriller, Crime, Drama, Horror} AND kw ∩ {violence, bleak, psychological, trauma} |
| Light & fun | genre ∈ {Comedy, Family, Adventure} AND NOT kw ∩ {grief, death, war} |
| Slow burn | kw ∩ {slow cinema, meditative, minimalism, long take} OR runtime ≥ 130 with low action |
| Action-packed | genre ∈ {Action, Adventure} AND kw ∩ {chase, fight, heist} |
| Heartwarming | kw ∩ {friendship, family, hope, redemption} AND vote_average ≥ 6.5 |
| Disturbing | kw ∩ {body horror, disturbing, nihilism, taboo} |
| Romantic | genre ∋ Romance |
| Documentary | genre ∋ Documentary |

Mood narrows the **candidate pool**; ranking weights are unchanged so the mood
list is still taste-personalized.

---

## 13. Diversity re-rank (MMR)

After scoring, build the final ordered list greedily:
```
chosen = []
while len(chosen) < N:
    pick f maximizing:
        λ · RankScore_f  −  (1−λ) · max_{g in chosen} sim(f, g)
    append f to chosen
```
- `sim(f,g)` = cosine of content feature vectors (§8.4).
- `λ = 0.7` default (0.6 for Hidden Gems to push novelty harder; 0.85 for Director
  Rabbit Hole where same-director is the point).
- Soft cap: ≤ 3 films per director and ≤ 4 per decade in a list of 24 (enforced as
  a hard constraint on top of MMR).

---

## 14. Explainability payload

Stored per rec; the card renders the top 2–3 by contribution:
```
contribution_i = w_i · component_i     # the actual addend in RankScore
```
Sort contributions desc, render the top ones as human strings:
- genre   → "Matches your love of {genre} (you rate it {+x} above your average)"
- director→ "By {director}, whom you consistently rate highly"
- keyword → "Themes you gravitate toward: {top overlapping keywords}"
- era     → "1970s cinema — a decade you've under-explored" (if also a gap)
- country → "{country} film — you've rated these highly"
- cf      → "Loved by viewers with taste similar to yours"
- quality → "Critically acclaimed (weighted rating {WR})"

Always show `source` (content / collaborative / blind-spot / gem) as a small tag.

---

## 15. Tuning methodology

1. **Offline sanity:** golden-profile tests — a fixed sample profile must produce a
   stable top-N within tolerance; weight changes diff against the golden output.
2. **Leave-one-out validation:** hide a user's highly-rated films, check the engine
   ranks them high among candidates (recall@K, NDCG@K). Run per surface where
   meaningful (esp. content ranking).
3. **Online (the real metric):** the north-star funnel from PLAN §12
   (recommend → watchlist-add → watched → loved), segmented by surface. Use this to
   move weights — e.g. if Hidden Gems converts best, surface it more prominently.
4. **Guardrail:** track diversity (intra-list distance) and coverage (% of corpus
   ever recommended) so tuning for conversion doesn't collapse into recommending
   the same 50 popular films.
5. All weight sets shipped under a `model_version`; A/B between versions once there
   is traffic.

---

## 16. Constant summary (all tunable, versioned)

| Constant | Value | Where |
|---|---|---|
| σ_min | 1.0 | §2 normalization |
| m (vote prior) | 250 | §3 quality |
| C | corpus mean (~6.3) | §3 |
| k_genre / k_director / k_country / k_decade / k_keyword | 15 / 4 / 12 / 12 / 8 | §4 |
| β1..β4 (genre blend) | 0.40 / 0.25 / 0.25 / 0.10 | §5.5 |
| s3, s4 (engagement, like scales) | 1.5 / 0.15 | §5 |
| CF latent dim d / ridge λ / fold-in min items | 64 / 10.0 / 20 | §9 |
| Balanced weights w_* | see §10 table | §10 |
| MMR λ | 0.7 (0.6 gems / 0.85 director) | §13 |
| Per-list caps | ≤3/director, ≤4/decade per 24 | §13 |
