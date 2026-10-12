import os
os.environ.setdefault("TMDB_API_KEY", "test-placeholder")
import unittest
from unittest.mock import patch
import recheck_cast as cast

class ResolverTests(unittest.TestCase):
    def test_current_split_app_and_metadata_are_read(self):
        films = cast.collect()
        self.assertGreater(len(films), 734)
        episodes = [f for f in films.values() if f["meta"].get("contentType") == "tv_episode"]
        self.assertGreater(len(episodes), 10)
        self.assertTrue(any(f["meta"].get("tmdbSeriesId") == 42009 for f in episodes))

    def test_drama_ui_movie_namespace_and_original_title(self):
        film = dict(title="特別編", englishTitle="Special", year=2020, tmdbId=123, mediaType="drama", meta={})
        with patch.object(cast,"api",return_value=dict(id=123,title="Special",release_date="2020-01-01")) as api:
            result = cast.resolve(film,{})
        self.assertEqual(result[:2], ("movie",123))
        self.assertEqual(api.call_args.args[0],"/movie/123")

    def test_episode_uses_own_credits_not_series(self):
        film = dict(title="Black Mirror: Test", meta=dict(contentType="tv_episode",tmdbSeriesId=42009,seasonNumber=4,episodeNumber=6))
        with patch.object(cast,"api",return_value={"credits":{"cast":[{"id":10,"name":"Episode voice actor","character":"Voice"}]}}) as api:
            result=cast.fetch_cast(film,{"type":"tv","tmdbId":42009})
        self.assertEqual(result["contentType"],"tv_episode")
        self.assertEqual(result["cast"][0]["name"],"Episode voice actor")
        self.assertIn("/season/4/episode/6",api.call_args.args[0])

    def test_empty_japanese_credits_retry_english_voice_credits(self):
        film=dict(title="Animation",year=2020,meta={})
        with patch.object(cast,"resolve",return_value=("movie",123,{"credits":{"cast":[]}},None,None)),patch.object(cast,"api",return_value={"cast":[{"id":2,"name":"声優","character":"役 (voice)"}]}):
            result=cast.fetch_cast(film,{})
        self.assertEqual(result["cast"][0]["role"],"役 (voice)")

    def test_api_errors_are_not_swallowed_as_title_misses(self):
        with patch.object(cast,"api",side_effect=RuntimeError("TMDb network retry exhausted")):
            with self.assertRaisesRegex(RuntimeError,"network"):
                cast.resolve(dict(title="Test",tmdbId=123,meta={}),{})

if __name__=="__main__":
    unittest.main()
