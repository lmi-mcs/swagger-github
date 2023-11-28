export async function GET(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  const githubPath = params.path.join('/')
  const token = process.env.GITHUB_TOKEN
  const options = token ? {
    headers: {Authorization: `Bearer ${token}`},
  } : undefined

  const res = await fetch(`https://raw.githubusercontent.com/${githubPath}`, options)
  const data = await res.blob()

  return new Response(data)
}