# Frameshare

Frameshare is a client proofing and delivery workspace for independent
photographers. It keeps studio-facing workflow separate from the location
where gallery media is stored.

## Language

**Workspace**:
The photographer's studio account, which owns galleries, members, brand
settings, storage entitlement, and storage connections.
_Avoid_: Account, tenant

**Storage Connection**:
The configured, health-checked location where a workspace keeps its gallery
objects. It may be Frameshare-managed storage or a photographer-controlled
provider.
_Avoid_: Storage account, bucket

**Storage Entitlement**:
The storage capacity and product access granted to a workspace by its current
plan; it is not reserved capacity purchased from a provider.
_Avoid_: Allocation, reservation

**Gallery Storage Assignment**:
The storage connection selected when a gallery is created. It remains fixed
until the photographer explicitly migrates that gallery.
_Avoid_: Default storage, inherited provider

**Managed Storage**:
Frameshare-operated private object storage included in a Frameshare plan.
_Avoid_: Cloudflare storage, R2 plan

**BYO Storage**:
Photographer-controlled object storage connected to Frameshare while the
Frameshare application remains hosted by Frameshare.
_Avoid_: Self-hosted Frameshare, external gallery
