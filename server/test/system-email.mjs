import assert from 'node:assert/strict';
import { sendEmail } from '../src/email.ts';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s==='cloudflare:workers')return {url:'data:text/javascript,export class DurableObject {}',shortCircuit:true};return next(s,c);}});
const {delegate}=await import('../src/delegate.ts');
const input={to:'owner@example.test',subject:'Fixture system email',text:'Fixture code is 000000.'};
const delivered=[];
await sendEmail({BETTER_AUTH_URL:'https://anydock.ai',EMAIL:{send:async m=>{delivered.push(m);return {messageId:'fixture'};}},PRIMITIVE_API_KEY:'must-not-be-used'},input);
assert.deepEqual(delivered,[{from:{email:'login@anydock.ai',name:'AnyDock'},to:input.to,subject:input.subject,text:input.text}]);
await assert.rejects(()=>sendEmail({BETTER_AUTH_URL:'https://anydock.ai',PRIMITIVE_API_KEY:'must-not-be-used'},input),/not configured/);
const sql=new DatabaseSync(':memory:');
sql.exec('create table "user"(id text primary key,email text,name text);');
sql.exec("insert into user values ('owner','owner@example.test','Owner');");
sql.exec(readFileSync(new URL('../migrations/0005_delegate.sql',import.meta.url),'utf8'));
const DB={prepare(q){const stmt=sql.prepare(q);let args=[];return {bind(...v){args=v;return this;},async first(){return stmt.get(...args)??null;},async all(){return {results:stmt.all(...args)};},async run(){return {meta:stmt.run(...args)};}};}};
const app=new Hono();app.use('*',async(c,n)=>{c.set('session',{user:{id:'owner',email:'owner@example.test',name:'Owner'}});await n();});app.route('/api',delegate);
const previousFetch=globalThis.fetch;let outbound=0;
globalThis.fetch=async()=>{outbound++;throw new Error('Unexpected external communication');};
try {
  const response=await app.request('https://anydock.ai/api/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'email',payload:{to:'teammate@example.test',subject:'Fixture',body:'Fixture only'}})},{DB,BETTER_AUTH_URL:'https://anydock.ai',EMAIL:{send:async()=>{outbound++;}},PRIMITIVE_API_KEY:'must-not-be-used',HUB:{idFromName:id=>id,get:()=>({fetch:async()=>new Response()})}});
  const action=(await response.json()).action;
  assert.equal(action.status,'failed');assert.match(action.result.detail,/Connect Gmail or Outlook/);assert.equal(outbound,0);
} finally {globalThis.fetch=previousFetch;sql.close();}
console.log('PASS system email uses Cloudflare own-domain binding; missing binding fails closed; agent action cannot borrow platform sender or Primitive');
