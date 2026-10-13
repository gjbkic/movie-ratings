"""Recheck every film's cast; write only public TMDB metadata and a diagnostic report."""
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from update_tmdb_metadata import get, normalized, distinct

ROOT = Path(__file__).resolve().parents[1]
responses = {}

def api(path, **params):
    key = (path, tuple(sorted(params.items())))
    if key not in responses:
        responses[key] = get(path, params)
    return responses[key]

def collect():
    core = (ROOT / "app-core.js").read_text(encoding="utf-8-sig")
    base = json.loads(re.search(r"const BASE_FILMS=(.*);\n", core).group(1))
    state = json.loads((ROOT / "live-state.json").read_text(encoding="utf-8-sig"))["state"]
    films = {f["id"]: dict(f) for f in base + state.get("customFilms", []) if f["id"] != "lb-386-wbAi"}
    for id, f in films.items():
        f.update({k:v for k,v in state.get("titleOverrides", {}).get(id, {}).items() if v not in (None, "")})
        f["meta"] = state.get("letterboxdMeta", {}).get(id, {})
        f["mediaType"] = state.get("mediaTypeOverrides", {}).get(id, f.get("mediaType", "movie"))
    return films

def names(f, row):
    return distinct([f.get(k) for k in ("englishTitle", "originalTitle", "title", "lbTitle")] + [row.get("title")] + row.get("titleAliases", []))

def compatible(f, row, d, kind):
    y = str(d.get("release_date") or d.get("first_air_date") or "")[:4]
    if kind == "movie" and y.isdigit() and f.get("year") and abs(int(f["year"])-int(y)) > 3:
        return False
    wanted = {normalized(s) for s in names(f, row)}
    alternative = d.get("alternative_titles") or {}
    actual = [d.get(k) for k in ("title", "original_title", "name", "original_name")]
    actual += [x.get("title") for x in alternative.get("titles", alternative.get("results", []))]
    return bool(wanted.intersection(normalized(n) for n in actual if n))

def detail(f, row, kind, id, trust=False):
    extra = "credits,alternative_titles" if kind == "movie" else "aggregate_credits,alternative_titles"
    data = api(f"/{kind}/{id}", language="ja-JP", append_to_response=extra)
    if not trust and not compatible(f, row, data, kind):
        en = api(f"/{kind}/{id}", language="en-US", append_to_response="alternative_titles")
        if not compatible(f, row, en, kind):
            raise ValueError(f"保存IDの作品名・公開年が一致しません ({kind}/{id})")
    return kind, int(id), data, None, None

