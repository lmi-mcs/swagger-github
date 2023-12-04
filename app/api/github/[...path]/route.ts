import { load, dump } from 'js-yaml'

/**
 * 基本的には raw.githubusercontent.com へのアクセスをプロキシしているだけ. 次の２目的の為にしてる.
 * 1. GitHub の Private Repository にアクセスする為には認証が必要. Server-Side に認証を隠す.
 * 2. "$ref" 参照を全て解決 (展開) して、一つのファイル (text) として SwaggerUI でレンダリングしたいケース.
 *
 * @param request https://developer.mozilla.org/ja/docs/Web/API/Request
 * @param param1 "/api/github/{path}" の path に当たる部分の文字列.
 * @returns https://developer.mozilla.org/ja/docs/Web/API/Response
 */
export async function GET(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  const githubPath = params.path.join('/')
  const options = httpClientOptions()

  const url = new URL(githubPath, 'https://raw.githubusercontent.com')
  const res = await fetch(url, options)

  const status = res.status
  if (res.status < 200 || res.status >= 400) {
    throw new Error(`status: ${res.status}, url: ${url.toString()}`)
  }

  const contentType = res.headers.get('Content-Type')
  const headers = contentType ? {
    'Content-Type': contentType,
  } : undefined

  // 環境変数 "RESOLVE_ALL_REFS" が "true" の場合にのみ、"$ref" の展開 (一括返還) を行う.
  const data = (process.env.RESOLVE_ALL_REFS !== 'true')
    ? await res.blob() 
    : await resolveAllRefs(await res.text(), url.toString())

  return new Response(
    data,
    {
      status: res.status,
      headers: headers,
    },
  )
}

/**
 * @returns GitHub の Raw URL にアクセスする際に必要な認証オプション.
 */
function httpClientOptions(): Object | undefined {
  const token = process.env.GITHUB_TOKEN
  const options = token ? {
    headers: { Authorization: `Bearer ${token}` },
  } : undefined

  return options
}

/**
 * "$ref" で分割された OpenAPI 3.0 spec text を統合して、一つのファイル (text) として返す.
 *
 * @param text OpenAPI 3.0 spec text. (.json / .yaml / .yml)
 * @param rootUrl ↑spec の GitHub Raw URL. ("$ref" が相対パスの場合に絶対URLを特定するのに使う)
 * @returns 全ての "$ref" を統合した、OpenAPI 3.0 spec text. (.json / .yaml / .yml)
 */
async function resolveAllRefs(text: string, rootUrl: string): Promise<string> {
  const serializer: {[ext: string]: [(s: string) => any, (o: object) => string]} = {
    'json': [JSON.parse, JSON.stringify],
    'yaml': [load, dump],
    'yml': [load, dump],
  }

  // identify extension. (json / yaml / yml)
  const ext = rootUrl.split('.').pop()
  if (!ext || !(ext in serializer)) {
    throw new Error(`Invalid extension. url: ${rootUrl.toString()}`)
  }

  // chooose parser.
  const [parse, dumps] = serializer[ext]
  const obj = parse(text)

  // call recursively.
  // 引数の Object tree `obj` を副作用で直接書き換えている.
  await resolveRefsRecursively(obj, rootUrl, parse)

  return dumps(obj)
}

/**
 * JavaScript Object (=OpenAPI Spec 3.0) 中の全ての "$ref" 参照を取得し、展開する. 再帰的に網羅する.
 * ※ この関数は副作用を持つ破壊的関数です. 第一引数の `obj` を直接書き換えます.
 *
 * @param obj 捜査する Object. (再帰)
 * @param rootUrl ↑obj の GitHub Raw URL. ("$ref" が相対パスの場合に絶対URLを特定するのに使う)
 * @param parse Parser function for JSON / YAML.
 * @param [depth=0] 再帰の深さ. 無限ループにならないようにする為に制限を設ける.
 */
async function resolveRefsRecursively(
  obj: any, 
  rootUrl: string, 
  parse: (s: string) => any, 
  depth = 0,
) {
  // Object の key になっている "$ref" しか解決しない.
  if (typeof obj !== 'object') {
    return
  }

  // 多分無限ループになっているので、制限を設ける.
  const limit = parseInt(process.env.RESOLVE_ALL_REFS_DEPTH_LIMIT ?? "30")
  if (depth > limit) {
    throw new Error(`Too deep. depth: ${depth}`)
  }

  // Object の key の捜査. (loop)
  for (const key in obj) {
    // "$ref" じゃない要素は、次 (子供) の再帰呼び出しへ.
    if (key !== '$ref') {
      await resolveRefsRecursively(obj[key], rootUrl, parse, depth + 1)
      continue
    }

    const url = obj[key].startsWith('http')
      ? new URL(obj[key])
      : new URL(obj[key], rootUrl)

    // URL が hash を参照している場合は展開しない. 無限ループになってしまう.
    if (url.toString().includes('#')) {
      // サーバールートからの絶対パス URL に直す.
      obj[key] = `/api/github/${url.pathname}${url.search}${url.hash}`
      return
    }

    const options = httpClientOptions()
    const res = await fetch(url, options)

    if (res.status < 200 || res.status >= 400) {
      throw new Error(`status: ${res.status}, url: ${url.toString()}`)
    }

    // remove all keys.
    Object.keys(obj).forEach(key => delete obj[key])

    // add new ones.
    const part = parse(await res.text())
    Object.assign(obj, part)

    // obj を更新したので、再度同じ obj を捜査する.
    await resolveRefsRecursively(obj, url.toString(), parse, depth)
  }
}