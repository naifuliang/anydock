-- 0007 was applied before retry keys were added to the connector.
-- Existing rows may remain null; new requests always supply a UUID.
alter table organizationRequest add column requestKey text;
create unique index organizationRequest_retry on organizationRequest(organizationId,userId,requestKey);
