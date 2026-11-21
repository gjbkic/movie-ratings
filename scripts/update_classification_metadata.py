"""Fetch public classification metadata only; never edit a user's movie state."""
import json
from datetime import datetime, timezone
from pathlib import Path
from recheck_cast import collect, resolve, api, detail
from update_tmdb_metadata import normalized

ROOT = Path(__file__).resolve().parents[1]


def profile(f, kind, tmdb_id, details, parent=None):
    data = parent or details
    return {
        "schema": 2, "source": "tmdb", "checkedAt": datetime.now(timezone.utc).isoformat(),
        "kind": "movie" if kind == "movie" else "tv", "tmdbId": tmdb_id,
        "scope": "series" if kind in ("episode", "season") else kind,
        "filmTitles": list(dict.fromkeys(str(f[k]) for k in ("title", "originalTitle", "englishTitle", "lbTitle") if f.get(k))),
        "filmYear": f.get("year") or "",
        "companies": [{"id": c["id"], "name": c["name"], "country": c.get("origin_country", "")} for c in data.get("production_companies", []) if c.get("id") and c.get("name")],
        "productionCountries": [{"code": c["iso_3166_1"], "name": c.get("name", "")} for c in data.get("production_countries", []) if c.get("iso_3166_1")],
        "originalLanguage": data.get("original_language") or "",
        "spokenLanguages": [{"code": l["iso_639_1"], "name": l.get("english_name") or l.get("name", "")} for l in data.get("spoken_languages", []) if l.get("iso_639_1")],
        "genres": [{"id": g["id"], "name": g.get("name", "")} for g in data.get("genres", []) if g.get("id")],
        "formatHint": "animation" if any(g.get("id") == 16 for g in data.get("genres", [])) else "",
        "releaseDate": details.get("release_date") or details.get("air_date") or details.get("first_air_date") or "",
        "runtime": details.get("runtime"),
    }



def resolve_individual(f, safe):
    # Individually reviewed aliases; still verify the API title and first-air year.
    series = {
        "custom-1792420000000-007": (1418, "The Big Bang Theory", 2007),
        "custom-1792421000000-006": (88264, "Radiation House", 2019),
        "custom-1792421000000-013": (46260, "Naruto", 2002),
    }
    if f["id"] in series:
        tmdb_id, alias, year = series[f["id"]]
        kind, ident, data, season, episode = detail({**f, "englishTitle": alias}, safe, "tv", tmdb_id)
        if str(data.get("first_air_date", ""))[:4] != str(year):
            raise ValueError("個別照合したシリーズの初回年が不一致")
        return kind, ident, data, season, episode
    if f["id"] == "lb-459-1Vgm":
        # The old hard-coded movie/10840 no longer exists. Verify the short itself.
        hits = api("/search/movie", query="On Your Mark", year=1995, language="en-US").get("results", [])
        matches = []
        for hit in hits:
            if str(hit.get("release_date", ""))[:4] != "1995":
                continue
            data = api(f"/movie/{hit['id']}", language="en-US", append_to_response="credits")
            directors = [p.get("name") for p in data.get("credits", {}).get("crew", []) if p.get("job") == "Director"]
            if "Hayao Miyazaki" in directors and normalized(data.get("title", "")) == normalized("On Your Mark"):
                matches.append(("movie", hit["id"], data, None, None))
        if len(matches) == 1:
            return matches[0]
        raise ValueError("1995年・宮崎駿監督の短編を個別検索しましたが一意に特定不可")
    if f["id"] == "custom-1790322764349-xp48":
        # The theatrical listing is the fifth-season finale, not the full series.
        _, ident, parent, _, _ = detail({**f, "englishTitle": "Stranger Things"}, {}, "tv", 66732)
        season = api(f"/tv/{ident}/season/5", language="en-US")
        matches = [e for e in season.get("episodes", []) if e.get("episode_type") == "finale"]
        if len(matches) != 1:
            raise ValueError("第5シーズン最終話の個別照合が未確定")
        number = matches[0]["episode_number"]
        data = api(f"/tv/{ident}/season/5/episode/{number}", language="ja-JP")
        return "episode", ident, data, 5, number
    return resolve(f, safe)


def main():
    target = ROOT / "tmdb-metadata.json"
    catalog = json.loads(target.read_text(encoding="utf-8-sig"))
    rows = catalog.setdefault("films", {})
    films = collect()
    counts = {"total": len(films), "fetched": 0, "cached": 0, "unmatched": 0, "error": 0}
    problems = []
    for index, (film_id, f) in enumerate(films.items(), 1):
        old = rows.get(film_id) or {}
        cached = old.get("classification131") or {}
        if cached.get("schema") == 2 and str(cached.get("filmYear") or "") == str(f.get("year") or "") and f.get("title") in cached.get("filmTitles", []):
            counts["cached"] += 1
            continue
        try:
            # A previous candidate title must never validate its own possibly wrong ID.
            safe = {k: v for k, v in old.items() if k not in ("title", "titleAliases")}
            kind, tmdb_id, details, season, episode = resolve_individual(f, safe)
            parent = api(f"/tv/{tmdb_id}", language="en-US") if kind in ("episode", "season") else None
            item = profile(f, kind, tmdb_id, details, parent)
            rows[film_id] = {**old, "classification131": item}
            counts["fetched"] += 1
        except (ValueError, RuntimeError) as exc:
            key = "unmatched" if isinstance(exc, ValueError) else "error"
            counts[key] += 1
            problems.append({"id": film_id, "title": f.get("title"), "status": key, "reason": str(exc)})
            if "authentication" in str(exc).lower():
                print("TMDB authentication failed; no further requests attempted.", flush=True)
                break
        if index % 20 == 0 or index == len(films):
            print(f"Classified {index}/{len(films)}: {counts}", flush=True)
            target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {"at": datetime.now(timezone.utc).isoformat(), "counts": counts, "problems": problems}
    (ROOT / "classification-fetch-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(counts), flush=True)


if __name__ == "__main__":
    main()
