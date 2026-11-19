const V='adhan-v2',
SHELL=['./','index.html','manifest.json','icon-192.png','icon-512.png'],
AUDIO=['adhan.mp3','adhan-fajr.mp3','soon.mp3'];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(V);
    await c.addAll(SHELL);
    // الأصوات كبيرة: لو ملف ناقص (زي soon.mp3) يتجاهله ومايوقفش التثبيت
    await Promise.all(AUDIO.map(u=>c.add(u).catch(()=>{})));
  })());
  self.skipWaiting();
});

self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==V)await caches.delete(k);
  await clients.claim();
})()));

// المتصفح بيطلب الصوت على أجزاء (Range)، فلازم نرد من الكاش بنفس الطريقة
async function ranged(req,res){
  const m=/bytes=(\d*)-(\d*)/.exec(req.headers.get('range')||'');
  if(!m)return res;
  const b=await res.blob(),n=b.size;
  let s,e;
  if(m[1]===''){s=Math.max(0,n-+m[2]);e=n-1}
  else{s=+m[1];e=m[2]===''?n-1:Math.min(+m[2],n-1)}
  if(s>=n)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+n}});
  return new Response(b.slice(s,e+1),{status:206,headers:{
    'Content-Type':res.headers.get('Content-Type')||'audio/mpeg',
    'Content-Range':`bytes ${s}-${e}/${n}`,
    'Content-Length':String(e-s+1),
    'Accept-Ranges':'bytes'}});
}

self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  const isAudio=/\.(mp3|m4a|ogg|wav)$/i.test(u.pathname);
  e.respondWith((async()=>{
    const c=await caches.open(V);
    if(isAudio){
      // الصوت: من الكاش أولًا (شغال أوفلاين)، ولو مش متخزن ينزّله ويخزّنه
      const hit=await c.match(u.href,{ignoreSearch:true});
      if(hit)return ranged(r,hit);
      e.waitUntil(c.add(u.href).catch(()=>{}));
      return fetch(r);
    }
    // الصفحة والداتا: من النت لو متاح (عشان التحديثات)، وإلا من الكاش
    try{
      const res=await fetch(r);
      if(res.ok)c.put(r,res.clone());
      return res;
    }catch(err){
      return (await c.match(r,{ignoreSearch:true}))||(await c.match('index.html'))||Response.error();
    }
  })());
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(l=>l.length?l[0].focus():clients.openWindow('./')));
});
