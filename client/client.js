import { createServer as createTcpServer } from 'node:net'
import { createServer as createHttpServer } from 'node:http'
import { Duplex } from 'node:stream'
import { WebSocketServer } from 'ws'
import HttpHeaders from 'http-headers'

import * as utils from './utils.js'

function generate_config() {
    const cfg = {
        ['UUID']: '8ad358ba-093a-4c40-8795-a269e795297d',
        ['SERVER_URL']: 'http://127.0.0.1:3001/',

        // 映射到公网后的 websocket relay 网址
        // 例：https://ws-relay.your-website.test/
        ['WS_RELAY_PUBLIC_URL']: 'ws://127.0.0.1:3002/',

        // 本地 websocket relay 地址
        ['WS_RELAY_LOCAL_URL']: 'http://127.0.0.1:3002/',

        // 本地 http 代理地址
        ['HTTP_PROXY_URL']: 'http://127.0.0.1:3000/',
        ['LOG_LEVEL']: 'debug',
    }
    for (const key in cfg) {
        const v = process.env[key]
        if (v) {
            cfg[key] = v
        }
    }
    return cfg
}

const clients = {}
function create_client(id, socket) {
    const conn = Duplex.toWeb(socket)
    const client = {
        readable: conn.readable,
        writable: conn.writable,
        socket,
    }
    clients[id] = client
    return client
}

function pick_up_client(id) {
    const c = clients[id]
    if (c) {
        delete clients[id]
    }
    return c
}

function handle_ws_request(cfg, websocket, client_id) {
    const log = utils.create_logger(cfg.LOG_LEVEL)

    log.debug('accept websocket connection')
    const client = pick_up_client(client_id)
    if (!client) {
        log.debug(`non-existent client ID: ${utils.shorten(client_id)}`)
        return false
    }

    log.debug(`pick up client with ID: ${utils.shorten(client_id)}`)
    const tcp_reader = client.readable.getReader()
    const tcp_writer = client.writable.getWriter()

    let reading = true
    let writing = true
    let closed = false
    function close_socket() {
        if (closed || reading || writing) {
            return
        }
        closed = true
        log.info(`close websocket`)
        try {
            websocket.close()
        } catch (err) {
            log.error(`close websocket error: ${err.message}`)
        }
        try {
            client.socket.end()
        } catch (err) {
            log.debug(`close client error: ${err.message}`)
        }
    }

    websocket.on('message', async (data) => {
        try {
            await tcp_writer.write(data)
        } catch (err) {
            if (err.message !== 'The operation was aborted') {
                log.error(`download error: ${err.message}`)
            }
            writing = false
            close_socket()
        }
    })

    websocket.on('close', () => {
        reading = false
        writing = false
        close_socket()
    })

    async function upload() {
        if (client.head) {
            log.debug(`send headers`)
            websocket.send(client.head)
        }

        while (true) {
            const r = await tcp_reader.read()
            if (r.value) {
                websocket.send(r.value)
            }
            if (r.done) {
                break
            }
        }
        tcp_reader.releaseLock()
        reading = false
        close_socket()
    }

    upload().catch((err) => log.error(`upload error: ${err.message}`))
    return true
}

function create_headers(cfg, host, client_id) {
    const headers = new Headers({
        ['UUID']: cfg.UUID,
        ['Dest']: host,
        ['Source']: `${cfg.WS_RELAY_PUBLIC_URL}?id=${client_id}`,
    })
    return headers
}

async function handle_tcp_socket(cfg, id, client) {
    const log = utils.create_logger(cfg.LOG_LEVEL)

    const reader = client.readable.getReader()
    const r = await reader.read()
    reader.releaseLock()
    if (!r || !r.value) {
        return false
    }
    const head = r.value

    const s = new TextDecoder().decode(head)
    const client_req = HttpHeaders(s)
    const method = client_req.method
    log.debug(`client request method: ${method}`)
    if (method !== 'CONNECT') {
        client['head'] = head
    }
    const host = client_req.headers.host
    const headers = create_headers(cfg, host, id)
    const resp = await fetch(cfg.SERVER_URL, {
        method: 'GET',
        headers,
    })

    log.debug(`server response: ${resp.status} ${resp.statusText}`)
    if (resp.status === 200) {
        if (method === 'CONNECT') {
            client.socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        }
        return true
    }
    return false
}

function try_close_tcp(log, socket) {
    log.debug(`close tcp socket`)
    try {
        socket.write('HTTP/1.1 400 Bad request\r\n\r\n')
        socket.end()
    } catch (err) {
        log.error(`close client error: ${err.message}`)
    }
}

function create_proxy_server(cfg, log) {
    const tcpServer = createTcpServer(async (socket) => {
        const id = utils.gen_uuid_v4()
        try {
            log.debug(`create client: ${utils.shorten(id)}`)
            const client = create_client(id, socket)
            const ok = await handle_tcp_socket(cfg, id, client)
            if (ok) {
                return
            }
        } catch (err) {
            log.error(`handle tcp socket error: ${err.message}`)
        }
        pick_up_client(id)
        try_close_tcp(log, socket)
    })

    const { hostname, port } = new URL(cfg.HTTP_PROXY_URL)
    tcpServer.listen({ hostname, port }, () => {
        log.info(`http proxy server: [${hostname}]:${port}`)
    })
}

function create_ws_relay_server(cfg, log) {
    const httpServer = createHttpServer((_, resp) => {
        resp.writeHead(200, 'Ok')
        resp.write(`Hello World!`)
        resp.end()
    })

    const wsServer = new WebSocketServer({ noServer: true })
    wsServer.on('connection', async (websocket, req) => {
        try {
            const url = new URL(`http://base.url${req.url}`)
            const client_id = url.searchParams.get('id')
            if (client_id) {
                handle_ws_request(cfg, websocket, client_id)
                return
            } else {
                log.error(`unknown request: ${req.url}`)
            }
        } catch (err) {
            log.error(`handle http error: ${err.message}`)
        }
    })

    httpServer.on('upgrade', function upgrade(request, socket, head) {
        wsServer.handleUpgrade(request, socket, head, function done(ws) {
            wsServer.emit('connection', ws, request)
        })
    })

    const { hostname, port } = new URL(cfg.WS_RELAY_LOCAL_URL)
    httpServer.listen({ hostname, port }, () => {
        log.info(`websocket relay: [${hostname}]:${port}`)
    })
}

function main() {
    const cfg = generate_config()
    const log = utils.create_logger(cfg.LOG_LEVEL, 'client')
    create_proxy_server(cfg, log)
    create_ws_relay_server(cfg, log)
}

main()
