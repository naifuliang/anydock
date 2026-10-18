import { Hono } from "hono";
import { z } from "zod";
import { encryptToken, decryptToken } from "./secure.ts";
import type { AppEnv, Env } from "./types.ts";

export const organizations = new Hono<AppEnv>();
const stamp = () => new Date().toISOString();
const id = z.string().uuid();
type Role = "owner" | "admin" | "member";
type Connection = { externalId: string; token: string; version: string };
type RequestRow = { id: string; organizationId: string; userId: string; serverId: string; branch: string | null; version: string; status: string; result: string | null; expiresAt: string };
const member = (db: D1Database, org: string, user: string) => db.prepare("select role from organizationMember where organizationId=?1 and userId=?2").bind(org,user).first<{role:Role}>();
const connection = (env: Env, org: string) => env.DB.prepare("select externalId,token,version from organizationManufact where organizationId=?1").bind(org).first<Connection>();
const audit = (db: D1Database, org: string, user: string, event: string, resource: string | null = null) => db.prepare("insert into organizationAudit values (?1,?2,?3,?4,?5,?6)").bind(crypto.randomUUID(),org,user,event,resource,stamp()).run();
const cancel = (db: D1Database, org: string) => db.prepare("update organizationRequest set status='cancelled' where organizationId=?1 and status='pending'").bind(org);

async function policy(env: Env, org: string, user: string, server: string, action: "read" | "redeploy") {
  const m = await member(env.DB,org,user);
  const resource = await env.DB.prepare("select 1 from organizationResource where organizationId=?1 and serverId=?2").bind(org,server).first();
  if (!m || !resource) return "deny";
  const grant = await env.DB.prepare("select decision from organizationGrant where organizationId=?1 and userId=?2 and serverId=?3 and action=?4").bind(org,user,server,action).first<{decision:string}>();
  return grant?.decision ?? (m.role === "member" ? "deny" : action === "read" ? "allow" : "ask");
}

async function upstream(env: Env, key: string, path: string, body?: unknown) {
  const r = await fetch(`${env.MANUFACT_API ?? "https://cloud.manufact.com/api/v1"}${path}`, {
    method: body ? "POST" : "GET", redirect: "manual", signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(body ? {body:JSON.stringify(body)} : {}),
  });
  if (!r.ok) throw new Error(`Manufact request failed (${r.status})`);
  return await r.json() as any;
}
async function keyFor(env: Env, org: string, conn: Connection) {
  const data = JSON.parse(await decryptToken(env.BETTER_AUTH_SECRET, conn.token));
  if (data.organizationId !== org) throw new Error("Connection mismatch");
  return data.key as string;
}
async function serverFor(env: Env, key: string, conn: Connection, server: string) {
  const s = await upstream(env,key,`/servers/${encodeURIComponent(server)}`);
  if (s.id !== server || s.organizationId !== conn.externalId) throw new Error("Server does not belong to the connected organization");
  return {id:s.id, name:s.name, slug:s.slug, status:s.status};
}
function publicRequest(row: RequestRow) {
  return {id:row.id, userId:row.userId, serverId:row.serverId, branch:row.branch, status:row.status, expiresAt:row.expiresAt, result:row.result ? JSON.parse(row.result) : null};
}

