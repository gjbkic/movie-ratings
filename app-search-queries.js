/* Search calculations; wrappers retain their ordering and live metadata ownership. */
(()=>{'use strict';
function structuredMatch(f,q,{titleInfo,mediaLabel19,origin19,formatLabel19,rawGenres,runtime19}){if(!q)return true;q=String(q).toLowerCase();const x=titleInfo(f);return [x.title,x.originalTitle,x.englishTitle,f.lbTitle||'',f.year||'',mediaLabel19(f),origin19(f),formatLabel19(f),rawGenres(f).join(' '),runtime19(f)||''].join(' ').toLowerCase().includes(q);}
function crew(q,m){
 if(!q)return true;
 const words=String(q).normalize('NFKC').toLowerCase().trim(),c=m.crew84||{};
 return [...(c.directors||[]),...(c.creators||[])].join(' ').normalize('NFKC').toLowerCase().includes(words);
}
function directorAliases(q,m,aliases,fold){
 const needle=fold(String(q||'').trim());if(!needle)return false;
 const c=m.crew84||{};
 return [...(m.directors84Manual||[]),...(c.directors||[]),...(c.creators||[])]
  .some(person=>(aliases.get(fold(person))||[]).some(jp=>fold(jp).includes(needle)));
}
function catalogLabels(q,rec,norm){
 if(!q)return true;
 const needle=norm(q);if(!needle)return false;
 return [...(rec.directorAliases||[]),rec.title||''].some(label=>norm(label).includes(needle));
}
function castNames(id,query,namesForFilm,fold){
 const needle=fold(query);
 return !!needle&&namesForFilm(id).some(name=>fold(name).includes(needle));
}
function taxonomyLabel(query,label){return label.toLowerCase().includes(String(query).toLowerCase());}
window.Movie30SearchQueries=Object.freeze({structuredMatch,crew,directorAliases,catalogLabels,castNames,taxonomyLabel});
})();
