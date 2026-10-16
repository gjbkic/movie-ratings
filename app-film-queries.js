/* Pure film queries. Inputs are supplied at call time; no retained state/cache. */
(() => {
  'use strict';
  function filmById(films,id){return films.find(f=>f.id===id)}
  function titleInfo(f,overrides){const o=overrides[f.id]||{};return {title:String(o.title??f.title??'').trim(),originalTitle:String(o.originalTitle??f.originalTitle??'').trim(),englishTitle:String(o.englishTitle??f.englishTitle??f.lbTitle??'').trim(),tmdbId:o.tmdbId??f.tmdbId??null}}
  function displayTitle(f,overrides){const x=titleInfo(f,overrides);return x.title||x.englishTitle||x.originalTitle||'（無題）'}
  function secondaryTitle(f,overrides){const x=titleInfo(f,overrides),main=displayTitle(f,overrides);if(x.originalTitle&&x.originalTitle!==main)return x.originalTitle;if(x.englishTitle&&x.englishTitle!==main)return x.englishTitle;return ''}
  function filmCategory(f,overrides){return String((overrides||{})[f.id]??f.category??'').trim()}
  window.Movie30FilmQueries=Object.freeze({filmById,titleInfo,displayTitle,secondaryTitle,filmCategory});
})();
