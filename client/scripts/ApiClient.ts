const SERVER_URL = 'http://localhost:3000'

export async function fetchScene(sceneId: string, authToken?: string): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/scene/${sceneId}`, {
    method: 'GET',
    headers: {
      'Authorization': authToken ?? ''
    }
  })

  if (!res.ok) {
    throw new Error(`Errore nel caricamento scena ${sceneId}`)
  }

  return await res.json()
}