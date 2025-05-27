const SERVER_URL = 'http://localhost:3000'

export async function fetchAvailableScenes(): Promise<string[]> {
  const res = await fetch(`${SERVER_URL}/api/sandbox/scenes`)
  if (!res.ok) throw new Error('Failed to load scenes')
  return await res.json()
}

export async function fetchSandboxScene(id: string, config: { inventory: string[], flags: string[] }): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/sandbox/scene/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  if (!res.ok) throw new Error(`Failed to load sandbox scene ${id}`)
  return await res.json()
}