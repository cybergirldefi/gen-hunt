export const CONTRACT_ADDR = '0x76fd7c04596E40a7a97782A907ef2c129727eAa5'
export const EXPLORER     = 'https://explorer-bradbury.genlayer.com'
export const FAUCET       = 'https://testnet-faucet.genlayer.foundation'
export const sh           = a => a?.length>10 ? a.slice(0,6)+'...'+a.slice(-4) : (a||'')

export const LEVELS = {
  '1': { name:'Rookie',    color:'#10B981', topic:'Basic Web3 Safety',      xpReward:100, passScore:7 },
  '2': { name:'Operative', color:'#06B6D4', topic:'Wallets & Keys',          xpReward:200, passScore:7 },
  '3': { name:'Analyst',   color:'#F59E0B', topic:'DeFi & Rug Pulls',        xpReward:300, passScore:7 },
  '4': { name:'Auditor',   color:'#8B5CF6', topic:'Smart Contract Vulns',    xpReward:400, passScore:8 },
  '5': { name:'Elite',     color:'#EF4444', topic:'Advanced Exploits',       xpReward:500, passScore:9 },
}

export const LEVEL_XP_THRESHOLD = {
  '1': 0, '2': 500, '3': 1500, '4': 3000, '5': 5000
}
