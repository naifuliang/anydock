// Provider contract from https://inkbox.ai/docs/api/imessage.md and /imessage/messages.md.
import assert from 'node:assert/strict';
import { sendText } from '../src/inkbox.ts';
const realFetch=globalThis.fetch;
const env={INKBOX_API_KEY:'fixture-only',INKBOX_IDENTITY_ID:'fixture-identity'};
let count=0;
try {
  globalThis.fetch=async(url,options)=>{
    count++;
    assert.equal(String(url),'https://inkbox.ai/api/v1/imessage/messages?agent_identity_id=fixture-identity');
    assert.equal(options.headers['X-API-Key'],'fixture-only');
    assert.ok(options.headers['Idempotency-Key']);
    assert.equal(options.headers.Prefer,'idempotency-replay');
    assert.deepEqual(JSON.parse(options.body),{to:'+14155550123',text:'Contract fixture'});
    return Response.json({message:{id:'fixture-message',status:'pending'}},{status:201});
  };
  const result=await sendText(env,'+14155550123','Contract fixture');
  assert.equal(result.messageId,'fixture-message');
  assert.equal(result.channel,'imessage');
  assert.match(result.detail,/delivery is not yet confirmed/);
  assert.equal(count,1);
  globalThis.fetch=async()=>{count++;return Response.json({detail:'Not found'},{status:404});};
  assert.equal((await sendText(env,'+14155550123','Contract fixture')).ok,false);
  assert.equal(count,2); // No automatic retry on a failed send.
  const fallbackEnv={...env,INKBOX_PHONE_NUMBER_ID:'fixture-number'};
  const paths=[];
  globalThis.fetch=async(url)=>{paths.push(new URL(url).pathname);return paths.length===1 ? Response.json({}, {status:404}) : Response.json({id:'sms-fixture'}, {status:201});};
  assert.equal((await sendText(fallbackEnv,'+14155550123','Contract fixture')).channel,'sms');
  assert.deepEqual(paths,['/api/v1/imessage/messages','/api/v1/phone/numbers/fixture-number/texts']);
  console.log('PASS Inkbox real API path, auth, idempotency and acceptance semantics');
} finally {globalThis.fetch=realFetch;}