def resolve(f, row):
    # This 1995 Studio Ghibli short shares its title with unrelated films.
    # Never trust a previously stored TMDB ID for this particular film.
    if f.get("id") == "lb-459-1Vgm":
        return detail(f, row, "movie", 10840, True)
    # The 2011 concert has a longer TMDB title than the Letterboxd import.
    if f.get("id") == "custom-1791664055006-96rv":
        return detail(f, row, "movie", 57044, True)
    m = f["meta"]
    if m.get("contentType") == "tv_episode" and m.get("tmdbSeriesId") and m.get("seasonNumber") is not None and m.get("episodeNumber") is not None:
        id, season, episode = m["tmdbSeriesId"], m["seasonNumber"], m["episodeNumber"]
        d = api(f"/tv/{id}/season/{season}/episode/{episode}", language="ja-JP", append_to_response="credits")
        return "episode", id, d, season, episode
    candidates = []
    if row.get("tmdbId") and row.get("type") in ("movie", "tv"):
        candidates.append((row["type"], row["tmdbId"], True))
    if m.get("tmdbSeriesId"):
        candidates.append(("tv", m["tmdbSeriesId"], False))
    explicit = f.get("tmdbId") or (m.get("poster84") or {}).get("tmdbId")
    if explicit:
        order = ("tv", "movie") if m.get("contentType") == "tv_series" else ("movie", "tv")
        candidates += [(kind, explicit, False) for kind in order]
    tried, issues = set(), []
    for kind, id, trust in candidates:
        if (kind,id) in tried:
            continue
        tried.add((kind,id))
        try:
            return detail(f,row,kind,id,trust)
        except ValueError as exc:
            issues.append(str(exc))
    titles = names(f,row)
    drama = f.get("mediaType") in ("tv", "drama", "tv_series", "tv_episode") or row.get("type") == "drama"
    queries = distinct(titles + [re.split(r"[:：]", t)[0] for t in titles])[:7]
    for kind in (("tv","movie") if drama else ("movie","tv")):
        for query in queries:
            result = api("/search/"+kind, query=query, language="ja-JP", include_adult="false")
            if kind == "tv":
                english = api("/search/tv", query=query, language="en-US", include_adult="false")
                result = {"results":result.get("results",[])+english.get("results",[])}
            for hit in result.get("results",[])[:8]:
                if hit.get("adult"):
                    continue
                id = hit["id"]
                if compatible(f,row,hit,kind) and (kind,id) not in tried:
                    tried.add((kind,id))
                    try:
                        return detail(f,row,kind,id)
                    except ValueError as exc:
                        issues.append(str(exc))
                if kind != "tv":
                    continue
                prefix = normalized(hit.get("name"))
                if len(prefix) < 5 or not any(normalized(t).startswith(prefix) and normalized(t) != prefix for t in titles):
                    continue
                series = api(f"/tv/{id}", language="ja-JP")
                series_en = api(f"/tv/{id}", language="en-US")
                suffixes = {normalized(re.split(r"[:：]", t, maxsplit=1)[1]) for t in titles if re.search(r"[:：]",t)}
                for t in titles:
                    for label in (hit.get("name"),series.get("name"),series_en.get("name"),series.get("original_name")):
                        head=normalized(label)
                        if head and normalized(t).startswith(head):
                            suffixes.add(normalized(t)[len(head):])
                season_names={s["season_number"]:normalized(s.get("name")) for s in series_en.get("seasons",[])}
                for season in series.get("seasons",[]):
                    n = season["season_number"]
                    if normalized(season.get("name")) in suffixes or season_names.get(n) in suffixes:
                        d = api(f"/tv/{id}/season/{n}", language="ja-JP", append_to_response="aggregate_credits")
                        return "season", id, d, n, None
                    if n != 0 and not any(len(x)>3 for x in suffixes):
                        continue
                    special = api(f"/tv/{id}/season/{n}", language="en-US")
                    matches = [ep for ep in special.get("episodes",[]) if compatible(f,row,{**ep,"first_air_date":ep.get("air_date")},"movie") or normalized(ep.get("name")) in suffixes]
                    finale = [re.search(r"\b(\d+)\s*:\s*(?:the\s+)?finale\b",t,re.I) for t in titles]
                    if not matches and any(x and int(x.group(1))==n for x in finale):
                        matches=[ep for ep in special.get("episodes",[]) if ep.get("episode_type")=="finale"]
                    if len(matches) == 1:
                        ep = matches[0]["episode_number"]
                        d = api(f"/tv/{id}/season/{n}/episode/{ep}", language="ja-JP", append_to_response="credits")
                        return "episode", id, d, n, ep
    raise ValueError((issues[0]+"。" if issues else "")+"保存ID・邦題・英題・原題・別名・映画/TV・該当シーズンを確認しましたが一意に特定不可")

