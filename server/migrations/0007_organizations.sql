-- Organization-scoped provider access. Tokens are encrypted before storage.
create table organization (
 id text primary key, name text not null, ownerId text not null references "user"(id), createdAt text not null
);
create table organizationMember (
 organizationId text not null references organization(id) on delete cascade,
 userId text not null references "user"(id) on delete cascade,
 role text not null check(role in ('owner','admin','member')),
 primary key(organizationId,userId)
);
create table organizationManufact (
 organizationId text primary key references organization(id) on delete cascade,
 externalId text not null, token text not null, version text not null
);
create table organizationResource (
 organizationId text not null references organization(id) on delete cascade,
 serverId text not null, name text not null,
 primary key(organizationId,serverId)
);
create table organizationGrant (
 organizationId text not null, userId text not null, serverId text not null,
 action text not null check(action in ('read','redeploy')),
 decision text not null check(decision in ('allow','ask','deny')),
 primary key(organizationId,userId,serverId,action),
 foreign key(organizationId,userId) references organizationMember(organizationId,userId) on delete cascade,
 foreign key(organizationId,serverId) references organizationResource(organizationId,serverId) on delete cascade
);
create table organizationRequest (
 id text primary key, organizationId text not null references organization(id) on delete cascade,
 userId text not null, serverId text not null, branch text, requestKey text not null,
 version text not null, status text not null, result text, decidedBy text,
 createdAt text not null, expiresAt text not null,
 unique(organizationId,userId,requestKey)
);
create index organizationRequest_org on organizationRequest(organizationId,createdAt);
create table organizationAudit (
 id text primary key, organizationId text not null references organization(id) on delete cascade,
 userId text not null, event text not null, resource text, createdAt text not null
);
