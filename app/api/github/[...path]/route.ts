export async function GET(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  const githubPath = params.path.join('/')
  const res = await fetch(`https://raw.githubusercontent.com/${githubPath}`, {
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
    },
  })
  const data = await res.blob()
 
  return new Response(data)
}