def fetch_cast(f, row):
    kind, id, data, season, episode = resolve(f,row)
    raw = (data.get("aggregate_credits") or data.get("credits") or {}).get("cast", []) + data.get("guest_stars", [])
    if not raw:
        if kind == "episode":
            path = f"/tv/{id}/season/{season}/episode/{episode}/credits"
        elif kind == "season":
            path = f"/tv/{id}/season/{season}/aggregate_credits"
        else:
            path = f"/{kind}/{id}/" + ("aggregate_credits" if kind == "tv" else "credits")
        en = api(path, language="en-US")
        raw = en.get("cast", []) + en.get("guest_stars", [])
        if not raw and kind in ("tv", "season"):
            standard = f"/tv/{id}/credits" if kind == "tv" else f"/tv/{id}/season/{season}/credits"
            en = api(standard, language="en-US")
            raw = en.get("cast", [])
        if not raw and kind == "tv" and data.get("number_of_episodes") == 1:
            seasons = [s for s in data.get("seasons",[]) if s.get("episode_count") == 1]
            if len(seasons) == 1:
                n = seasons[0]["season_number"]
                ep = api(f"/tv/{id}/season/{n}", language="en-US").get("episodes",[])
                if len(ep) == 1:
                    en = api(f"/tv/{id}/season/{n}/episode/{ep[0]['episode_number']}/credits", language="en-US")
                    raw = en.get("cast", []) + en.get("guest_stars", [])
    cast, seen = [], set()
    for p in sorted(raw, key=lambda p:p.get("order") or 0):
        name = str(p.get("name") or p.get("original_name") or "").strip()
        key = p.get("id") or name
        if not name or key in seen:
            continue
        seen.add(key)
        role = p.get("character") or "／".join(x.get("character", "") for x in p.get("roles",[]))
        cast.append({"id":p.get("id"),"name":name,"originalName":p.get("original_name", ""),"role":role})
        if len(cast) >= 15:
            break
    extra = {"cast":cast,"castCheckedAt":datetime.now(timezone.utc).isoformat(),"castResolverVersion":2,"tmdbId":id,"type":"movie" if kind=="movie" else "tv"}
    if f.get("id") == "lb-459-1Vgm":
        # The official TMDB poster for the verified short replaces the incorrect cover.
        extra["posterPath"] = data.get("poster_path") or ""
        extra["source"] = "tmdb"
    if kind in ("episode", "season"):
        extra.update(contentType="tv_"+kind, seasonNumber=season, episodeNumber=episode)
    return extra

def main():
    films = collect()
    target = ROOT/"tmdb-metadata.json"
    old = json.loads(target.read_text(encoding="utf-8-sig"))
    rows = old.get("films", {})
    counts = dict(total=len(films), success=0, empty=0, unmatched=0, api=0)
    results, auth = [], ""
    for i, (id, f) in enumerate(films.items(), 1):
        row = rows.get(id) or {}
        m = f["meta"]
        scoped = m.get("contentType") != "tv_episode" or (row.get("contentType")=="tv_episode" and row.get("seasonNumber")==m.get("seasonNumber") and row.get("episodeNumber")==m.get("episodeNumber"))
        status, reason = "success", ""
        try:
            if not row.get("cast") or not scoped:
                if auth:
                    raise RuntimeError(auth)
                fetched = fetch_cast(f,row)
                # Retain all existing metadata, especially manually verified staff and aliases.
                rows[id] = row = {**row, **fetched}
            if not row.get("cast"):
                status, reason = "empty", "日本語・英語クレジットを再取得しましたが出演者情報なし"
        except ValueError as exc:
            status, reason = "unmatched", str(exc)
        except RuntimeError as exc:
            status, reason = "api", str(exc)
            if "authentication" in reason.lower():
                auth = "認証エラーのため未試行。キーを修正して再実行してください"
        counts[status] += 1
        results.append(dict(id=id,title=f.get("title", ""),status=status,reason=reason,tmdbId=row.get("tmdbId"),castCount=len(row.get("cast") or [])))
        if i%20==0 or i==len(films):
            print(f"Checked {i}/{len(films)}: {counts}",flush=True)
    now = datetime.now(timezone.utc).isoformat()
    old.update(updatedAt=now, films=rows)
    target.write_text(json.dumps(old,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    report = dict(at=now,counts=counts,results=results)
    (ROOT/"cast-fetch-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(counts,ensure_ascii=False),flush=True)
    for item in results:
        if item["status"] != "success":
            print(item["title"]+" — "+item["reason"],flush=True)

if __name__ == "__main__":
    main()
