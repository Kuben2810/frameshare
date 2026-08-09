export function getClientId(): string {
  let id = localStorage.getItem("frameshare_client_id")
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("frameshare_client_id", id) }
  return id
}
