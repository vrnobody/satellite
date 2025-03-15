export function shorten(long_id) {
    return (long_id || '').substring(0, 8)
}

// used by create_logger()
function random_num(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

export function create_logger(log_level, tag) {
    const inner_id = tag || random_num(100000, 999999)
    const inner_time_drift = 8 * 60 * 60 * 1000

    log_level = log_level ? `${log_level}` : 'none'
    const levels = ['debug', 'info', 'error', 'none']
    const inner_level = levels.indexOf(log_level.toLowerCase())

    function inner_log(prefix, ...args) {
        const now = new Date(Date.now() + inner_time_drift).toISOString()
        console.log(now, prefix, `(${inner_id})`, ...args)
    }

    return {
        debug(...args) {
            if (inner_level < 1) {
                inner_log(`[debug]`, ...args)
            }
        },

        info(...args) {
            if (inner_level < 2) {
                inner_log(`[infor]`, ...args)
            }
        },

        error(...args) {
            if (inner_level < 3) {
                const idx = args.join(' ').indexOf('Stream was cancelled.')
                if (idx < 0) {
                    inner_log(`[error]`, ...args)
                }
            }
        },
    }
}

// https://stackoverflow.com/questions/105034/how-do-i-create-a-guid-uuid
export function gen_uuid_v4() {
    const h = '0123456789abcdef'
    const k = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    let u = ''
    let i = 0
    let rb = (Math.random() * 0xffffffff) | 0
    while (i++ < 36) {
        const c = k[i - 1]
        const r = rb & 0xf
        const v = c == 'x' ? r : (r & 0x3) | 0x8
        u += c == '-' || c == '4' ? c : h[v]
        rb = i % 8 == 0 ? (Math.random() * 0xffffffff) | 0 : rb >> 4
    }
    return u
}
