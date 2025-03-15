const UUID = '8ad358ba-093a-4c40-8795-a269e795297d'

function logger() {
    const inner_id = Math.floor(Math.random() * (99999 - 10000 + 1)) + 100000

    function log(prefix, ...args) {
        const now = new Date().toISOString()
        console.log(now, prefix, `(${inner_id})`, ...args)
    }

    return {
        debug(...args) {
            log(`[debug]`, ...args)
        },

        info(...args) {
            log(`[info]`, ...args)
        },

        error(...args) {
            log(`[error]`, ...args)
        },
    }
}

async function handle_get_request(log, request) {
    const dest_host = request.headers.get('Dest')
    const { hostname, port: raw_port } = new URL(`http://${dest_host}`)
    const port = raw_port || 80
    log.info(`dest: [${hostname}]:${port}`)
    const dest = await Deno.connect({ hostname, port })

    const src_url = request.headers.get('Source')
    log.info(`source: ${src_url}`)
    const socket = new WebSocket(src_url)

    let reading = true
    let writing = true
    let closed = false
    function close_socket() {
        if (closed || reading || writing) {
            return
        }
        closed = true
        try {
            socket.close()
        } catch (err) {
            log.error(`close socket error: ${err.message}`)
        }
    }

    socket.addEventListener('open', async () => {
        try {
            while (true) {
                const b = new Uint8Array(4 * 1024)
                const r = await dest.read(b)
                if (r === null) {
                    break
                }
                socket.send(b.slice(0, r))
            }
        } catch {
            reading = false
            close_socket()
        }
    })

    socket.addEventListener('message', async (event) => {
        const data = await event.data.bytes()
        try {
            await dest.write(data)
        } catch {
            writing = false
            close_socket()
        }
    })

    socket.addEventListener('closed', () => {
        reading = false
        writing = false
        close_socket()
    })
}

async function fetch(request) {
    const log = logger()
    try {
        if (request.headers.get('UUID') === UUID) {
            await handle_get_request(log, request)
            return new Response(null, {
                status: 200,
                statusText: 'Ok',
            })
        }
    } catch (err) {
        log.error(`fetch error: ${err.message}`)
    }
    return new Response('Hello World!')
}

// need to rewrite this function according to specific platform
function main() {
    Deno.serve({ port: 3001, hostname: '127.0.0.1' }, async (req) => {
        return await fetch(req)
    })
}

main()
