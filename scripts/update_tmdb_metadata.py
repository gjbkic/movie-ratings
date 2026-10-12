#!/usr/bin/env python3
"""Update public TMDb film metadata; no user scores, reviews or access tokens are exported."""
import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/"tmdb-metadata.json"
KEY=os.getenv("TMDB_API_KEY","").strip()
TOKEN=os.getenv("TMDB_READ_ACCESS_TOKEN","").strip()
if not (KEY or TOKEN):
    sys.exit("ERROR: configure TMDB_API_KEY (or TMDB_READ_ACCESS_TOKEN) in GitHub Actions secrets.")
HEADERS={"Accept":"application/json","User-Agent":"movie-ratings-tmdb-metadata/1.0"}
if TOKEN:
    HEADERS["Authorization"]="Bearer "+TOKEN
API="https://api.themoviedb.org/3"
last_call=0.0
rate_blocked_until=0.0

def get(path, params=None):
    global last_call, rate_blocked_until
    if rate_blocked_until>time.time():
        raise RuntimeError("TMDb rate limit HTTP 429: Retry-After待機中のため未試行")
    query=dict(params or {})
    if KEY and not TOKEN:
        query["api_key"]=KEY
    url=API+path+"?"+urlencode(query)
    for attempt in range(5):
        delay=max(0,.25-(time.monotonic()-last_call))
        if delay: time.sleep(delay)
        last_call=time.monotonic()
        try:
            with urlopen(Request(url,headers=HEADERS),timeout=25) as response:
                return json.load(response)
        except HTTPError as exc:
            if exc.code in (401,403):
                raise RuntimeError("TMDb authentication failed: HTTP "+str(exc.code)) from None
            if exc.code in (404,422):
                raise ValueError("TMDb title/ID not found: HTTP "+str(exc.code)) from None
            if exc.code==429 or 500<=exc.code<600:
                pause=min(30,(2**attempt)*2)
                if exc.code==429:
                    retry=exc.headers.get("Retry-After","")
                    if retry:
                        try:
                            wait=float(retry) if retry.isdigit() else parsedate_to_datetime(retry).timestamp()-time.time()
                            if wait>300:
                                rate_blocked_until=time.time()+wait
                                raise RuntimeError("TMDb rate limit HTTP 429: Retry-Afterが5分を超えるため再実行待ち")
                            pause=max(pause,wait)
                        except (TypeError,ValueError,OverflowError):
                            pass
                time.sleep(pause)
                continue
            raise RuntimeError("TMDb HTTP "+str(exc.code)+" on "+path) from None
        except (TimeoutError,URLError):
            time.sleep(2**attempt)
    raise RuntimeError("TMDb network or rate-limit retry exhausted on "+path)

def normalized(text):
    text=unicodedata.normalize("NFKC",str(text or "")).casefold()
    return "".join(c for c in text if c.isalnum())

def distinct(items):
    seen=set();result=[]
    for item in items:
        s=str(item or "").strip()
        if s and normalized(s) not in seen:
            seen.add(normalized(s));result.append(s)
    return result

def read_json(path,default):
    try: return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError,ValueError): return default

def collect():
    html=(ROOT/"app-core.js").read_text(encoding="utf-8")
    start="const BASE_FILMS="
    st=html.find(start)
    if st<0:raise RuntimeError("BASE_FILMS not found")
    st+=len(start)
    end=html.find(";\nconst DEFAULT_MAP=",st)
    if end<0:raise RuntimeError("BASE_FILMS terminator not found")
    base=json.loads(html[st:end])
    movies={str(f["id"]):dict(f) for f in base if f.get("id")}
    live=read_json(ROOT/"live-state.json",{})
    state=live.get("state") or {}
    for f in state.get("customFilms") or []:
        if isinstance(f,dict) and f.get("id"):movies[str(f["id"])]=dict(f)
    # The live ranked list supplies later title edits and dynamically added movies.
    for f in (live.get("ranked") or [])+(live.get("unrated") or []):
        if not isinstance(f,dict) or not f.get("id"):continue
        id=str(f["id"]); old=movies.setdefault(id,{"id":id})
        for field in ("title","originalTitle","englishTitle","year","mediaType","tmdbId"):
            if f.get(field) not in (None,""):old[field]=f[field]
    for id,changes in (state.get("titleOverrides") or {}).items():
        if id in movies and isinstance(changes,dict):
            for field in ("title","englishTitle","originalTitle","tmdbId"):
                if changes.get(field) not in (None,""):movies[id][field]=changes[field]
    for id,kind in (state.get("mediaTypeOverrides") or {}).items():
        if id in movies and kind:movies[id]["mediaType"]=kind
    return movies

