export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    
    // 删除压缩头，防止浏览器二次解码报错
    newHeaders.delete('Content-Encoding');
    newHeaders.delete('Content-Length');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
    
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 500 });
  }
}
