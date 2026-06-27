// GenLayer Bradbury — GenHunt blockchain layer

export const CHAIN_ID = '0x107D'
export const NET = {
  chainId: CHAIN_ID, chainName: 'GenLayer Bradbury',
  rpcUrls: ['https://rpc-bradbury.genlayer.com'],
  nativeCurrency: { name:'GEN', symbol:'GEN', decimals:18 },
  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
}
const RPC  = '/api/rpc'
const CONS = '0x0112Bf6e83497965A5fdD6Dad1E447a6E004271D'

// ── GL Encoding ───────────────────────────────────────────────────────────
const _T = { SPECIAL:0, PINT:1, NINT:2, BYTES:3, STR:4, ARR:5, MAP:6 }
const _S = { NULL:0, FALSE:8, TRUE:16 }

function _writeNum(to, data) {
  if (data === 0n) { to.push(0); return }
  while (data > 0n) {
    let cur = Number(data & 0x7fn)
    data >>= 7n
    if (data > 0n) cur |= 128
    to.push(cur)
  }
}
function _encodeImpl(to, data) {
  if (data === null || data === undefined) { to.push(_S.NULL); return }
  if (typeof data === 'boolean') { to.push(data ? _S.TRUE : _S.FALSE); return }
  if (typeof data === 'number' || typeof data === 'bigint') {
    const n = BigInt(data)
    if (n >= 0n) { _writeNum(to, (n << 3n) | BigInt(_T.PINT)) }
    else         { _writeNum(to, ((-n - 1n) << 3n) | BigInt(_T.NINT)) }
    return
  }
  if (typeof data === 'string') {
    const b = new TextEncoder().encode(data)
    _writeNum(to, (BigInt(b.length) << 3n) | BigInt(_T.STR))
    for (const byte of b) to.push(byte)
    return
  }
  if (Array.isArray(data)) {
    _writeNum(to, (BigInt(data.length) << 3n) | BigInt(_T.ARR))
    for (const item of data) _encodeImpl(to, item)
    return
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data).sort(([a],[b]) => a<b?-1:a>b?1:0)
    _writeNum(to, (BigInt(entries.length) << 3n) | BigInt(_T.MAP))
    for (const [k,v] of entries) {
      const kb = new TextEncoder().encode(k)
      _writeNum(to, BigInt(kb.length))
      for (const b of kb) to.push(b)
      _encodeImpl(to, v)
    }
  }
}
function _glEncode(data) {
  const arr = []
  _encodeImpl(arr, data)
  return new Uint8Array(arr)
}
function _rlpBytes(data) {
  if (data.length === 1 && data[0] < 128) return data
  const len = data.length
  if (len <= 55) return new Uint8Array([0x80+len, ...data])
  const lenBytes = []
  let l = len
  while (l > 0) { lenBytes.unshift(l & 0xff); l >>= 8 }
  return new Uint8Array([0xb7+lenBytes.length, ...lenBytes, ...data])
}
function _rlpList(items) {
  const encoded = []
  for (const item of items) for (const b of _rlpBytes(item)) encoded.push(b)
  const len = encoded.length
  let header
  if (len <= 55) header = [0xc0+len]
  else {
    const lb = []
    let l = len
    while (l > 0) { lb.unshift(l & 0xff); l >>= 8 }
    header = [0xf7+lb.length, ...lb]
  }
  return new Uint8Array([...header, ...encoded])
}
function encodeCalldataMsgpack(method, args=[], leaderOnly=false) {
  const obj = {}
  if (method) obj.method = method
  if (args?.length) obj.args = args
  const encoded    = _glEncode(obj)
  const leaderByte = new Uint8Array([leaderOnly ? 1 : 0])
  const rlp        = _rlpList([encoded, leaderByte])
  return '0x' + Array.from(rlp).map(b=>b.toString(16).padStart(2,'0')).join('')
}