def search_id(f, ignore_explicit=False):
    year=int(f.get("year") or 0)
    titles=distinct([f.get("englishTitle"),f.get("lbTitle"),f.get("originalTitle"),f.get("title")])
    kind=str(f.get("mediaType") or "").lower()
    tv=kind in ("tv_series","tv_episode","drama","tv")
    # TMDb's official titles are longer than the original Letterboxd entries.
    # These film IDs have been cross-checked with the TMDb movie pages.
    known_movie_ids={
        ("glassonion",2022):661374,
        ("missionimpossibledeadreckoning",2023):575264,
        ("onyourmark",1995):10840,
    }
    if not tv:
        for alias in titles:
            fixed=known_movie_ids.get((normalized(alias),year))
            if fixed:
                return "movie",fixed
    if year==2018 and "wildlife" in {normalized(v) for v in titles} and not tv:
        return "movie",417812
    explicit=f.get("tmdbId")
    if not ignore_explicit and explicit and str(explicit).isdigit():
        return ("tv" if tv else "movie"),int(explicit)
    all_keys={normalized(v) for v in titles}
    if tv:
        names=distinct([t.split(":")[0].split("：")[0].strip() for t in titles])
        all_keys|={normalized(v) for v in names}
    else:names=titles
    candidates=[]
    for name in names[:5]:
        if len(name)<2:continue
        params={"query":name,"language":"en-US","include_adult":"false"}
        if year and not tv:
            params["year"]=year
        for with_year in (True,False) if year and not tv else (True,):
            if not with_year:params.pop("year",None)
            res=get("/search/"+("tv" if tv else "movie"),params)
            for item in res.get("results",[])[:20]:
                key_list=distinct([item.get("name"),item.get("original_name")]) if tv else distinct([item.get("title"),item.get("original_title")])
                if not any(normalized(k) in all_keys for k in key_list):continue
                y=int(str(item.get("first_air_date" if tv else "release_date") or "")[:4] or 0)
                diff=abs(year-y) if year and y else 0
                if year and y and diff>3 and not tv:continue
                score=100-(diff*18 if not tv else min(diff,5)*2)+min(float(item.get("popularity") or 0),100)/100
                candidates.append((score,item["id"]))
            if candidates:break
        if candidates:break
    if not candidates:raise ValueError("No exact matching TMDb title/year")
    candidates.sort(reverse=True)
    return ("tv" if tv else "movie"),int(candidates[0][1])

def compatible(f, details, kind):
    """Reject saved TMDb IDs when the retrieved film is unrelated."""
    aliases=distinct([f.get("englishTitle"),f.get("lbTitle"),f.get("originalTitle"),f.get("title")])
    if kind=="tv":
        aliases=distinct(aliases+[n.split(":")[0].split("：")[0].strip() for n in aliases])
        actual=distinct([details.get("name"),details.get("original_name")])
    else:
        actual=distinct([details.get("title"),details.get("original_title")])
        year=int(f.get("year") or 0)
        released=str(details.get("release_date") or "")[:4]
        if year and released.isdigit() and abs(year-int(released))>3:
            return False
    known={normalized(x) for x in aliases}
    if kind=="movie":
        verified={("glassonion",2022):661374,
                  ("missionimpossibledeadreckoning",2023):575264,
                  ("onyourmark",1995):10840}
        actual_id=int(details.get("id") or 0)
        film_year=int(f.get("year") or 0)
        if any(verified.get((normalized(a),film_year))==actual_id for a in aliases):
            return True
    for name in actual:
        key=normalized(name)
        if key in known:
            return True
        if kind=="tv" and any(len(n)>8 and (n.startswith(key) or key.startswith(n)) for n in known):
            return True
    return False

def enrich(f,existing):
    if existing.get("source")=="corrected-credits-recheck-required" and existing.get("tmdbId"):
        typ=existing.get("type") or "movie"
        id=int(existing["tmdbId"])
    else:
        typ,id=search_id(f)
    def details(kind,tmdb_id):
        uri=("/movie/" if kind=="movie" else "/tv/")+str(tmdb_id)
        extra="credits" if kind=="movie" else "aggregate_credits"
        return get(uri,{"append_to_response":extra,"language":"en-US"})
    x=details(typ,id)
    if not compatible(f,x,typ):
        typ,id=search_id(f,ignore_explicit=True)
        x=details(typ,id)
        if not compatible(f,x,typ):
            raise ValueError("TMDb result title or year differs from the requested film")
    if typ=="movie":
        crew=(x.get("credits") or {}).get("crew") or []
        directors=distinct(c.get("name") for c in crew if c.get("job")=="Director")
        creators=[]
    else:
        aggregates=(x.get("aggregate_credits") or {}).get("crew") or []
        directors=distinct(c.get("name") for c in aggregates
                           if any(j.get("job")=="Director" for j in c.get("jobs") or []))
        creators=distinct(c.get("name") for c in x.get("created_by") or [])
    if not (directors or creators or x.get("poster_path")):
        raise ValueError("No credits or poster on TMDb")
    return {"tmdbId":id,"type":typ,"title":x.get("title") or x.get("name") or "",
            "year":str(f.get("year") or ""),"directors":directors,"creators":creators,
            "posterPath":x.get("poster_path") or "","source":"tmdb"}


