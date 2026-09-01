# Gallery storage assignments are explicit and immutable by default

Frameshare will model a workspace's storage connections separately from its
storage entitlement, and each gallery will record the connection selected at
creation. This prevents a later workspace default change from silently moving
or orphaning gallery media; changing an existing gallery's provider will be an
explicit migration workflow.
