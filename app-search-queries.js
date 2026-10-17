/* Base structured search only; later director/catalog/cast extensions remain in order. */
(()=>{'use strict';
function structuredMatch(f,q,{titleInfo,mediaLabel19,origin19,formatLabel19,rawGenres,runtime19}){if(!q)return true;q=String(q).toLowerCase();const x=titleInfo(f);return [x.title,x.originalTitle,x.englishTitle,f.lbTitle||'',f.year||'',mediaLabel19(f),origin19(f),formatLabel19(f),rawGenres(f).join(' '),runtime19(f)||''].join(' ').toLowerCase().includes(q);}
window.Movie30SearchQueries=Object.freeze({structuredMatch});
})();
