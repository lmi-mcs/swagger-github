'use client'
/* eslint-disable react/jsx-no-comment-textnodes */

import React, {useState, useEffect} from 'react'

export default function Home() {
  // identify sample url.
  const [url, setUrl] = useState('')
  useEffect(() => {
    setUrl(`${window.location.protocol}//${window.location.host}/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml`)
  }, [])

  return (
    <main className="">
      <div>
        <a href={url}>
          {url}
        </a>
      </div>

      <div>
        <small><a href="https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml">
          https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml
        </a></small>
      </div>
    </main>
  )
}
