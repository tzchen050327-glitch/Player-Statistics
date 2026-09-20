const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const APP_KEY='__APP_KEY__';
const PROXY_KEY='__CPBL_PROXY_KEY__';
const ALLOWED=new Set(['season-history','season-histories','season-stats']);
const CORS={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'POST, OPTIONS',
  'access-control-allow-headers':'content-type',
  'content-type':'application/json; charset=utf-8'
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:CORS});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return reply({ok:false,error:'POST only'},405);
  try{
    const body=JSON.parse(await req.text()||'{}');
    if(body.appKey!==APP_KEY)return reply({ok:false,error:'Forbidden'},403);
    if(!String(body.anonKey||''))return reply({ok:false,error:'Missing client key'},403);
    delete body.appKey; delete body.anonKey;
    const action=String(body.action||'');
    if(!ALLOWED.has(action))return reply({ok:false,error:'unsupported on archive backend'},400);
    const r=await fetch(`${SUPABASE_URL}/functions/v1/cpbl-api`,{
      method:'POST',
      headers:{'content-type':'application/json','x-cpbl-proxy-key':PROXY_KEY},
      body:JSON.stringify(body)
    });
    return new Response(await r.text(),{status:r.status,headers:CORS});
  }catch(e){
    return reply({ok:false,error:e instanceof Error?e.message:String(e)},500);
  }
});