JP_CHARACTERS=re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")

def supplement_japanese_director_aliases(records,films):
    """Resolve exact TMDb person IDs, then collect real Japanese-script person aliases.

    Only titles whose TMDb original language is Japanese are queried for person
    aliases. IDs are checked against stored credits; no name is guessed from
    romaji pronunciation (which can give the wrong kanji).
    """
    today=datetime.now(timezone.utc).isoformat()
    person_cache={}
    production_cache={}
    scanned=0
    added=0
    for film_id,record in records.items():
        if film_id not in films or record.get("aliasesCheckedAt"):
            continue
        film=films[film_id]
        tmdb_id=record.get("tmdbId")
        typ=record.get("type") or "movie"
        credited=distinct((record.get("directors") or [])+(record.get("creators") or []))
        if typ not in ("movie","tv") or not str(tmdb_id).isdigit() or not credited:
            continue
        key=(typ,int(tmdb_id))
        try:
            if key not in production_cache:
                ext="credits" if typ=="movie" else "aggregate_credits"
                url=("/movie/" if typ=="movie" else "/tv/")+str(tmdb_id)
                production_cache[key]=get(url,{"append_to_response":ext,"language":"en-US"})
            data=production_cache[key]
            if not compatible(film,data,typ):
                # A legacy mismatch may be corrected in a later TMDb refresh.
                continue
            if data.get("original_language")!="ja":
                record["aliasesCheckedAt"]=today
                continue
            if typ=="movie":
                people=[p for p in (data.get("credits") or {}).get("crew") or []
                        if p.get("job")=="Director"]
            else:
                people=[p for p in (data.get("aggregate_credits") or {}).get("crew") or []
                        if any(job.get("job")=="Director" for job in p.get("jobs") or [])]
                people+=data.get("created_by") or []
            wanted={normalized(n) for n in credited}
            person_ids={int(p["id"]) for p in people if p.get("id") and
                        normalized(p.get("name")) in wanted}
            aliases=[]
            for person_id in sorted(person_ids):
                if person_id not in person_cache:
                    p=get("/person/"+str(person_id),{"language":"ja-JP"})
                    native=distinct([p.get("name")]+(p.get("also_known_as") or []))
                    person_cache[person_id]=[n for n in native
                           if JP_CHARACTERS.search(n) and 2<=len(n)<=55][:8]
                aliases.extend(person_cache[person_id])
            old_aliases=record.get("directorAliases") or []
            merged=distinct(old_aliases+aliases)
            if merged!=old_aliases:
                added+=len(merged)-len(old_aliases)
                record["directorAliases"]=merged
            record["aliasesCheckedAt"]=today
            scanned+=1
        except ValueError:
            # Missing person records should not prevent other films being enriched.
            continue
        if scanned and scanned%60==0:
            print("Japanese director aliases checked "+str(scanned)+" films; new names "+str(added),flush=True)
    return scanned,added

