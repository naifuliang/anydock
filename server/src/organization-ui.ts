// Runs inside the dashboard shell; uses its existing api/esc/toast helpers.
export const ORGANIZATION_UI = String.raw`
async function organizationsView(selected) {
  setNav("organizations");
  const { organizations: orgs } = await api("GET", "/api/organizations");
  const org = orgs.find(o => o.id === selected) || orgs[0];
  view.innerHTML = head("Organizations", "Connect Manufact once. Decide who can inspect each server and who needs approval to deploy.") +
    '<div class="card orgcard"><form class="orgform" id="newOrg"><label>Organization name <input name="name" required maxlength="120"></label> <button class="btn">Create organization</button></form></div>' +
    (org ? '<div class="sec"><label>Organization <select id="orgSelect">' + orgs.map(o => '<option value="' + esc(o.id) + '" ' + (o.id === org.id ? 'selected' : '') + '>' + esc(o.name) + '</option>').join('') + '</select></label> <button class="btn sm" id="orgRefresh">Refresh</button></div><div id="orgDetail"></div>' : '<p>Create an organization to connect Manufact.</p>');
  const guard = fn => async e => { e.preventDefault(); try { await fn(e); } catch (error) { toast(error.message); } };
  $("#newOrg").onsubmit = guard(async e => { const name = new FormData(e.target).get("name"); const r = await api("POST", "/api/organizations", {name}); await organizationsView(r.organization.id); });
  if (!org) return;
  $("#orgSelect").onchange = e => organizationsView(e.target.value);
  $("#orgRefresh").onclick = () => organizationsView(org.id);
  const base = "/api/organizations/" + encodeURIComponent(org.id);
  const d = await api("GET", base);
  const {requests} = await api("GET", base + "/requests");
  const owner = d.role === "owner", manager = d.role !== "member";
  const managed = d.managedResources || d.resources;
  const me = d.members.find(m => m.email === BOOT.user.email)?.id;
  const memberName = id => d.members.find(m => m.id === id)?.email || id;
  const opts = (rows, key, label) => rows.map(r => '<option value="' + esc(r[key]) + '">' + esc(r[label]) + '</option>').join('');
  $("#orgDetail").innerHTML =
    '<div class="card orgcard"><h2>Manufact</h2><p>' + (d.connected ? 'Connected. Only the selected servers are accessible through AnyDock.' : 'Not connected. An owner can add a Manufact organization key.') + '</p>' +
    (owner ? '<form class="orgform" id="manufactConnect"><label>Manufact organization ID <input name="externalId" required></label><label>API key <input type="password" name="apiKey" required autocomplete="new-password"></label><label>Server IDs to make available <textarea name="serverIds" placeholder="One server ID per line"></textarea></label><p>Replacing this connection clears existing grants and pending approvals. Keys are encrypted and never shown to agents.</p><button class="btn solid">Connect Manufact</button></form>' + (d.connected ? '<form class="orgform" id="manufactResources"><label>Allowed server IDs <textarea name="serverIds">'+managed.map(r=>esc(r.serverId)).join('\n')+'</textarea></label><p>Saving replaces the server allowlist, clears grants and cancels pending approvals.</p><button class="btn">Save allowed servers</button><button type="button" class="btn" id="discoverServers">List available servers</button><div id="availableServers"></div></form><button id="manufactOff" class="btn sm">Disconnect Manufact</button>' : '') : '') + '</div>' +
    '<div class="sec"><h2>Members</h2></div><div class="card orgcard">' + d.members.map(m => '<p>' + esc(m.email) + ' · ' + esc(m.role) + (owner && m.role !== 'owner' ? ' <button class="btn sm" data-remove-member="' + esc(m.id) + '">Remove</button>' : '') + '</p>').join('') +
    (owner ? '<form class="orgform" id="orgMember"><label>Existing member email <input name="email" type="email" required></label><label>Role <select name="role"><option value="member">Member</option><option value="admin">Admin — can approve deployments</option></select></label><button class="btn">Add or update member</button></form>' : '') + '</div>' +
    '<div class="sec"><h2>Servers you can view</h2></div><div class="card orgcard">' + (d.resources.map(r => '<p>' + esc(r.name) + ' <button class="btn sm" data-server="' + esc(r.serverId) + '">Check status</button> <button class="btn sm" data-redeploy="' + esc(r.serverId) + '">Request redeployment</button></p>').join('') || '<p>No servers are available to you.</p>') + '</div>' +
    (owner && managed.length ? '<div class="sec"><h2>Resource permissions</h2></div><div class="card orgcard"><form class="orgform" id="orgGrant"><label>Member <select name="userId">' + opts(d.members,'id','email') + '</select></label><label>Server <select name="serverId">' + opts(managed,'serverId','name') + '</select></label><label>Action <select name="action"><option value="read">Inspect server</option><option value="redeploy">Redeploy server</option></select></label><label>Decision <select name="decision"><option value="deny">Deny</option><option value="ask">Require approval (redeploy only)</option><option value="allow">Allow</option></select></label><button class="btn">Save permission</button></form><p>Members have no access until granted. Owners and admins can inspect connected servers; their redeployments require another administrator’s approval by default.</p>' + d.grants.map(g => '<p>' + esc(memberName(g.userId)) + ' · ' + esc(g.serverId) + ' · ' + esc(g.action) + ': ' + esc(g.decision) + '</p>').join('') + '</div>' : '') +
    '<div class="sec"><h2>Deployment requests</h2></div><div class="card orgcard">' + (requests.map(r => '<p>' + esc(memberName(r.userId)) + ' · ' + esc(r.serverId) + ' · ' + esc(r.status) + (r.result ? ' · ' + esc(JSON.stringify(r.result)) : '') + (manager && r.status === 'pending' && r.userId !== me ? ' <button class="btn sm" data-decide="' + esc(r.id) + '" data-approve="1">Approve</button> <button class="btn sm" data-decide="' + esc(r.id) + '" data-approve="0">Deny</button>' : '') + '</p>').join('') || '<p>No requests.</p>') + '</div>';
  if (owner) {
    $("#manufactConnect").onsubmit = guard(async e => { const f=new FormData(e.target); const key=e.target.elements.apiKey; try { await api("PUT",base+"/manufact",{externalId:f.get("externalId"),apiKey:f.get("apiKey"),serverIds:String(f.get("serverIds")).split(/[\s,]+/).filter(Boolean)}); } finally {key.value="";} await organizationsView(org.id); });
    if ($("#manufactResources")) $("#manufactResources").onsubmit=guard(async e=>{await api("PUT",base+"/manufact/resources",{serverIds:String(new FormData(e.target).get("serverIds")).split(/[\s,]+/).filter(Boolean)});await organizationsView(org.id);});
    if ($("#discoverServers")) $("#discoverServers").onclick=guard(async()=>{const {servers}=await api("GET",base+"/manufact/resources");$("#availableServers").innerHTML=servers.map(s=>'<p>'+esc(s.name||s.slug||s.id)+' · '+esc(s.id)+' · '+esc(s.status)+'</p>').join('')||'<p>No servers.</p>';});
    if ($("#manufactOff")) $("#manufactOff").onclick=guard(async()=>{await api("DELETE",base+"/manufact");await organizationsView(org.id);});
    $("#orgMember").onsubmit=guard(async e=>{await api("PUT",base+"/members",Object.fromEntries(new FormData(e.target)));await organizationsView(org.id);});
    if ($("#orgGrant")) $("#orgGrant").onsubmit=guard(async e=>{await api("PUT",base+"/grants",Object.fromEntries(new FormData(e.target)));await organizationsView(org.id);});
    view.querySelectorAll('[data-remove-member]').forEach(b=>b.onclick=guard(async()=>{await api("DELETE",base+"/members/"+encodeURIComponent(b.dataset.removeMember));await organizationsView(org.id);}));
  }
  view.querySelectorAll('[data-server]').forEach(b=>b.onclick=guard(async()=>{const {server}=await api("GET",base+"/manufact/servers/"+encodeURIComponent(b.dataset.server));toast(server.name+": "+server.status);}));
  view.querySelectorAll('[data-redeploy]').forEach(b=>b.onclick=guard(async()=>{b.disabled=true;try{await api("POST",base+"/requests",{serverId:b.dataset.redeploy,requestKey:crypto.randomUUID()});await organizationsView(org.id);}finally{b.disabled=false;}}));
  view.querySelectorAll('[data-decide]').forEach(b=>b.onclick=guard(async()=>{await api("POST",base+"/requests/"+encodeURIComponent(b.dataset.decide)+"/decision",{approve:b.dataset.approve==='1'});await organizationsView(org.id);}));
  if(manager){const {events}=await api("GET",base+"/audit");$("#orgDetail").insertAdjacentHTML('beforeend','<div class="sec"><h2>Audit log</h2></div><div class="card orgcard">'+events.map(e=>'<p>'+esc(e.createdAt)+' · '+esc(memberName(e.userId))+' · '+esc(e.event)+(e.resource?' · '+esc(e.resource):'')+'</p>').join('')+'</div>');}
}
`;
