/* Ordered compatibility boundary for incremental renderer migration. */
(()=>{'use strict';
function decorate(render,{before,after}={}){
 return function(...args){
  if(before)before.apply(this,args);
  const result=render.apply(this,args);
  if(after)after.call(this,result,...args);
  return result;
 };
}
window.Movie30RenderLifecycle=Object.freeze({decorate});
})();