def supplement_cast_and_genres(records, films):
    """Fetch TMDb cast and localized genres for safely matched titles.

    Store cast separately from the user's curated movie categories and ranks.
    A few actors in Japanese productions also receive verified Japanese-script
    name aliases via TMDb person IDs rather than guessed translations.
    """
    scanned = 0
    added = 0
    people_cache = {}
    date = datetime.now(timezone.utc).isoformat()
    for film_id, rec in records.items():
        if film_id not in films:
            continue
        # Empty results are valid and must not be refetched forever.
        if isinstance(rec.get("cast"), list) and isinstance(rec.get("genres"), list):
            continue
        kind = rec.get("type") or "movie"
        external_id = rec.get("tmdbId")
        if kind not in ("movie", "tv") or not str(external_id).isdigit():
            continue
        path = ("/movie/" if kind == "movie" else "/tv/") + str(external_id)
        extra = "credits" if kind == "movie" else "aggregate_credits"
        try:
            item = get(path, {"append_to_response": extra, "language": "ja-JP"})
            if not compatible(films[film_id], item, kind):
                continue
            groups = item.get("genres") or []
            genres = distinct(g.get("name") for g in groups if g.get("name"))
            if kind == "movie":
                actors = (item.get("credits") or {}).get("cast") or []
            else:
                actors = (item.get("aggregate_credits") or {}).get("cast") or []
            actors = sorted(actors, key=lambda x: int(x.get("order") or 0))[:16]
            cast = []
            for i, actor in enumerate(actors):
                person_id = actor.get("id")
                name = str(actor.get("name") or actor.get("original_name") or "").strip()
                if not name:
                    continue
                japanese_aliases = []
                if (item.get("original_language") == "ja" and i < 7
                        and person_id and str(person_id).isdigit()):
                    pid = int(person_id)
                    if pid not in people_cache:
                        try:
                            person = get("/person/" + str(pid), {"language": "ja-JP"})
                            variants = distinct([person.get("name")]
                                                + (person.get("also_known_as") or []))
                            people_cache[pid] = [
                                alias for alias in variants
                                if JP_CHARACTERS.search(alias) and 2 <= len(alias) <= 55
                            ][:8]
                        except ValueError:
                            people_cache[pid] = []
                    japanese_aliases = people_cache.get(pid, [])
                cast.append({
                    "id": int(person_id) if str(person_id).isdigit() else None,
                    "name": name,
                    "aliases": distinct(japanese_aliases)
                })
            rec["cast"] = cast
            rec["genres"] = genres
            rec["castCheckedAt"] = date
            scanned += 1
            added += len(cast)
        except ValueError:
            # Mismatches and deleted TMDb IDs are retried in a later run.
            continue
        if scanned and scanned % 60 == 0:
            print("TMDb cast/genres: enriched " + str(scanned)
                  + " movies and series, " + str(added) + " actor entries",
                  flush=True)
    return scanned, added


def main():
    get("/configuration") # fail fast rather than marking all movies as misses
    films=collect()
    old=read_json(TARGET,{})
    records=dict(old.get("films") or {})
    failures={}
    completed=0
    # First fill the 205 completely missing credits; fetch remaining posters afterwards.
    priority=lambda pair: (bool((records.get(pair[0]) or {}).get("directors") or
                                (records.get(pair[0]) or {}).get("creators")),
                           bool((records.get(pair[0]) or {}).get("posterPath")))
    ordered=sorted(films.items(),key=priority)
    for i,(id,f) in enumerate(ordered,1):
        old_row=records.get(id) or {}
        if (old_row.get("directors") or old_row.get("creators")) and old_row.get("posterPath"):
            continue
        try:
            request={**f}
            if old_row.get("type")=="movie" and f.get("mediaType")=="drama":
                request["mediaType"]="movie"
            result=enrich(request,old_row)
            # An earlier manual or verified creator entry is never discarded.
            if old_row.get("directors") and not result.get("directors"):
                result["directors"]=old_row["directors"]
            if old_row.get("creators") and not result.get("creators"):
                result["creators"]=old_row["creators"]
            if old_row.get("posterUrl") and not result.get("posterUrl"):
                result["posterUrl"]=old_row["posterUrl"]
            records[id]={**old_row,**result}
            completed+=1
        except ValueError as e:
            failures[id]=str(e)
        except RuntimeError as e:
            print("Stopped after "+str(i)+" films: "+str(e),file=sys.stderr,flush=True)
            raise
        if i%25==0:
            print("Checked "+str(i)+"/"+str(len(films))+"; newly fetched "+str(completed)+"; unmatched "+str(len(failures)),flush=True)
    cast_scanned,cast_added=supplement_cast_and_genres(records,films)
    print("Cast and genres: enriched "+str(cast_scanned)+" titles, "+str(cast_added)+" credited actors",flush=True)
    alias_scanned,alias_added=supplement_japanese_director_aliases(records,films)
    print("JP director names: scanned "+str(alias_scanned)+", newly added "+str(alias_added),flush=True)
    now=datetime.now(timezone.utc).isoformat()
    result={"schema":1,"updatedAt":now,"catalogSize":len(films),
            "matchedCount":len(records),"newCount":completed,"unmatchedCount":len(failures),
            "films":records,"unmatched":failures}
    TARGET.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Done: matched "+str(len(records))+"/"+str(len(films))+", newly fetched "+str(completed)+", unmatched "+str(len(failures)),flush=True)

if __name__=="__main__":
    main()