// ── GL Decode ─────────────────────────────────────────────────────────────
function glDecode(hexStr) {
  const hex   = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr
  if (!hex) return null
  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b=>parseInt(b,16)))
  const idx   = {i:0}
  function uleb() {
    let res=0n,acc=0n,go=true
    while(go){const b=bytes[idx.i++];res+=BigInt(b&127)*(1n<<acc);acc+=7n;go=b>=128}
    return res
  }
  function dec() {
    const cur=uleb()
    if(cur===0n)return null
    if(cur===16n)return true
    if(cur===8n)return false
    const type=Number(cur&7n),rest=cur>>3n
    if(type===4){const n=Number(rest),r=bytes.slice(idx.i,idx.i+n);idx.i+=n;return new TextDecoder().decode(r)}
    if(type===1)return Number(rest)
    if(type===2)return -1-Number(rest)
    if(type===3){const n=Number(rest),r=bytes.slice(idx.i,idx.i+n);idx.i+=n;return r}
    if(type===5){const r=[];let e=Number(rest);while(e-->0)r.push(dec());return r}
    if(type===6){const r={};let e=Number(rest);while(e-->0){const kl=Number(uleb()),kb=bytes.slice(idx.i,idx.i+kl);idx.i+=kl;r[new TextDecoder().decode(kb)]=dec()}return r}
    throw new Error('unknown gl type '+type)
  }
  const res=dec()
  if(typeof res==='string') return res
  if(res===null||res===undefined) return null
  return JSON.stringify(res)
}

// ── Network switch ────────────────────────────────────────────────────────
export async function switchToBradbury() {
  try {
    await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN_ID}]})
  } catch(e) {
    if (e.code===4902||e.code===-32603)
      await window.ethereum.request({method:'wallet_addEthereumChain',params:[NET]})
    else throw e
  }
}

// ── Read ──────────────────────────────────────────────────────────────────
const _cache = new Map()
const _TTL   = 30_000

export async function readContract(addr, method, args=[], useCache=false) {
  const key = `${addr}:${method}:${JSON.stringify(args)}`
  if (useCache) {
    const c = _cache.get(key)
    if (c && Date.now()-c.ts < _TTL) return c.val
  }
  const from = window._ghAccount || '0x0000000000000000000000000000000000000000'
  const data = encodeCalldataMsgpack(method, args, false)
  const r = await fetch(RPC, {
    method:'POST', mode:'cors', credentials:'omit',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:'gen_call',
      params:[{type:'read',from,to:addr,data,transaction_hash_variant:'latest-nonfinal'}]})
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  const result = d.result
  if (!result) return null
  const hex = typeof result==='string' ? result : result.data
  if (!hex) return null
  const val = glDecode(hex)
  if (useCache) _cache.set(key, {val, ts:Date.now()})
  return val
}

// ── Write ─────────────────────────────────────────────────────────────────
export async function writeContract(addr, account, method, args=[], valueWei=0n, leaderOnly=true) {
  await switchToBradbury()
  const cd  = encodeCalldataMsgpack(method, args, leaderOnly)
  const hex = cd.startsWith('0x') ? cd.slice(2) : cd
  const pad  = v => v.toString(16).padStart(64,'0')
  const padA = a => a.toLowerCase().replace('0x','').padStart(64,'0')
  const data = '0xe71d5196'
    + padA(account) + padA(addr)
    + pad(1) + pad(3) + pad(192)
    + pad(Math.floor(Date.now()/1000)+3600)
    + pad(hex.length/2)
    + hex.padEnd(Math.ceil(hex.length/64)*64,'0')
  const params = {from:account,to:CONS,data,gas:'0x7A120'}
  if (valueWei && BigInt(valueWei)>0n) params.value = '0x'+BigInt(valueWei).toString(16)
  return window.ethereum.request({method:'eth_sendTransaction',params:[params]})
}

// ── Wait for tx ───────────────────────────────────────────────────────────
export async function waitTx(hash, onSlow, tries=120) {
  for (let i=0; i<tries; i++) {
    await new Promise(r=>setTimeout(r,3000))
    if (i===10 && onSlow) onSlow()
    try {
      const res = await fetch(RPC,{method:'POST',mode:'cors',credentials:'omit',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:1,method:'gen_getTransactionStatus',params:[hash]})})
      const d = await res.json()
      const st = (d.result||'').toUpperCase()
      if (st==='ACCEPTED'||st==='FINALIZED') return st
      if (st==='CANCELED'||st==='UNDETERMINED') throw new Error('Transaction '+st)
    } catch(e) {
      if ((e.message||'').match(/CANCELED|UNDETERMINED/)) throw e
    }
  }
  throw new Error('Transaction timeout')
}
