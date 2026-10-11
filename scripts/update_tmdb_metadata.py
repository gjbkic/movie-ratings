#!/usr/bin/env python3
"""Update public TMDb film metadata; no user scores, reviews or access tokens are exported."""
import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
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

def get(path, params=None):
    global last_call
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
            if exc.code==429 or 500<=exc.code<600:
                pause=min(30,(2**attempt)*2)
                if exc.code==429:
                    retry=exc.headers.get("Retry-After","")
                    if retry.isdigit():pause=max(pause,min(30,int(retry)))
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
    html=(ROOT/"index.html").read_text(encoding="utf-8")
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

def search_id(f):
    year=int(f.get("year") or 0)
    titles=distinct([f.get("englishTitle"),f.get("lbTitle"),f.get("originalTitle"),f.get("title")])
    kind=str(f.get("mediaType") or "").lower()
    tv=kind in ("tv_series","tv_episode","drama","tv")
    if year==2018 and "wildlife" in {normalized(v) for v in titles} and not tv:
        return "movie",417812
    explicit=f.get("tmdbId")
    if explicit and str(explicit).isdigit():
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

def enrich(f,existing):
    typ,id=search_id(f)
    if typ=="movie":
        x=get("/movie/"+str(id),{"append_to_response":"credits","language":"en-US"})
        crew=(x.get("credits") or {}).get("crew") or []
        directors=distinct(c.get("name") for c in crew if c.get("job")=="Director")
        creators=[]
    else:
        x=get("/tv/"+str(id),{"language":"en-US"})
        directors=[]
        creators=distinct(c.get("name") for c in x.get("created_by") or [])
    if not (directors or creators or x.get("poster_path")):
        raise ValueError("No credits or poster on TMDb")
    return {"tmdbId":id,"type":typ,"title":x.get("title") or x.get("name") or "",
            "year":str(f.get("year") or ""),"directors":directors,"creators":creators,
            "posterPath":x.get("poster_path") or "","source":"tmdb"}

def main():
    get("/configuration") # fail fast rather than marking all movies as misses
    films=collect()
    old=read_json(TARGET,{})
    records=dict(old.get("films") or {})
    failures={}
    completed=0
    for i,(id,f) in enumerate(films.items(),1):
        old_row=records.get(id) or {}
        if old_row.get("tmdbId") and (old_row.get("directors") or old_row.get("creators") or old_row.get("posterPath")):
            continue
        try:
            result=enrich(f,old_row)
            records[id]=result
            completed+=1
        except ValueError as e:
            failures[id]=str(e)
        except RuntimeError as e:
            print("Stopped after "+str(i)+" films: "+str(e),file=sys.stderr,flush=True)
            raise
        if i%25==0:
            print("Checked "+str(i)+"/"+str(len(films))+"; newly fetched "+str(completed)+"; unmatched "+str(len(failures)),flush=True)
    now=datetime.now(timezone.utc).isoformat()
    result={"schema":1,"updatedAt":now,"catalogSize":len(films),
            "matchedCount":len(records),"newCount":completed,"unmatchedCount":len(failures),
            "films":records,"unmatched":failures}
    TARGET.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Done: matched "+str(len(records))+"/"+str(len(films))+", newly fetched "+str(completed)+", unmatched "+str(len(failures)),flush=True)

if __name__=="__main__":
    main()