// Mounted only under /organizations: unrelated routes are never intercepted.
organizations.use("/organizations*", async (c,next) => {
  const user = c.get("session")?.user;
  if (!user) return c.json({error:"unauthorized"},401);
  if (c.req.method !== "GET" && !c.req.header("Authorization")?.startsWith("Bearer ") && c.req.header("Origin") !== new URL(c.req.url).origin)
    return c.json({error:"invalid_origin"},403);
  c.set("user",user); await next();
});
organizations.post("/organizations",async c => {
  const p=z.object({name:z.string().trim().min(1).max(120)}).safeParse(await c.req.json().catch(()=>null));
  if(!p.success)return c.json({error:"invalid_body"},400);
  const org=crypto.randomUUID(), user=c.get("user").id;
  await c.env.DB.batch([
    c.env.DB.prepare("insert into organization values (?1,?2,?3,?4)").bind(org,p.data.name,user,stamp()),
    c.env.DB.prepare("insert into organizationMember values (?1,?2,'owner')").bind(org,user),
  ]);
  return c.json({organization:{id:org,name:p.data.name,role:"owner"}},201);
});
organizations.get("/organizations",async c => {
  const rows=await c.env.DB.prepare("select o.id,o.name,m.role from organization o join organizationMember m on m.organizationId=o.id where m.userId=?1 order by o.createdAt").bind(c.get("user").id).all();
  return c.json({organizations:rows.results});
});
organizations.get("/organizations/:org",async c => {
  const org=c.req.param("org"), user=c.get("user").id, m=await member(c.env.DB,org,user);
  if(!m)return c.json({error:"not_found"},404);
  const members=await c.env.DB.prepare('select u.id,u.email,u.name,m.role from organizationMember m join "user" u on u.id=m.userId where m.organizationId=?1').bind(org).all();
  const resources=await c.env.DB.prepare("select serverId,name from organizationResource where organizationId=?1").bind(org).all<{serverId:string;name:string}>();
  const visible=[];
  for(const r of resources.results) if(await policy(c.env,org,user,r.serverId,"read") === "allow")visible.push(r);
  const conn=await connection(c.env,org);
  const grants= m.role === "owner" ? (await c.env.DB.prepare("select userId,serverId,action,decision from organizationGrant where organizationId=?1").bind(org).all()).results : [];
  return c.json({role:m.role,members:members.results,connected:!!conn,resources:visible,managedResources:m.role === "owner" ? resources.results : [],grants});
});
organizations.put("/organizations/:org/members",async c => {
  const org=c.req.param("org"), me=c.get("user").id;
  if((await member(c.env.DB,org,me))?.role!=="owner")return c.json({error:"forbidden"},403);
  const p=z.object({email:z.string().email(),role:z.enum(["admin","member"])}).safeParse(await c.req.json().catch(()=>null));
  if(!p.success)return c.json({error:"invalid_body"},400);
  const target=await c.env.DB.prepare('select id from "user" where lower(email)=?1').bind(p.data.email.toLowerCase()).first<{id:string}>();
  if(!target)return c.json({error:"no_account"},404);
  if(target.id===me)return c.json({error:"owner_role_fixed"},400);
  await c.env.DB.batch([cancel(c.env.DB,org),c.env.DB.prepare("insert into organizationMember values (?1,?2,?3) on conflict(organizationId,userId) do update set role=excluded.role").bind(org,target.id,p.data.role)]);
  await audit(c.env.DB,org,me,"member.updated",target.id);return c.json({ok:true});
});
organizations.delete("/organizations/:org/members/:user",async c => {
  const org=c.req.param("org"), me=c.get("user").id, target=c.req.param("user");
  if((await member(c.env.DB,org,me))?.role!=="owner" || target===me)return c.json({error:"forbidden"},403);
  await c.env.DB.batch([cancel(c.env.DB,org),c.env.DB.prepare("delete from organizationMember where organizationId=?1 and userId=?2").bind(org,target)]);
  await audit(c.env.DB,org,me,"member.removed",target);return c.json({ok:true});
});
organizations.put("/organizations/:org/manufact",async c => {
  const org=c.req.param("org"), user=c.get("user").id;
  if((await member(c.env.DB,org,user))?.role!=="owner")return c.json({error:"forbidden"},403);
  const p=z.object({externalId:id,apiKey:z.string().min(20).max(4096),serverIds:z.array(id).max(100)}).safeParse(await c.req.json().catch(()=>null));
  if(!p.success)return c.json({error:"invalid_body"},400);
  let stage = "provider_validation";
  try {
    const {apiKey,externalId,serverIds}=p.data;
    const remote=await upstream(c.env,apiKey,"/organizations");
    if(!remote.organizations?.some((o:any)=>o.id===externalId))return c.json({error:"manufact_organization_not_accessible"},403);
    const conn={externalId,token:"",version:crypto.randomUUID()}, resources=[];
    for(const server of [...new Set(serverIds)])resources.push(await serverFor(c.env,apiKey,conn,server));
    stage="encryption";
    const token=await encryptToken(c.env.BETTER_AUTH_SECRET,JSON.stringify({organizationId:org,key:apiKey}));
    stage="storage";
    await c.env.DB.batch([cancel(c.env.DB,org),
      c.env.DB.prepare("delete from organizationGrant where organizationId=?1").bind(org),
      c.env.DB.prepare("delete from organizationResource where organizationId=?1").bind(org),
      c.env.DB.prepare("insert into organizationManufact values (?1,?2,?3,?4) on conflict(organizationId) do update set externalId=excluded.externalId,token=excluded.token,version=excluded.version").bind(org,externalId,token,conn.version),
      ...resources.map(s=>c.env.DB.prepare("insert into organizationResource values (?1,?2,?3)").bind(org,s.id,s.name??s.slug??s.id)),
    ]);
    stage="audit";
    await audit(c.env.DB,org,user,"manufact.connected");return c.json({ok:true});
  } catch (error) {
    const status = error instanceof Error ? /^Manufact request failed \((\d{3})\)$/.exec(error.message)?.[1] : undefined;
    return c.json({error:"manufact_connection_failed", stage, message:status ? `Manufact returned HTTP ${status}` : `Manufact connection failed during ${stage}`, ...(status ? {providerStatus:Number(status)} : {})},502);
  }
});
// Resource changes reuse the encrypted connection; owners never need to retrieve/retype a key.
organizations.get("/organizations/:org/manufact/resources",async c=>{
  const org=c.req.param("org"),user=c.get("user").id;
  if((await member(c.env.DB,org,user))?.role!=="owner")return c.json({error:"forbidden"},403);
  const conn=await connection(c.env,org);if(!conn)return c.json({error:"not_connected"},409);
  try {
    const data=await upstream(c.env,await keyFor(c.env,org,conn),`/servers?organizationId=${encodeURIComponent(conn.externalId)}&limit=100`);
    const servers=(data.items??[]).filter((r:any)=>r.organizationId===conn.externalId).map((r:any)=>({id:r.id,name:r.name,slug:r.slug,status:r.status}));
    return c.json({servers});
  }catch{return c.json({error:"manufact_read_failed"},502);}
});
organizations.put("/organizations/:org/manufact/resources",async c=>{
  const org=c.req.param("org"),user=c.get("user").id;
  if((await member(c.env.DB,org,user))?.role!=="owner")return c.json({error:"forbidden"},403);
  const p=z.object({serverIds:z.array(id).max(100)}).safeParse(await c.req.json().catch(()=>null));
  if(!p.success)return c.json({error:"invalid_body"},400);
  const conn=await connection(c.env,org);if(!conn)return c.json({error:"not_connected"},409);
  try {
    const key=await keyFor(c.env,org,conn),resources=[];
    for(const server of [...new Set(p.data.serverIds)])resources.push(await serverFor(c.env,key,conn,server));
    // A new version invalidates any in-flight pending requests and concurrent old connections.
    const version=crypto.randomUUID();
    const applied=await c.env.DB.batch([
      c.env.DB.prepare("update organizationManufact set version=?2 where organizationId=?1 and version=?3").bind(org,version,conn.version),
      c.env.DB.prepare("update organizationRequest set status='cancelled' where organizationId=?1 and status='pending' and exists(select 1 from organizationManufact where organizationId=?1 and version=?2)").bind(org,version),
      c.env.DB.prepare("delete from organizationGrant where organizationId=?1 and exists(select 1 from organizationManufact where organizationId=?1 and version=?2)").bind(org,version),
      c.env.DB.prepare("delete from organizationResource where organizationId=?1 and exists(select 1 from organizationManufact where organizationId=?1 and version=?2)").bind(org,version),
      ...resources.map(r=>c.env.DB.prepare("insert into organizationResource select ?1,?2,?3 where exists(select 1 from organizationManufact where organizationId=?1 and version=?4)").bind(org,r.id,r.name??r.slug??r.id,version)),
    ]);
    if(!applied[0].meta.changes)return c.json({error:"connection_changed_retry"},409);
    await audit(c.env.DB,org,user,"resources.updated");return c.json({ok:true});
  }catch{return c.json({error:"manufact_resources_failed"},502);}
});
organizations.delete("/organizations/:org/manufact",async c=>{
  const org=c.req.param("org"), user=c.get("user").id;
  if((await member(c.env.DB,org,user))?.role!=="owner")return c.json({error:"forbidden"},403);
  await c.env.DB.batch([cancel(c.env.DB,org),c.env.DB.prepare("delete from organizationGrant where organizationId=?1").bind(org),c.env.DB.prepare("delete from organizationResource where organizationId=?1").bind(org),c.env.DB.prepare("delete from organizationManufact where organizationId=?1").bind(org)]);
  await audit(c.env.DB,org,user,"manufact.disconnected");return c.json({ok:true});
});
organizations.put("/organizations/:org/grants",async c=>{
  const org=c.req.param("org"), me=c.get("user").id;
  if((await member(c.env.DB,org,me))?.role!=="owner")return c.json({error:"forbidden"},403);
  const p=z.object({userId:z.string().min(1),serverId:id,action:z.enum(["read","redeploy"]),decision:z.enum(["allow","ask","deny"])}).safeParse(await c.req.json().catch(()=>null));
  if(!p.success || (p.data.action==="read" && p.data.decision==="ask"))return c.json({error:"invalid_body"},400);
  const g=p.data;
  if(!await member(c.env.DB,org,g.userId) || !await c.env.DB.prepare("select 1 from organizationResource where organizationId=?1 and serverId=?2").bind(org,g.serverId).first())return c.json({error:"invalid_resource_or_member"},400);
  await c.env.DB.batch([cancel(c.env.DB,org),c.env.DB.prepare("insert into organizationGrant values (?1,?2,?3,?4,?5) on conflict(organizationId,userId,serverId,action) do update set decision=excluded.decision").bind(org,g.userId,g.serverId,g.action,g.decision)]);
  await audit(c.env.DB,org,me,"grant.updated",g.serverId);return c.json({ok:true});
});
organizations.get("/organizations/:org/manufact/servers/:server",async c=>{
  const org=c.req.param("org"), user=c.get("user").id, server=c.req.param("server");
  if(await policy(c.env,org,user,server,"read")!=="allow")return c.json({error:"not_found"},404);
  const conn=await connection(c.env,org);if(!conn)return c.json({error:"not_connected"},409);
  try {const data=await serverFor(c.env,await keyFor(c.env,org,conn),conn,server);await audit(c.env.DB,org,user,"server.read",server);return c.json({server:data});}
  catch{return c.json({error:"manufact_read_failed"},502);}
});

