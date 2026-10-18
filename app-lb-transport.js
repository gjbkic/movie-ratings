(()=>{
 'use strict';
 // Consume the body before releasing the deadline; a received header is not completion.
 async function read(url,options={},timeoutMs=15000){
  const controller=new AbortController();
  let expired=false;
  const timer=setTimeout(()=>{expired=true;controller.abort()},Math.max(1,timeoutMs));
  try{
   const response=await fetch(url,{...options,signal:controller.signal});
   const text=await response.text();
   return {response,text};
  }catch(error){
   if(expired){const failure=new Error('Letterboxd同期の通信がタイムアウトしました');failure.name='TimeoutError';throw failure}
   throw error;
  }finally{clearTimeout(timer)}
 }
 window.Movie30LbTransport=Object.freeze({read});
})();
