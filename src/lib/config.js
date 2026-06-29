export const CONTRACT_ADDR = '0x7C3396749E59BE3cC246a8e157a7bed29BE155E1'
export const EXPLORER     = 'https://explorer-bradbury.genlayer.com'
export const FAUCET       = 'https://testnet-faucet.genlayer.foundation'
export const sh           = a => a?.length>10 ? a.slice(0,6)+'...'+a.slice(-4) : (a||'')

export const LEVELS = {
  '1': { name:'Rookie',    color:'#10B981', topic:'Basic Web3 Safety',         xpReward:100, passScore:4 },
  '2': { name:'Operative', color:'#06B6D4', topic:'Wallets & Keys',            xpReward:150, passScore:4 },
  '3': { name:'Analyst',   color:'#6366F1', topic:'DeFi & Rug Pulls',          xpReward:200, passScore:4 },
  '4': { name:'Auditor',   color:'#8B5CF6', topic:'Smart Contract Vulns',      xpReward:250, passScore:4 },
  '5': { name:'Elite',     color:'#F59E0B', topic:'Advanced Exploits',         xpReward:300, passScore:4 },
  '6': { name:'Phantom',   color:'#EC4899', topic:'Zero-day & Side-channels',  xpReward:400, passScore:4 },
  '7': { name:'Ghost',     color:'#14B8A6', topic:'Social Engineering & OSINT',xpReward:500, passScore:4 },
  '8': { name:'Shadow',    color:'#EF4444', topic:'Nation-state & APT Attacks', xpReward:750, passScore:5 },
}

export const LEVEL_XP_THRESHOLD = {
  '1': 0, '2': 500, '3': 1200, '4': 2200, '5': 3700,
  '6': 5700, '7': 8500, '8': 12500
}
