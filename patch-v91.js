(() => {
'use strict';
// v91: Japanese director-name aliases, and tap posters in list mode to open the existing viewer.
const BUILD='20261012b';
const fold=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const pairs=[
['Yukihiko Tsutsumi','堤幸彦'],['Hayao Miyazaki','宮崎駿'],
['Yasuichiro Yamamoto','山本泰一郎'],['Satoshi Kon','今敏'],
['Hideaki Anno','庵野秀明'],['Kenji Kodama','こだま兼嗣'],
['Kobun Shizuno','静野孔文'],['Kazuya Tsurumaki','鶴巻和哉'],
['Makoto Shinkai','新海誠'],['Mamoru Hosoda','細田守'],
['Katsuyuki Motohiro','本広克行'],['Hiroaki Matsuyama','松山博昭'],
['Isao Takahata','高畑勲'],['Hirokazu Kore-eda','是枝裕和'],
['Mahiro Maeda','前田真宏'],['Takashi Yamazaki','山崎貴'],
['Masayuki Suzuki','鈴木雅之'],['Mamoru Oshii','押井守'],
['Akira Kurosawa','黒澤明','黒沢明'],['Masayuki','摩砂雪'],
['Takeshi Kitano','北野武'],['Sang-il Lee','李相日'],
['Hiroshi Nishitani','西谷弘'],['Katsuo Fukuzawa','福澤克雄'],
['Haruo Sotozaki','外崎春雄'],['Junichi Ishikawa','石川淳一'],
['Norihiro Koizumi','小泉徳宏'],['Chika Nagaoka','永岡智佳'],
['Tōya Satō','佐藤東弥'],['Nobuhiro Doi','土井裕泰'],
['Yūichirō Hayashi','林祐一郎'],['Yasuharu Ishii','石井康晴'],
['Fuminori Kaneko','金子文紀'],['Katsuhiro Otomo','大友克洋'],
['Masayuki Suō','周防正行'],['Shusuke Kaneko','金子修介'],
['Yuzuru Tachikawa','立川譲'],['Izuru Narushima','成島出'],
['Hideki Takeuchi','武内英樹'],['Hiromasa Yonebayashi','米林宏昌'],
['Eiichiro Hasumi','羽住英一郎'],['Yuichi Fukuda','福田雄一'],
['Kōji Morimoto','森本晃司'],['Koji Morimoto','森本晃司'],
['Tensai Okamura','岡村天斎'],['Hiroshi Hamasaki','浜崎博嗣'],
['Sion Sono','園子温'],['Yoshifumi Kondo','近藤喜文'],
['Yukiyo Teramoto','寺本幸代'],['Kinji Fukasaku','深作欣二'],
['Kiyoshi Kurosawa','黒沢清','黒澤清'],['Kazuhiko Hasegawa','長谷川和彦'],
['Tetsuya Nakashima','中島哲也'],['Yu Irie','入江悠'],
['Hiroyuki Morita','森田宏幸'],['Sho Tsukikawa','月川翔'],
['Hideo Nakata','中田秀夫'],['Akira Nagai','永井聡'],
['Goro Taniguchi','谷口悟朗'],['Kon Ichikawa','市川崑'],
['Koreyoshi Kurahara','蔵原惟繕'],['Shinichiro Ueda','上田慎一郎'],
['Masato Harada','原田眞人'],['Keishi Otomo','大友啓史'],
['Genki Kawamura','川村元気'],['Hayato Kawai','河合勇人'],
['Kazuaki Imai','今井一暁'],['Yusuke Hirota','廣田裕介'],
['Kazuya Shiraishi','白石和彌'],['Koki Mitani','三谷幸喜'],
['Yoshihiro Nakamura','中村義洋'],['Hitoshi One','大根仁'],
['Yoshitarō Nomura','野村芳太郎'],['Kenji Uchida','内田けんじ'],
['Shinji Higuchi','樋口真嗣'],['Junta Yamaguchi','山口淳太'],
['Tatsuya Nagamine','長峯達也'],['Takayuki Hirao','平尾隆之'],
['Tetsuro Kodama','児玉徹郎'],['Yuri Kanchiku','寒竹ゆり'],
['Tsutomu Shibayama','芝山努'],['Masahiro Hosoda','細田雅弘'],
['Hisashi Kimura','木村ひさし'],['Seiji Mizushima','水島精二'],
['Shota Goshozono','御所園翔太'],['Masaomi Ando','安藤正臣'],
['Hiroyuki Kitakubo','北久保弘之'],['Shinichiro Watanabe','渡辺信一郎'],
['Yoshiaki Kawajiri','川尻善昭'],['Takeshi Koike','小池健'],
['Shojiro Nishimi','西見祥示郎'],['Kazuto Nakazawa','中澤一登'],
['Shoji Kawamori','河森正治'],['Shinzo Katayama','片山慎三'],
['Yuichiro Hirakawa','平川雄一朗'],['Ayuko Tsukahara','塚原あゆ子'],
['Kentarō Takemura','竹村謙太郎'],['Tomokazu Yamada','山田智和'],
['Tatsuya Yoshihara','吉原達矢'],['Ryu Nakayama','中山竜'],
['Akihiko Uda','宇田鋼之介'],['Atsushi Takahashi','高橋敦史'],
['Kenichi Suzuki','鈴木健一'],['Naokatsu Tsuda','津田尚克'],
['Yuichi Satoh','佐藤祐市'],['Yuichi Sato','佐藤祐市']
];
const aliases=new Map(pairs.map(([english,...names])=>[fold(english),names]));
const priorMatch=match;
match=function(f,q){
 if(priorMatch(f,q))return true;
 const needle=fold(String(q||'').trim());if(!needle)return false;
 const m=state.letterboxdMeta?.[f.id]||{},c=m.crew84||{};
 return [...(m.directors84Manual||[]),...(c.directors||[]),...(c.creators||[])]
   .some(person=>(aliases.get(fold(person))||[]).some(jp=>fold(jp).includes(needle)));
};
const style=document.createElement('style');
style.id='movie30-poster-click91';
style.textContent=[
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card>.movie30-poster84,',
 '#watchList83 .watch83-grid:not(.poster-gallery84) .watch83-item>.movie30-poster84,',
 '#rankRoot .uns-card img.movie90-result-art,',
 '#classifyRoot .card img.movie90-result-art{pointer-events:auto!important;cursor:zoom-in!important;touch-action:manipulation}',
 '#rankRoot:not(.movie30-rank-grid-only84) .rank-card>.movie30-poster84:focus-visible,',
 '#watchList83 .watch83-grid:not(.poster-gallery84) .watch83-item>.movie30-poster84:focus-visible,',
 '#rankRoot .uns-card img.movie90-result-art:focus-visible,',
 '#classifyRoot .card img.movie90-result-art:focus-visible{outline:3px solid #b6d6ff!important;outline-offset:1px}'
].join('\n');
document.head.appendChild(style);
const posterSelector=[
 '#rankRoot .rank-card img.movie30-poster84',
 '#watchList83 .watch83-item img.movie30-poster84',
 '#rankRoot .uns-card img.movie90-result-art',
 '#classifyRoot .card img.movie90-result-art'
].join(',');
function clickablePoster(event){
 const img=event.target?.closest?.(posterSelector);
 if(!img||img.closest('#rankRoot.movie30-rank-grid-only84, .watch83-grid.poster-gallery84'))return null;
 const card=img.closest('[data-id], [data-film], [data-uns]');
 const raw=card?.dataset.id||card?.dataset.film||card?.dataset.uns||img.dataset.posterId||'';
 const id=decodeURIComponent(raw);
 return id&&filmById(id)&&img.getAttribute('src')?{img,id}:null;
}
document.addEventListener('click',event=>{
 const target=clickablePoster(event),viewer=window.__movie30SearchPosters90;
 if(!target||!viewer?.openViewer)return;
 event.preventDefault();event.stopImmediatePropagation();
 viewer.openViewer(target.id,target.img);
},true);
document.addEventListener('keydown',event=>{
 if(event.key!=='Enter'&&event.key!==' ')return;
 const target=clickablePoster(event),viewer=window.__movie30SearchPosters90;
 if(!target||!viewer?.openViewer)return;
 event.preventDefault();event.stopImmediatePropagation();
 viewer.openViewer(target.id,target.img);
},true);
let queued=false;
function setFocus(){
 queued=false;
 for(const img of document.querySelectorAll(posterSelector)){
  const gallery=!!img.closest('#rankRoot.movie30-rank-grid-only84, .watch83-grid.poster-gallery84');
  if(gallery){
   if(img.dataset.posterClick91){img.removeAttribute('tabindex');img.removeAttribute('role');img.removeAttribute('aria-label');delete img.dataset.posterClick91;}
  }else if(!img.dataset.posterClick91){
   img.dataset.posterClick91='1';img.tabIndex=0;img.setAttribute('role','button');
   img.setAttribute('aria-label','ポスターを拡大表示');
  }
 }
}
function queueFocus(){if(queued)return;queued=true;requestAnimationFrame(setFocus);}
for(const id of ['rankRoot','watchList83','classifyRoot']){
 const root=document.getElementById(id);
 if(root)new MutationObserver(queueFocus).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
queueFocus();
window.__movie30JPDirector91={build:BUILD,knownNames:aliases.size};
const marker=document.getElementById('movie30BuildV29');
if(marker)marker.textContent='app build '+BUILD;
})();