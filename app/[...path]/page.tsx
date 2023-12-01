'use client'

import dynamic from 'next/dynamic'
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })
import 'swagger-ui-react/swagger-ui.css'

export default function Home({ params }: { params: { path: string[] } }) {
  const githubPath = params.path.join('/')

  return (
    <main className="">
      <SwaggerUI url={`/api/github/${githubPath}`} />
    </main>
  )
}
