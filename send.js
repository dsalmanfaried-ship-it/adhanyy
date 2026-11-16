const webpush=require('web-push');
const LAT=+(process.env.LAT||30.0444),LNG=+(process.env.LNG||31.2357),TZ=process.env.TZ_NAME||'Africa/Cairo',REM=+(process.env.REM||10);
const R=Math.PI/180,fix=(x,a)=>x-a*Math.floor(x/a);
const P=[['fajr','الفجر'],['dhuhr','الظهر'],['asr','العصر'],['maghrib','المغرب'],['isha','العشاء']];
function sun(jd){const D=jd-2451545,g=fix(357.529+.98560028*D,360),q=fix(280.459+.98564736*D,360),L=fix(q+1.915*Math.sin(g*R)+.02*Math.sin(2*g*R),360),e=23.439-3.6e-7*D;
 const ra=fix(Math.atan2(Math.cos(e*R)*Math.sin(L*R),Math.cos(L*R))/R/15,24);
 return{d:Math.asin(Math.sin(e*R)*Math.sin(L*R))/R,eq:fix(q/15-ra+12,24)-12}}
function tzOff(date){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:TZ,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));
 return(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-date.getTime())/36e5}
function day(Y,M,D){const tz=tzOff(new Date(Date.UTC(Y,M,D,9))),jd=Date.UTC(Y,M,D,12)/864e5+2440587.5,s=sun(jd),noon=12+tz-LNG/15-s.eq;
 const at=(a,ccw)=>{const x=(-Math.sin(a*R)-Math.sin(s.d*R)*Math.sin(LAT*R))/(Math.cos(s.d*R)*Math.cos(LAT*R));const t=Math.acos(Math.max(-1,Math.min(1,x)))/R/15;return ccw?noon-t:noon+t};
 const asrA=-Math.atan(1/(1+Math.tan(Math.abs(LAT-s.d)*R)))/R,t={fajr:at(19.5,1),dhuhr:noon,asr:at(asrA),maghrib:at(.833),isha:at(17.5)},b=Date.UTC(Y,M,D)-tz*36e5,r={};
 for(const k in t)r[k]=b+t[k]*36e5;return r}
const now=Date.now(),lp=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date(now)).map(x=>[x.type,+x.value]));
const days=[-1,0,1,2].map(o=>day(lp.year,lp.month-1,lp.day+o)),ev=[];
days.forEach((r,i)=>{P.forEach(([k,n])=>{
  ev.push({t:r[k],tag:'a-'+k+'-'+Math.round(r[k]/6e4),title:'حان الآن موعد أذان '+n,body:'حي على الصلاة',k});
  ev.push({t:r[k]-REM*6e4,tag:'s-'+k+'-'+Math.round(r[k]/6e4),title:'اقترب موعد صلاة '+n,body:'باقي '+REM+' دقيقة تقريبًا',silent:false})});
 if(i<days.length-1){const nf=days[i+1].fajr,night=nf-r.maghrib;ev.push({t:nf-night/3,tag:'t-'+Math.round(nf/6e4),title:'بدأ الثلث الأخير من الليل',body:'وقت الدعاء والاستغفار',silent:true})}});
const due=ev.filter(e=>e.t<=now&&now-e.t<8*6e4);
console.log('now',new Date(now).toISOString(),'due',due.length);
if(!due.length||!process.env.PUSH_SUB)process.exit(0);
webpush.setVapidDetails('mailto:adhan@example.com',process.env.VAPID_PUBLIC,process.env.VAPID_PRIVATE);
const sub=JSON.parse(process.env.PUSH_SUB);
(async()=>{for(const e of due){try{await webpush.sendNotification(sub,JSON.stringify({title:e.title,body:e.body,tag:e.tag,silent:!!e.silent}),{TTL:600,urgency:'high'});console.log('sent',e.tag)}catch(x){console.log('fail',e.tag,x.statusCode||x.message)}}})();
