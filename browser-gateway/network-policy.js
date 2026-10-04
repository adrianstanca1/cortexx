import dns from 'node:dns/promises'
import http from 'node:http'
import net from 'node:net'

const blockList = new net.BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) blockList.addSubnet(network, prefix, 'ipv4')

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
]) blockList.addSubnet(network, prefix, 'ipv6')

function stripBrackets(value) {
  return String(value || '').trim().replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
}

function mappedIpv4(value) {
  const host = stripBrackets(value)
  if (!host.startsWith('::ffff:')) return null
  const tail = host.slice(7)
  if (net.isIP(tail) === 4) return tail
  const parts = tail.split(':')
  if (parts.length !== 2 || parts.some(part => !/^[0-9a-f]{1,4}$/i.test(part))) return null
  const hi = Number.parseInt(parts[0], 16)
  const lo = Number.parseInt(parts[1], 16)
  return [
    (hi >> 8) & 255,
    hi & 255,
    (lo >> 8) & 255,
    lo & 255,
  ].join('.')
}

export function isPrivateIp(value) {
  const host = stripBrackets(value)
  const mapped = mappedIpv4(host)
  if (mapped) return blockList.check(mapped, 'ipv4')
  const family = net.isIP(host)
  if (family === 4) return blockList.check(host, 'ipv4')
  if (family === 6) return blockList.check(host, 'ipv6')
  return false
}

export function isPrivateName(value) {
  const host = stripBrackets(value)
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    ['app', 'db', 'redis', 'ollama', 'browser-gateway'].includes(host) ||
    isPrivateIp(host)
  )
}

export async function resolvePublicEndpoint(hostname, port) {
  const host = stripBrackets(hostname)
  if (!host || isPrivateName(host)) throw new Error('Private-network destination is blocked')
  if (![80, 443].includes(Number(port))) throw new Error('Only ports 80 and 443 are allowed')

  const addresses = await dns.lookup(host, { all: true, verbatim: true })
  if (!addresses.length) throw new Error('Destination did not resolve')
  if (addresses.some(item => isPrivateIp(item.address))) {
    throw new Error('Private-network destination is blocked')
  }
  const chosen = addresses[0]
  return { host, address: chosen.address, family: chosen.family, port: Number(port) }
}

export async function assertPublicUrl(raw) {
  let target
  try {
    target = new URL(String(raw || ''))
  } catch {
    throw new Error('Invalid URL')
  }
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only http(s) navigation is allowed')
  const port = target.port ? Number(target.port) : target.protocol === 'https:' ? 443 : 80
  await resolvePublicEndpoint(target.hostname, port)
  return target.toString()
}

function cleanProxyHeaders(headers, host) {
  const next = { ...headers, host }
  delete next['proxy-authorization']
  delete next['proxy-connection']
  delete next.connection
  return next
}

export function createEgressProxy() {
  const proxy = http.createServer(async (req, res) => {
    try {
      const target = new URL(String(req.url || ''))
      if (target.protocol !== 'http:') throw new Error('HTTP proxy only accepts http URLs')
      const port = target.port ? Number(target.port) : 80
      const endpoint = await resolvePublicEndpoint(target.hostname, port)
      const upstream = http.request({
        host: endpoint.address,
        port: endpoint.port,
        family: endpoint.family,
        method: req.method,
        path: target.pathname + target.search,
        headers: cleanProxyHeaders(req.headers, target.host),
      }, upstreamRes => {
        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
        upstreamRes.pipe(res)
      })
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502)
        res.end()
      })
      req.pipe(upstream)
    } catch {
      res.writeHead(403, { 'content-type': 'text/plain' })
      res.end('Blocked by Cortexx egress policy')
    }
  })

  proxy.on('connect', async (req, clientSocket, head) => {
    let upstream
    try {
      const authority = new URL('http://' + String(req.url || ''))
      const port = authority.port ? Number(authority.port) : 443
      if (port !== 443) throw new Error('CONNECT is limited to 443')
      const endpoint = await resolvePublicEndpoint(authority.hostname, port)
      upstream = net.connect({ host: endpoint.address, port, family: endpoint.family })
      upstream.once('connect', () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head?.length) upstream.write(head)
        upstream.pipe(clientSocket)
        clientSocket.pipe(upstream)
      })
      upstream.once('error', () => clientSocket.destroy())
      clientSocket.once('error', () => upstream?.destroy())
    } catch {
      clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
      upstream?.destroy()
    }
  })

  return proxy
}