async function execute(env:Env,row:RequestRow,decidedBy:string|null) {
  const conn=await connection(env,row.organizationId);
  const decision=await policy(env,row.organizationId,row.userId,row.serverId,"redeploy");
  if(!conn || conn.version!==row.version || (decision!=="allow" && !(decision==="ask" && decidedBy)) || Date.parse(row.expiresAt)<=Date.now())return null;
  // Compare-and-set is the single execution claim; retries and duplicate approvals cannot redeploy twice.
  const claimed=await env.DB.prepare(`update organizationRequest set status='executing',decidedBy=?2
    where id=?1 and status='pending' and expiresAt>?3
    and exists(select 1 from organizationManufact c where c.organizationId=organizationRequest.organizationId and c.version=organizationRequest.version)
    and exists(select 1 from organizationResource r where r.organizationId=organizationRequest.organizationId and r.serverId=organizationRequest.serverId)
    and exists(select 1 from organizationMember m where m.organizationId=organizationRequest.organizationId and m.userId=organizationRequest.userId
      and coalesce((select g.decision from organizationGrant g where g.organizationId=m.organizationId and g.userId=m.userId and g.serverId=organizationRequest.serverId and g.action='redeploy'),case when m.role='member' then 'deny' else 'ask' end) in ('allow',case when ?2 is not null then 'ask' else 'allow' end))
    and (?2 is null or (?2<>userId and exists(select 1 from organizationMember a where a.organizationId=organizationRequest.organizationId and a.userId=?2 and a.role in ('owner','admin'))))
    returning id`).bind(row.id,decidedBy,stamp()).first();
  if(!claimed)return null;
  let result:Record<string,unknown>, status:string;
  try {
    const key=await keyFor(env,row.organizationId,conn);await serverFor(env,key,conn,row.serverId);
    const data=await upstream(env,key,"/deployments",{serverId:row.serverId,trigger:"redeploy",...(row.branch?{branch:row.branch}:{})});
    if(!id.safeParse(data.id).success)throw new Error("Invalid deployment response");
    result={deploymentId:data.id,deploymentStatus:"pending"};status="submitted";
  } catch {status="failed";result={message:"Deployment outcome could not be confirmed. Check Manufact before requesting another deployment."};}
  await env.DB.prepare("update organizationRequest set status=?2,result=?3 where id=?1").bind(row.id,status,JSON.stringify(result)).run();
  await audit(env.DB,row.organizationId,row.userId,`redeploy.${status}`,row.serverId);
  return publicRequest({...row,status,result:JSON.stringify(result)});
}
organizations.post("/organizations/:org/requests",async c=>{
  const org=c.req.param("org"), user=c.get("user").id;
  const p=z.object({serverId:id,requestKey:id,branch:z.string().trim().min(1).max(200).optional()}).safeParse(await c.req.json().catch(()=>null));
  if(!p.success)return c.json({error:"invalid_body"},400);
  if(!await member(c.env.DB,org,user))return c.json({error:"not_found"},404);
  const previous=await c.env.DB.prepare("select * from organizationRequest where organizationId=?1 and userId=?2 and requestKey=?3").bind(org,user,p.data.requestKey).first<RequestRow>();
  if(previous){
    if(previous.serverId!==p.data.serverId || previous.branch!==(p.data.branch??null))return c.json({error:"request_key_conflict"},409);
    return c.json({request:publicRequest(previous)});
  }
  const decision=await policy(c.env,org,user,p.data.serverId,"redeploy");
  if(decision==="deny"){await audit(c.env.DB,org,user,"redeploy.blocked",p.data.serverId);return c.json({error:"forbidden"},403);}
  const conn=await connection(c.env,org);if(!conn)return c.json({error:"not_connected"},409);
  const row:RequestRow={id:crypto.randomUUID(),organizationId:org,userId:user,serverId:p.data.serverId,branch:p.data.branch??null,version:conn.version,status:"pending",result:null,expiresAt:new Date(Date.now()+15*60_000).toISOString()};
  const inserted=await c.env.DB.prepare("insert into organizationRequest(id,organizationId,userId,serverId,branch,version,status,createdAt,expiresAt,requestKey) values (?1,?2,?3,?4,?5,?6,'pending',?7,?8,?9) on conflict(organizationId,userId,requestKey) do nothing returning id").bind(row.id,org,user,row.serverId,row.branch,row.version,stamp(),row.expiresAt,p.data.requestKey).first();
  if(!inserted){
    const existing=await c.env.DB.prepare("select * from organizationRequest where organizationId=?1 and userId=?2 and requestKey=?3").bind(org,user,p.data.requestKey).first<RequestRow>();
    if(!existing || existing.serverId!==row.serverId || existing.branch!==row.branch)return c.json({error:"request_key_conflict"},409);
    return c.json({request:publicRequest(existing)});
  }
  await audit(c.env.DB,org,user,"redeploy.requested",row.serverId);
  return decision==="allow" ? c.json({request:await execute(c.env,row,null)}) : c.json({request:publicRequest(row)},202);
});
organizations.get("/organizations/:org/requests",async c=>{
  const org=c.req.param("org"), user=c.get("user").id,m=await member(c.env.DB,org,user);
  if(!m)return c.json({error:"not_found"},404);
  const rows=await c.env.DB.prepare(`select * from organizationRequest where organizationId=?1 ${m.role==="member"?"and userId=?2":""} order by createdAt desc limit 100`).bind(...(m.role==="member"?[org,user]:[org])).all<RequestRow>();
  return c.json({requests:rows.results.map(publicRequest)});
});
organizations.post("/organizations/:org/requests/:request/decision",async c=>{
  const org=c.req.param("org"), me=c.get("user").id,m=await member(c.env.DB,org,me);
  if(!m || m.role==="member")return c.json({error:"forbidden"},403);
  const row=await c.env.DB.prepare("select * from organizationRequest where id=?1 and organizationId=?2").bind(c.req.param("request"),org).first<RequestRow>();
  if(!row)return c.json({error:"not_found"},404);
  if(row.userId===me)return c.json({error:"cannot_approve_own_request"},403);
  const p=z.object({approve:z.boolean()}).safeParse(await c.req.json().catch(()=>null));if(!p.success)return c.json({error:"invalid_body"},400);
  if(row.status!=="pending")return c.json({error:"already_decided"},409);
  if(!p.data.approve){await c.env.DB.prepare("update organizationRequest set status='denied',decidedBy=?2 where id=?1 and status='pending'").bind(row.id,me).run();await audit(c.env.DB,org,me,"redeploy.denied",row.serverId);return c.json({ok:true});}
  const result=await execute(c.env,row,me);return result?c.json({request:result}):c.json({error:"request_no_longer_authorized"},409);
});
organizations.get("/organizations/:org/audit",async c=>{
  const org=c.req.param("org"),m=await member(c.env.DB,org,c.get("user").id);
  if(!m || m.role==="member")return c.json({error:"forbidden"},403);
  const rows=await c.env.DB.prepare("select userId,event,resource,createdAt from organizationAudit where organizationId=?1 order by createdAt desc limit 100").bind(org).all();return c.json({events:rows.results});
});
